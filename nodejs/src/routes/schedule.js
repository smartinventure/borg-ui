const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const borgmaticConfig = require('../services/borgmatic-config');
const yamlManager = require('../services/yaml-manager');
const fs = require('fs-extra');
const path = require('path');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');

// In-memory cron job storage for active jobs
const cronJobs = new Map();
const runningJobs = new Set(); // Track currently running jobs to prevent overlaps

/**
 * Get all scheduled jobs
 * GET /api/schedule
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const config = await borgmaticConfig.loadConfig();
        const jobs = config.scheduled_jobs || [];
        
        res.json({
            success: true,
            data: {
                jobs: jobs.map(job => ({
                    id: job.id,
                    name: job.name,
                    cron_expression: job.cron_expression,
                    repository: job.repository,
                    config_file: job.config_file,
                    enabled: job.enabled,
                    description: job.description,
                    last_run: job.last_run,
                    next_run: job.next_run,
                    created_at: job.created_at,
                    updated_at: job.updated_at
                }))
            }
        });
    } catch (error) {
        console.error('Failed to get scheduled jobs:', error.message);
        res.status(500).json({ 
            success: false,
            detail: 'Failed to retrieve scheduled jobs' 
        });
    }
});

/**
 * Create a new scheduled job
 * POST /api/schedule
 */
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { name, cron_expression, repository, config_file, enabled = true, description } = req.body;

        // Check if user is admin
        if (!req.user.is_admin) {
            return res.status(403).json({ 
                success: false,
                detail: 'Admin access required' 
            });
        }

        if (!name || !cron_expression) {
            return res.status(400).json({ 
                success: false,
                detail: 'Name and cron expression are required' 
            });
        }

        // Validate cron expression
        if (!cron.validate(cron_expression)) {
            return res.status(400).json({ 
                success: false,
                detail: 'Invalid cron expression' 
            });
        }

        // Check if job name already exists
        const config = await borgmaticConfig.loadConfig();
        const existingJobs = config.scheduled_jobs || [];
        const existingJob = existingJobs.find(job => job.name === name);
        
        if (existingJob) {
            return res.status(400).json({ 
                success: false,
                detail: 'Job name already exists' 
            });
        }

        // Create job ID
        const jobId = uuidv4();
        
        // Calculate next run time
        const nextRun = new Date(Date.now() + 60000); // Default to 1 minute from now
        
        // Create scheduled job
        const scheduledJob = {
            id: jobId,
            name,
            cron_expression,
            repository,
            config_file,
            enabled,
            description,
            last_run: null,
            next_run: nextRun.toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // Add to configuration
        if (!config.scheduled_jobs) {
            config.scheduled_jobs = [];
        }
        config.scheduled_jobs.push(scheduledJob);

        // Save configuration
        await borgmaticConfig.saveConfig(config);

        // Start the cron job if enabled
        if (enabled) {
            startCronJob(scheduledJob);
        }

        res.json({
            success: true,
            data: {
                message: 'Scheduled job created successfully',
                job: scheduledJob
            }
        });
    } catch (error) {
        console.error('Failed to create scheduled job:', error.message);
        res.status(500).json({ 
            success: false,
            detail: 'Failed to create scheduled job' 
        });
    }
});

/**
 * Update a scheduled job
 * PUT /api/schedule/:id
 */
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, cron_expression, repository, config_file, enabled, description } = req.body;

        // Check if user is admin
        if (!req.user.is_admin) {
            return res.status(403).json({ 
                success: false,
                detail: 'Admin access required' 
            });
        }

        const config = await borgmaticConfig.loadConfig();
        const jobs = config.scheduled_jobs || [];
        const jobIndex = jobs.findIndex(job => job.id === id);
        
        if (jobIndex === -1) {
            return res.status(404).json({ 
                success: false,
                detail: 'Scheduled job not found' 
            });
        }

        // Stop existing cron job
        if (cronJobs.has(id)) {
            cronJobs.get(id).destroy();
            cronJobs.delete(id);
        }

        // Update job
        const updatedJob = {
            ...jobs[jobIndex],
            ...(name && { name }),
            ...(cron_expression && { cron_expression }),
            ...(repository !== undefined && { repository }),
            ...(config_file !== undefined && { config_file }),
            ...(enabled !== undefined && { enabled }),
            ...(description !== undefined && { description }),
            updated_at: new Date().toISOString()
        };

        // Validate cron expression if provided
        if (cron_expression && !cron.validate(cron_expression)) {
            return res.status(400).json({ 
                success: false,
                detail: 'Invalid cron expression' 
            });
        }

        // Calculate next run time if cron expression changed
        if (cron_expression) {
            const nextRun = new Date(Date.now() + 60000); // Default to 1 minute from now
            updatedJob.next_run = nextRun.toISOString();
        }

        jobs[jobIndex] = updatedJob;
        config.scheduled_jobs = jobs;

        // Save configuration
        await borgmaticConfig.saveConfig(config);

        // Start new cron job if enabled
        if (updatedJob.enabled) {
            startCronJob(updatedJob);
        }

        res.json({
            success: true,
            data: {
                message: 'Scheduled job updated successfully',
                job: updatedJob
            }
        });
    } catch (error) {
        console.error('Failed to update scheduled job:', error.message);
        res.status(500).json({ 
            success: false,
            detail: 'Failed to update scheduled job' 
        });
    }
});

/**
 * Delete a scheduled job
 * DELETE /api/schedule/:id
 */
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        // Check if user is admin
        if (!req.user.is_admin) {
            return res.status(403).json({ 
                success: false,
                detail: 'Admin access required' 
            });
        }

        const config = await borgmaticConfig.loadConfig();
        const jobs = config.scheduled_jobs || [];
        const jobIndex = jobs.findIndex(job => job.id === id);
        
        if (jobIndex === -1) {
            return res.status(404).json({ 
                success: false,
                detail: 'Scheduled job not found' 
            });
        }

        // Stop cron job
        if (cronJobs.has(id)) {
            cronJobs.get(id).destroy();
            cronJobs.delete(id);
        }

        // Remove from configuration
        jobs.splice(jobIndex, 1);
        config.scheduled_jobs = jobs;

        // Save configuration
        await borgmaticConfig.saveConfig(config);

        res.json({
            success: true,
            data: {
                message: 'Scheduled job deleted successfully'
            }
        });
    } catch (error) {
        console.error('Failed to delete scheduled job:', error.message);
        res.status(500).json({ 
            success: false,
            detail: 'Failed to delete scheduled job' 
        });
    }
});

/**
 * Toggle job enabled/disabled status
 * POST /api/schedule/:id/toggle
 */
router.post('/:id/toggle', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        // Check if user is admin
        if (!req.user.is_admin) {
            return res.status(403).json({ 
                success: false,
                detail: 'Admin access required' 
            });
        }

        const config = await borgmaticConfig.loadConfig();
        const jobs = config.scheduled_jobs || [];
        const jobIndex = jobs.findIndex(job => job.id === id);
        
        if (jobIndex === -1) {
            return res.status(404).json({ 
                success: false,
                detail: 'Scheduled job not found' 
            });
        }

        const job = jobs[jobIndex];
        const newEnabled = !job.enabled;

        // Stop existing cron job
        if (cronJobs.has(id)) {
            cronJobs.get(id).destroy();
            cronJobs.delete(id);
        }

        // Update job
        job.enabled = newEnabled;
        job.updated_at = new Date().toISOString();

        // Start new cron job if enabled
        if (newEnabled) {
            startCronJob(job);
        }

        // Save configuration
        await borgmaticConfig.saveConfig(config);

        res.json({
            success: true,
            data: {
                message: `Scheduled job ${newEnabled ? 'enabled' : 'disabled'} successfully`,
                job: job
            }
        });
    } catch (error) {
        console.error('Failed to toggle scheduled job:', error.message);
        res.status(500).json({ 
            success: false,
            detail: 'Failed to toggle scheduled job' 
        });
    }
});

/**
 * Get cron expression presets
 * GET /api/schedule/cron-presets
 */
router.get('/cron-presets', authenticateToken, async (req, res) => {
    try {
        const presets = [
            {
                name: "Every Minute",
                expression: "* * * * *",
                description: "Run every minute"
            },
            {
                name: "Every 5 Minutes",
                expression: "*/5 * * * *",
                description: "Run every 5 minutes"
            },
            {
                name: "Every 15 Minutes",
                expression: "*/15 * * * *",
                description: "Run every 15 minutes"
            },
            {
                name: "Every 30 Minutes",
                expression: "*/30 * * * *",
                description: "Run every 30 minutes"
            },
            {
                name: "Every Hour",
                expression: "0 * * * *",
                description: "Run every hour"
            },
            {
                name: "Every 2 Hours",
                expression: "0 */2 * * *",
                description: "Run every 2 hours"
            },
            {
                name: "Every 6 Hours",
                expression: "0 */6 * * *",
                description: "Run every 6 hours"
            },
            {
                name: "Every 12 Hours",
                expression: "0 */12 * * *",
                description: "Run every 12 hours"
            },
            {
                name: "Daily at Midnight",
                expression: "0 0 * * *",
                description: "Run daily at midnight"
            },
            {
                name: "Daily at 2 AM",
                expression: "0 2 * * *",
                description: "Run daily at 2 AM"
            },
            {
                name: "Daily at 3 AM",
                expression: "0 3 * * *",
                description: "Run daily at 3 AM"
            },
            {
                name: "Weekly on Sunday",
                expression: "0 0 * * 0",
                description: "Run weekly on Sunday at midnight"
            },
            {
                name: "Monthly on 1st",
                expression: "0 0 1 * *",
                description: "Run monthly on the 1st at midnight"
            }
        ];

        res.json({
            success: true,
            data: {
                presets: presets
            }
        });
    } catch (error) {
        console.error('Failed to get cron presets:', error.message);
        res.status(500).json({ 
            success: false,
            detail: 'Failed to get cron presets' 
        });
    }
});

/**
 * Validate cron expression
 * POST /api/schedule/validate-cron
 */
router.post('/validate-cron', authenticateToken, async (req, res) => {
    try {
        const { cron_expression } = req.body;

        if (!cron_expression) {
            return res.status(400).json({ 
                success: false,
                detail: 'Cron expression is required' 
            });
        }

        const isValid = cron.validate(cron_expression);
        
        if (isValid) {
            // Calculate next run times (simplified approach)
            const nextRuns = [];
            const now = new Date();
            
            for (let i = 0; i < 5; i++) {
                const nextRun = new Date(now.getTime() + (i + 1) * 60000); // 1, 2, 3, 4, 5 minutes from now
                nextRuns.push(nextRun.toISOString());
            }

            res.json({
                success: true,
                data: {
                    valid: true,
                    next_runs: nextRuns
                }
            });
        } else {
            res.json({
                success: true,
                data: {
                    valid: false,
                    message: 'Invalid cron expression'
                }
            });
        }
    } catch (error) {
        console.error('Failed to validate cron expression:', error.message);
        res.status(500).json({ 
            success: false,
            detail: 'Failed to validate cron expression' 
        });
    }
});

/**
 * Get current job status
 * GET /api/schedule/:id/status
 */
router.get('/:id/status', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        // Check if user is admin
        if (!req.user.is_admin) {
            return res.status(403).json({ 
                success: false,
                detail: 'Admin access required' 
            });
        }

        const config = await borgmaticConfig.loadConfig();
        const jobs = config.scheduled_jobs || [];
        const job = jobs.find(j => j.id === id);
        
        if (!job) {
            return res.status(404).json({ 
                success: false,
                detail: 'Scheduled job not found' 
            });
        }

        const isRunning = runningJobs.has(id);
        const hasActiveCron = cronJobs.has(id);

        res.json({
            success: true,
            data: {
                job_id: id,
                name: job.name,
                status: job.status || 'idle',
                is_running: isRunning,
                has_active_cron: hasActiveCron,
                enabled: job.enabled,
                last_run: job.last_run,
                next_run: job.next_run
            }
        });
    } catch (error) {
        console.error('Failed to get job status:', error.message);
        res.status(500).json({ 
            success: false,
            detail: 'Failed to get job status' 
        });
    }
});

/**
 * Get job execution history
 * GET /api/schedule/:id/history
 */
router.get('/:id/history', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        // Check if user is admin
        if (!req.user.is_admin) {
            return res.status(403).json({ 
                success: false,
                detail: 'Admin access required' 
            });
        }

        const config = await borgmaticConfig.loadConfig();
        const jobs = config.scheduled_jobs || [];
        const job = jobs.find(j => j.id === id);
        
        if (!job) {
            return res.status(404).json({ 
                success: false,
                detail: 'Scheduled job not found' 
            });
        }

        // Get execution history from job logs
        const history = job.execution_history || [];
        const paginatedHistory = history
            .slice(offset, offset + parseInt(limit))
            .map(execution => ({
                id: execution.id,
                started_at: execution.started_at,
                completed_at: execution.completed_at,
                status: execution.status,
                duration: execution.duration,
                error_message: execution.error_message
            }));

        res.json({
            success: true,
            data: {
                history: paginatedHistory,
                total: history.length,
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });
    } catch (error) {
        console.error('Failed to get job history:', error.message);
        res.status(500).json({ 
            success: false,
            detail: 'Failed to get job history' 
        });
    }
});

/**
 * Start a cron job
 */
function startCronJob(job) {
    try {
        // Stop existing cron job if it exists
        if (cronJobs.has(job.id)) {
            cronJobs.get(job.id).destroy();
            cronJobs.delete(job.id);
        }

        const cronJob = cron.schedule(job.cron_expression, async () => {
            await executeScheduledJob(job);
        }, {
            scheduled: true,
            timezone: 'UTC'
        });

        cronJobs.set(job.id, cronJob);
        console.log(`Started cron job: ${job.name} (${job.cron_expression})`);
    } catch (error) {
        console.error(`Failed to start cron job ${job.name}:`, error.message);
    }
}

/**
 * Execute a scheduled job
 */
async function executeScheduledJob(job) {
    // Prevent overlapping executions of the same job
    if (runningJobs.has(job.id)) {
        console.log(`Skipping scheduled job ${job.name} - already running`);
        return;
    }

    const executionId = uuidv4();
    const startTime = new Date();
    
    try {
        runningJobs.add(job.id);
        console.log(`Executing scheduled job: ${job.name}`);
        
        // Update job last run time
        const config = await borgmaticConfig.loadConfig();
        const jobs = config.scheduled_jobs || [];
        const jobIndex = jobs.findIndex(j => j.id === job.id);
        
        if (jobIndex !== -1) {
            jobs[jobIndex].last_run = startTime.toISOString();
            jobs[jobIndex].status = 'running';
            
            // Add execution to history
            if (!jobs[jobIndex].execution_history) {
                jobs[jobIndex].execution_history = [];
            }
            
            jobs[jobIndex].execution_history.push({
                id: executionId,
                started_at: startTime.toISOString(),
                status: 'running'
            });
            
            // Keep only last 100 executions
            if (jobs[jobIndex].execution_history.length > 100) {
                jobs[jobIndex].execution_history = jobs[jobIndex].execution_history.slice(-100);
            }
            
            await borgmaticConfig.saveConfig(config);
        }

        // Get passphrase from config if needed
        let passphrase = null;
        try {
            const config = await borgmaticConfig.loadConfig();
            passphrase = config.storage?.encryption_passphrase || null;
        } catch (error) {
            console.warn('Could not retrieve passphrase:', error.message);
        }

        // Execute borgmatic command
        const borgmaticCLI = require('../services/borgmatic-cli');
        const result = await borgmaticCLI.createBackup({
            repository: job.repository,
            config_file: job.config_file,
            stats: true,
            progress: true,
            passphrase: passphrase
        });

        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();

        // Update execution history and job status
        if (jobIndex !== -1) {
            jobs[jobIndex].status = result.success ? 'completed' : 'failed';
            
            const execution = jobs[jobIndex].execution_history.find(e => e.id === executionId);
            if (execution) {
                execution.completed_at = endTime.toISOString();
                execution.status = result.success ? 'completed' : 'failed';
                execution.duration = duration;
                if (!result.success) {
                    execution.error_message = result.error || result.stderr;
                }
            }
            
            await borgmaticConfig.saveConfig(config);
        }

        console.log(`Scheduled job ${job.name} ${result.success ? 'completed' : 'failed'}`);
        
    } catch (error) {
        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();
        
        console.error(`Scheduled job ${job.name} failed:`, error.message);
        
        // Update execution history with error
        try {
            const config = await borgmaticConfig.loadConfig();
            const jobs = config.scheduled_jobs || [];
            const jobIndex = jobs.findIndex(j => j.id === job.id);
            
            if (jobIndex !== -1) {
                const execution = jobs[jobIndex].execution_history.find(e => e.id === executionId);
                if (execution) {
                    execution.completed_at = endTime.toISOString();
                    execution.status = 'failed';
                    execution.duration = duration;
                    execution.error_message = error.message;
                }
                
                await borgmaticConfig.saveConfig(config);
            }
        } catch (updateError) {
            console.error('Failed to update job execution history:', updateError.message);
        }
    } finally {
        // Always remove from running jobs
        runningJobs.delete(job.id);
    }
}

/**
 * Initialize all scheduled jobs on startup
 */
async function initializeScheduledJobs() {
    try {
        const config = await borgmaticConfig.loadConfig();
        const jobs = config.scheduled_jobs || [];
        
        for (const job of jobs) {
            if (job.enabled) {
                startCronJob(job);
            }
        }
        
        console.log(`Initialized ${jobs.length} scheduled jobs`);
    } catch (error) {
        console.error('Failed to initialize scheduled jobs:', error.message);
    }
}

// Initialize scheduled jobs on module load
initializeScheduledJobs();

module.exports = router;
