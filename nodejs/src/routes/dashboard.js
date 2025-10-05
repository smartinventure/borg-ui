const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const borgmaticCLI = require('../services/borgmatic-cli');
const borgmaticConfig = require('../services/borgmatic-config');
const os = require('os');
const fs = require('fs-extra');
const path = require('path');

/**
 * Get system metrics
 */
async function getSystemMetrics() {
    try {
        // CPU usage (simplified - in production, use a proper CPU monitoring library)
        const cpus = os.cpus();
        const cpuUsage = cpus.reduce((acc, cpu) => {
            const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
            const idle = cpu.times.idle;
            return acc + (1 - idle / total);
        }, 0) / cpus.length * 100;

        // Memory usage
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const memoryUsage = (usedMem / totalMem) * 100;

        // Disk usage - use execa to get disk info
        let diskUsage = 0;
        let diskTotal = 0;
        let diskFree = 0;
        try {
            const { execa } = require('execa');
            const result = await execa('df', ['-h', '/'], { timeout: 5000 });
            const lines = result.stdout.split('\n');
            if (lines.length > 1) {
                const parts = lines[1].split(/\s+/);
                if (parts.length >= 4) {
                    diskTotal = parseFloat(parts[1]) || 0;
                    diskFree = parseFloat(parts[3]) || 0;
                    diskUsage = ((diskTotal - diskFree) / diskTotal) * 100;
                }
            }
        } catch (error) {
            console.warn('Could not get disk usage:', error.message);
            // Fallback to basic calculation
            diskUsage = 0;
            diskTotal = 0;
            diskFree = 0;
        }

        // System uptime
        const uptime = Math.floor(os.uptime());

        return {
            cpu_usage: Math.round(cpuUsage * 100) / 100,
            memory_usage: Math.round(memoryUsage * 100) / 100,
            memory_total: totalMem,
            memory_available: freeMem,
            disk_usage: diskUsage,
            disk_total: diskTotal,
            disk_free: diskFree,
            uptime: uptime
        };
    } catch (error) {
        console.error('Failed to get system metrics:', error.message);
        throw new Error('Failed to get system metrics');
    }
}

/**
 * Get backup status for all repositories
 */
async function getBackupStatus() {
    try {
        const repositories = await borgmaticConfig.getRepositories();
        const statusList = [];

        for (const repo of repositories) {
            try {
                // Get repository info
                const repoInfo = await borgmaticCLI.getRepositoryInfo(repo.path);
                
                statusList.push({
                    repository: repo.label || repo.path,
                    status: repoInfo.success ? 'healthy' : 'error',
                    last_backup: 'Unknown', // Would need to parse from borg list
                    archive_count: 0, // Would need to parse from borg list
                    total_size: 'Unknown', // Would need to parse from borg info
                    health: repoInfo.success ? 'healthy' : 'error'
                });
            } catch (error) {
                console.warn(`Failed to get status for repository ${repo.path}:`, error.message);
                statusList.push({
                    repository: repo.label || repo.path,
                    status: 'error',
                    last_backup: 'Never',
                    archive_count: 0,
                    total_size: '0',
                    health: 'error'
                });
            }
        }

        return statusList;
    } catch (error) {
        console.error('Failed to get backup status:', error.message);
        return [];
    }
}

/**
 * Get scheduled jobs information
 */
async function getScheduledJobs() {
    try {
        // TODO: Implement when cron job management is added
        // For now, return empty array
        return [];
    } catch (error) {
        console.error('Failed to get scheduled jobs:', error.message);
        return [];
    }
}

/**
 * Get recent backup jobs
 */
async function getRecentJobs(limit = 10) {
    try {
        // TODO: Implement when job tracking is added
        // For now, return empty array
        return [];
    } catch (error) {
        console.error('Failed to get recent jobs:', error.message);
        return [];
    }
}

/**
 * Get system alerts
 */
async function getAlerts(hours = 24) {
    try {
        // TODO: Implement when alert system is added
        // For now, return empty array
        return [];
    } catch (error) {
        console.error('Failed to get alerts:', error.message);
        return [];
    }
}

/**
 * Get comprehensive dashboard status
 */
router.get('/status', authenticateToken, async (req, res) => {
    try {
        // Get backup status
        const backupStatus = await getBackupStatus();
        
        // Get system metrics
        const systemMetrics = await getSystemMetrics();
        
        // Get scheduled jobs
        const scheduledJobs = await getScheduledJobs();
        
        // Get recent jobs
        const recentJobs = await getRecentJobs();
        
        // Get alerts
        const alerts = await getAlerts();
        
        res.json({
            success: true,
            data: {
                backup_status: backupStatus,
                system_metrics: systemMetrics,
                scheduled_jobs: scheduledJobs,
                recent_jobs: recentJobs,
                alerts: alerts,
                last_updated: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error getting dashboard status:', error.message);
        res.status(500).json({ 
            success: false,
            detail: 'Failed to get dashboard status' 
        });
    }
});

/**
 * Get system metrics for dashboard
 */
router.get('/metrics', authenticateToken, async (req, res) => {
    try {
        const metrics = await getSystemMetrics();
        
        // Get network I/O (simplified)
        const networkIO = {
            bytes_sent: 0, // Would need proper network monitoring
            bytes_recv: 0,
            packets_sent: 0,
            packets_recv: 0
        };
        
        // Get load average
        const loadAverage = os.loadavg();
        
        res.json({
            success: true,
            data: {
                cpu_usage: metrics.cpu_usage,
                memory_usage: metrics.memory_usage,
                disk_usage: metrics.disk_usage,
                network_io: networkIO,
                load_average: loadAverage
            }
        });
    } catch (error) {
        console.error('Error getting metrics:', error.message);
        res.status(500).json({ 
            success: false,
            detail: 'Failed to get metrics' 
        });
    }
});

/**
 * Get scheduled jobs information
 */
router.get('/schedule', authenticateToken, async (req, res) => {
    try {
        const jobs = await getScheduledJobs();
        
        // Find next execution time
        let nextExecution = null;
        if (jobs.length > 0) {
            // This is a simplified approach - in a real implementation,
            // you'd use a proper cron parser to calculate next execution
            nextExecution = new Date().toISOString();
        }
        
        res.json({
            success: true,
            data: {
                jobs: jobs,
                next_execution: nextExecution
            }
        });
    } catch (error) {
        console.error('Error getting schedule:', error.message);
        res.status(500).json({ 
            success: false,
            detail: 'Failed to get schedule' 
        });
    }
});

/**
 * Get system health status
 */
router.get('/health', authenticateToken, async (req, res) => {
    try {
        const checks = {};
        
        // Check system resources
        try {
            const metrics = await getSystemMetrics();
            
            checks.system = {
                status: (metrics.cpu_usage < 90 && metrics.memory_usage < 90 && metrics.disk_usage < 90) ? 'healthy' : 'warning',
                cpu_usage: metrics.cpu_usage,
                memory_usage: metrics.memory_usage,
                disk_usage: metrics.disk_usage
            };
        } catch (error) {
            checks.system = {
                status: 'error',
                error: error.message
            };
        }
        
        // Check borgmatic availability
        try {
            const systemInfo = await borgmaticCLI.getSystemInfo();
            checks.borgmatic = {
                status: systemInfo.success ? 'healthy' : 'error',
                version: systemInfo.borgmatic_version || 'Unknown',
                config_path: systemInfo.config_path || 'Unknown'
            };
        } catch (error) {
            checks.borgmatic = {
                status: 'error',
                error: error.message
            };
        }
        
        // Check backup repositories
        try {
            const backupStatus = await getBackupStatus();
            const healthyRepos = backupStatus.filter(repo => repo.status === 'healthy').length;
            const totalRepos = backupStatus.length;
            
            if (totalRepos === 0) {
                checks.repositories = {
                    status: 'healthy',
                    healthy_count: 0,
                    total_count: 0,
                    message: 'No repositories configured'
                };
            } else {
                checks.repositories = {
                    status: healthyRepos === totalRepos ? 'healthy' : 'warning',
                    healthy_count: healthyRepos,
                    total_count: totalRepos
                };
            }
        } catch (error) {
            checks.repositories = {
                status: 'error',
                error: error.message
            };
        }
        
        // Overall status
        let overallStatus = 'healthy';
        if (Object.values(checks).some(check => check.status === 'error')) {
            overallStatus = 'error';
        } else if (Object.values(checks).some(check => check.status === 'warning')) {
            overallStatus = 'warning';
        }
        
        res.json({
            success: true,
            data: {
                status: overallStatus,
                checks: checks,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error getting health status:', error.message);
        res.status(500).json({ 
            success: false,
            detail: 'Failed to get health status' 
        });
    }
});

module.exports = router;
