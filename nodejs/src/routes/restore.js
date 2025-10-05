const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const borgmaticCLI = require('../services/borgmatic-cli');
const borgmaticConfig = require('../services/borgmatic-config');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// In-memory restore job storage (in production, use Redis or database)
const restoreJobs = new Map();

/**
 * Preview a restore operation (dry run)
 * POST /api/restore/preview
 */
router.post('/preview', authenticateToken, async (req, res) => {
    try {
        const { 
            repository, 
            archive, 
            paths = [], 
            destination, 
            stripComponents,
            progress = false,
            verbosity = 1
        } = req.body;

        if (!repository) {
            return res.status(400).json({ 
                success: false,
                detail: 'Repository parameter is required' 
            });
        }

        if (!archive || archive.trim() === '') {
            return res.status(400).json({ 
                success: false,
                detail: 'Archive parameter is required and cannot be empty' 
            });
        }

        // Destination is optional - defaults to current directory

        // Get passphrase from config if needed
        let passphrase = null;
        try {
            const config = await borgmaticConfig.loadConfig();
            passphrase = config.storage?.encryption_passphrase || null;
        } catch (error) {
            console.warn('Could not retrieve passphrase:', error.message);
        }

        const options = {
            paths: paths && paths.length > 0 ? paths.filter(p => p && p.trim()) : undefined,
            stripComponents: stripComponents ? Math.max(0, parseInt(stripComponents, 10)) : undefined,
            progress: progress === true,
            verbosity: verbosity || 1,
            dryRun: true,
            passphrase
        };

        // Perform dry run extraction
        const result = await borgmaticCLI.extractArchive(repository, archive, destination, options);

        if (!result.success) {
            return res.status(500).json({ 
                success: false,
                detail: `Failed to preview restore: ${result.error || result.stderr}` 
            });
        }

        res.json({
            success: true,
            data: {
                preview: result.stdout,
                repository: repository,
                archive: archive,
                destination: destination,
                paths: paths,
                command: result.command
            }
        });
    } catch (error) {
        console.error('Failed to preview restore:', error.message);
        res.status(500).json({ 
            success: false,
            detail: 'Failed to preview restore' 
        });
    }
});

/**
 * Start a restore operation
 * POST /api/restore/start
 */
router.post('/start', authenticateToken, async (req, res) => {
    try {
        const { 
            repository, 
            archive, 
            paths = [], 
            destination, 
            stripComponents,
            progress = true,
            verbosity = 1
        } = req.body;

        if (!repository) {
            return res.status(400).json({ 
                success: false,
                detail: 'Repository parameter is required' 
            });
        }

        if (!archive) {
            return res.status(400).json({ 
                success: false,
                detail: 'Archive parameter is required' 
            });
        }

        // Destination is optional - defaults to current directory

        // Generate unique job ID
        const jobId = uuidv4();

        // Create restore job record
        const restoreJob = {
            id: jobId,
            repository: repository,
            archive: archive,
            paths: paths,
            destination: destination,
            stripComponents: stripComponents,
            progress: progress,
            verbosity: verbosity,
            status: 'running',
            started_at: new Date().toISOString(),
            completed_at: null,
            progress_percent: 0,
            error_message: null,
            logs: '',
            user_id: req.user.username
        };

        // Store job in memory
        try {
            restoreJobs.set(jobId, restoreJob);
        } catch (error) {
            console.error('Failed to store restore job:', error.message);
            return res.status(500).json({
                success: false,
                detail: 'Failed to create restore job'
            });
        }

        // Execute restore asynchronously
        executeRestore(jobId, restoreJob);

        res.json({
            success: true,
            data: {
                job_id: jobId,
                status: 'running',
                message: 'Restore job started'
            }
        });
    } catch (error) {
        console.error('Failed to start restore:', error.message);
        res.status(500).json({ 
            success: false,
            detail: 'Failed to start restore' 
        });
    }
});

/**
 * Execute restore operation asynchronously
 */
async function executeRestore(jobId, restoreJob) {
    const job = restoreJobs.get(jobId);
    if (!job) return;
    
    try {
        // Update job status
        job.status = 'running';
        job.progress_percent = 10;
        job.logs = 'Starting restore...\n';
        
        // Get passphrase from config if needed
        let passphrase = null;
        try {
            const config = await borgmaticConfig.loadConfig();
            passphrase = config.storage?.encryption_passphrase || null;
        } catch (error) {
            console.warn('Could not retrieve passphrase:', error.message);
        }

        const options = {
            paths: restoreJob.paths && restoreJob.paths.length > 0 ? restoreJob.paths.filter(p => p && p.trim()) : undefined,
            stripComponents: restoreJob.stripComponents ? Math.max(0, parseInt(restoreJob.stripComponents, 10)) : undefined,
            progress: restoreJob.progress,
            verbosity: restoreJob.verbosity,
            passphrase
        };

        // Execute borgmatic extract command
        const result = await borgmaticCLI.extractArchive(
            restoreJob.repository,
            restoreJob.archive,
            restoreJob.destination,
            options
        );
        
        if (result.success) {
            job.status = 'completed';
            job.progress_percent = 100;
            job.completed_at = new Date().toISOString();
            job.logs += result.stdout || '';
            
            console.log(`Restore completed successfully for job ${jobId}`);
        } else {
            job.status = 'failed';
            job.progress_percent = 0;
            job.completed_at = new Date().toISOString();
            job.error_message = result.error || 'Unknown error';
            job.logs += result.stderr || '';
            
            console.error(`Restore failed for job ${jobId}:`, result.error);
        }
    } catch (error) {
        job.status = 'failed';
        job.progress_percent = 0;
        job.completed_at = new Date().toISOString();
        job.error_message = error.message;
        job.logs += `Error: ${error.message}\n`;
        
        console.error(`Restore error for job ${jobId}:`, error.message);
    }
    
    // Update job in storage
    restoreJobs.set(jobId, job);
    
    // TODO: Send real-time update via WebSocket
}

/**
 * Get restore job status
 * GET /api/restore/status/:jobId
 */
router.get('/status/:jobId', authenticateToken, async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = restoreJobs.get(jobId);
        
        if (!job) {
            return res.status(404).json({ 
                success: false,
                detail: 'Restore job not found' 
            });
        }

        // Check if user has access to this job
        if (job.user_id !== req.user.username && !req.user.is_admin) {
            return res.status(403).json({ 
                success: false,
                detail: 'Access denied to this restore job' 
            });
        }

        res.json({
            success: true,
            data: {
                id: job.id,
                repository: job.repository,
                archive: job.archive,
                paths: job.paths,
                destination: job.destination,
                status: job.status,
                started_at: job.started_at,
                completed_at: job.completed_at,
                progress: job.progress_percent,
                error_message: job.error_message,
                logs: job.logs
            }
        });
    } catch (error) {
        console.error('Failed to get restore status:', error.message);
        res.status(500).json({ 
            success: false,
            detail: 'Failed to get restore status' 
        });
    }
});

/**
 * Get restore job logs
 * GET /api/restore/logs/:jobId
 */
router.get('/logs/:jobId', authenticateToken, async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = restoreJobs.get(jobId);
        
        if (!job) {
            return res.status(404).json({ 
                success: false,
                detail: 'Restore job not found' 
            });
        }

        // Check if user has access to this job
        if (job.user_id !== req.user.username && !req.user.is_admin) {
            return res.status(403).json({ 
                success: false,
                detail: 'Access denied to this restore job' 
            });
        }

        res.json({
            success: true,
            data: {
                job_id: job.id,
                logs: job.logs || '',
                error_message: job.error_message || ''
            }
        });
    } catch (error) {
        console.error('Failed to get restore logs:', error.message);
        res.status(500).json({ 
            success: false,
            detail: 'Failed to get restore logs' 
        });
    }
});

/**
 * Cancel a running restore job
 * DELETE /api/restore/cancel/:jobId
 */
router.delete('/cancel/:jobId', authenticateToken, async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = restoreJobs.get(jobId);
        
        if (!job) {
            return res.status(404).json({
                success: false,
                detail: 'Restore job not found'
            });
        }

        // Check if user has access to this job
        if (job.user_id !== req.user.username && !req.user.is_admin) {
            return res.status(403).json({ 
                success: false,
                detail: 'Access denied to this restore job' 
            });
        }

        if (job.status !== 'running') {
            return res.status(400).json({ 
                success: false,
                detail: 'Can only cancel running jobs' 
            });
        }
        
        // Update job status
        job.status = 'cancelled';
        job.completed_at = new Date().toISOString();
        job.logs += 'Restore cancelled by user\n';
        
        // TODO: Implement actual process cancellation
        // This would require tracking the child process and killing it
        
        restoreJobs.set(jobId, job);
        
        console.log(`Restore cancelled for job ${jobId} by user ${req.user.username}`);
        
        res.json({
            success: true,
            data: {
                message: 'Restore cancelled successfully'
            }
        });
    } catch (error) {
        console.error('Failed to cancel restore:', error.message);
        res.status(500).json({ 
            success: false,
            detail: 'Failed to cancel restore' 
        });
    }
});

/**
 * Get all restore jobs for the current user
 * GET /api/restore/jobs
 */
router.get('/jobs', authenticateToken, async (req, res) => {
    try {
        const { limit = 50, status } = req.query;
        const userJobs = [];
        
        // Filter jobs by user and status
        for (const [jobId, job] of restoreJobs.entries()) {
            if (job.user_id === req.user.username) {
                if (!status || job.status === status) {
                    userJobs.push({
                        id: job.id,
                        repository: job.repository,
                        archive: job.archive,
                        destination: job.destination,
                        status: job.status,
                        started_at: job.started_at,
                        completed_at: job.completed_at,
                        progress: job.progress_percent
                    });
                }
            }
        }
        
        // Sort by started_at descending
        userJobs.sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
        
        // Apply limit
        const limitedJobs = userJobs.slice(0, parseInt(limit));
        
        res.json({
            success: true,
            data: {
                jobs: limitedJobs,
                total: userJobs.length
            }
        });
    } catch (error) {
        console.error('Failed to get restore jobs:', error.message);
        res.status(500).json({ 
            success: false,
            detail: 'Failed to get restore jobs' 
        });
    }
});

/**
 * Restore database dumps from archive
 * POST /api/restore/database
 */
router.post('/database', authenticateToken, async (req, res) => {
    try {
        const { 
            repository, 
            archive, 
            dataSource, 
            schema, 
            hostname, 
            port, 
            username, 
            password, 
            database, 
            originalHostname, 
            originalContainer, 
            originalPort, 
            hook 
        } = req.body;

        if (!repository) {
            return res.status(400).json({ 
                success: false,
                detail: 'Repository parameter is required' 
            });
        }

        if (!archive) {
            return res.status(400).json({ 
                success: false,
                detail: 'Archive parameter is required' 
            });
        }

        // Get passphrase from config if needed
        let passphrase = null;
        try {
            const config = await borgmaticConfig.loadConfig();
            passphrase = config.storage?.encryption_passphrase || null;
        } catch (error) {
            console.warn('Could not retrieve passphrase:', error.message);
        }

        const options = {
            dataSource,
            schema,
            hostname,
            port,
            username,
            password,
            database,
            originalHostname,
            originalContainer,
            originalPort,
            hook,
            passphrase
        };

        const result = await borgmaticCLI.restoreData(repository, archive, options);

        if (!result.success) {
            return res.status(500).json({ 
                success: false,
                detail: `Failed to restore database: ${result.error || result.stderr}` 
            });
        }

        res.json({
            success: true,
            data: {
                message: 'Database restored successfully',
                repository: repository,
                archive: archive,
                command: result.command,
                output: result.stdout
            }
        });
    } catch (error) {
        console.error('Failed to restore database:', error.message);
        res.status(500).json({ 
            success: false,
            detail: 'Failed to restore database' 
        });
    }
});

/**
 * Get restore statistics
 * GET /api/restore/stats
 */
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const userJobs = [];
        
        // Get all jobs for the current user
        for (const [jobId, job] of restoreJobs.entries()) {
            if (job.user_id === req.user.username) {
                userJobs.push(job);
            }
        }
        
        // Calculate statistics
        const stats = {
            total_jobs: userJobs.length,
            completed_jobs: userJobs.filter(job => job.status === 'completed').length,
            failed_jobs: userJobs.filter(job => job.status === 'failed').length,
            running_jobs: userJobs.filter(job => job.status === 'running').length,
            cancelled_jobs: userJobs.filter(job => job.status === 'cancelled').length
        };
        
        // Calculate success rate
        const finishedJobs = stats.completed_jobs + stats.failed_jobs;
        stats.success_rate = finishedJobs > 0 ? (stats.completed_jobs / finishedJobs) * 100 : 0;
        
        // Get recent activity (last 24 hours)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentJobs = userJobs.filter(job => new Date(job.started_at) > oneDayAgo);
        stats.recent_jobs = recentJobs.length;
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Failed to get restore stats:', error.message);
        res.status(500).json({ 
            success: false,
            detail: 'Failed to get restore statistics' 
        });
    }
});

/**
 * Clean up old completed restore jobs (maintenance endpoint)
 * POST /api/restore/cleanup
 */
router.post('/cleanup', authenticateToken, async (req, res) => {
    try {
        const { olderThanDays = 30 } = req.body;
        const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
        let cleanedCount = 0;
        
        // Only admin users can run cleanup
        if (!req.user.is_admin) {
            return res.status(403).json({ 
                success: false,
                detail: 'Admin access required' 
            });
        }
        
        // Clean up old completed/failed/cancelled jobs
        for (const [jobId, job] of restoreJobs.entries()) {
            if (job.status !== 'running' && new Date(job.started_at) < cutoffDate) {
                restoreJobs.delete(jobId);
                cleanedCount++;
            }
        }
        
        res.json({
            success: true,
            data: {
                message: `Cleaned up ${cleanedCount} old restore jobs`,
                cleaned_count: cleanedCount
            }
        });
    } catch (error) {
        console.error('Failed to cleanup restore jobs:', error.message);
        res.status(500).json({ 
            success: false,
            detail: 'Failed to cleanup restore jobs' 
        });
    }
});

/**
 * Extract configuration files from archive
 * POST /api/restore/config-bootstrap
 */
router.post('/config-bootstrap', authenticateToken, async (req, res) => {
    try {
        const { repository, archive, destination } = req.body;

        if (!repository) {
            return res.status(400).json({ 
                success: false,
                detail: 'Repository parameter is required' 
            });
        }

        // Get passphrase from config if needed
        let passphrase = null;
        try {
            const config = await borgmaticConfig.loadConfig();
            passphrase = config.storage?.encryption_passphrase || null;
        } catch (error) {
            console.warn('Could not retrieve passphrase:', error.message);
        }

        const options = {
            archive: archive || 'latest',
            destination,
            passphrase
        };

        const result = await borgmaticCLI.configBootstrap(repository, options);

        if (!result.success) {
            return res.status(500).json({ 
                success: false,
                detail: `Failed to bootstrap config: ${result.error || result.stderr}` 
            });
        }

        res.json({
            success: true,
            data: {
                message: 'Configuration files extracted successfully',
                repository: repository,
                archive: options.archive,
                destination: destination,
                command: result.command,
                output: result.stdout
            }
        });
    } catch (error) {
        console.error('Failed to bootstrap config:', error.message);
        res.status(500).json({ 
            success: false,
            detail: 'Failed to bootstrap configuration files' 
        });
    }
});

module.exports = router;
