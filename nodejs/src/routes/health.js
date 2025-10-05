const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const borgmaticCLI = require('../services/borgmatic-cli');
const borgmaticConfig = require('../services/borgmatic-config');
const { execa } = require('execa');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');

/**
 * Get comprehensive system health status
 * GET /api/health/system
 */
router.get('/system', authenticateToken, async (req, res) => {
    try {
        // CPU usage (simplified approach)
        const cpuUsage = await getCpuUsage();
        
        // Memory usage
        const memoryUsage = getMemoryUsage();
        
        // Disk usage
        const diskUsage = await getDiskUsage();
        
        // System uptime
        const uptime = os.uptime();
        
        // Network status (simple check)
        const networkStatus = await checkNetworkStatus();
        
        // Temperature (if available)
        const temperature = await getSystemTemperature();
        
        // Determine overall health status
        const status = determineSystemHealth(cpuUsage, memoryUsage, diskUsage);

        res.json({
            success: true,
            data: {
                cpu_usage: cpuUsage,
                memory_usage: memoryUsage,
                disk_usage: diskUsage,
                network_status: networkStatus,
                uptime: uptime,
                temperature: temperature,
                status: status,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Failed to get system health:', error.message);
        res.status(500).json({
            success: false,
            detail: 'Failed to get system health'
        });
    }
});

/**
 * Get comprehensive repository health status
 * GET /api/health/repositories
 */
router.get('/repositories', authenticateToken, async (req, res) => {
    try {
        // Get configured repositories from borgmatic config
        const config = await borgmaticConfig.loadConfig();
        const repositories = config.location?.repositories || [];

        const repositoryHealth = [];
        
        for (let i = 0; i < repositories.length; i++) {
            const repo = repositories[i];
            try {
                // Get detailed repository information
                const repoInfo = await getRepositoryHealthInfo(repo.path);
                
                repositoryHealth.push({
                    id: i + 1,
                    name: path.basename(repo.path),
                    path: repo.path,
                    encryption: repo.encryption,
                    ...repoInfo
                });
                
            } catch (error) {
                console.error(`Failed to get health info for repository ${repo.path}:`, error.message);
                repositoryHealth.push({
                    id: i + 1,
                    name: path.basename(repo.path),
                    path: repo.path,
                    encryption: repo.encryption,
                    status: 'error',
                    last_backup: null,
                    backup_count: 0,
                    total_size: 0,
                    compression_ratio: 0,
                    integrity_check: false,
                    errors: [`Failed to get repository info: ${error.message}`]
                });
            }
        }

        // Determine overall repository health
        const overallStatus = determineRepositoryHealth(repositoryHealth);

        res.json({
            success: true,
            data: {
                repositories: repositoryHealth,
                status: overallStatus,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Failed to get repository health:', error.message);
        res.status(500).json({
            success: false,
            detail: 'Failed to get repository health'
        });
    }
});

/**
 * Get backup health status (legacy endpoint for compatibility)
 * GET /api/health/backups
 */
router.get('/backups', authenticateToken, async (req, res) => {
    try {
        // Get configured repositories
        const config = await borgmaticConfig.loadConfig();
        const repositories = config.location?.repositories || [];

        res.json({
            success: true,
            data: {
                repositories: repositories.map((repo, index) => ({
                    id: index + 1,
                    name: path.basename(repo.path),
                    path: repo.path,
                    encryption: repo.encryption
                })),
                status: repositories.length > 0 ? 'healthy' : 'warning'
            }
        });
    } catch (error) {
        console.error('Failed to get backup health:', error.message);
        res.status(500).json({
            success: false,
            detail: 'Failed to get backup health'
        });
    }
});

/**
 * Get application health status
 * GET /api/health/application
 */
router.get('/application', authenticateToken, async (req, res) => {
    try {
        // Check if borgmatic is available
        const borgmaticAvailable = await checkBorgmaticAvailability();
        
        // Check if configuration is valid
        const configValid = await checkConfigurationValidity();
        
        // Check if required directories exist
        const directoriesExist = await checkRequiredDirectories();
        
        // Check if we can write to data directory
        const dataWritable = await checkDataDirectoryWritable();

        const status = determineApplicationHealth({
            borgmaticAvailable,
            configValid,
            directoriesExist,
            dataWritable
        });

        res.json({
            success: true,
            data: {
                borgmatic_available: borgmaticAvailable,
                config_valid: configValid,
                directories_exist: directoriesExist,
                data_writable: dataWritable,
                status: status,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Failed to get application health:', error.message);
        res.status(500).json({
            success: false,
            detail: 'Failed to get application health'
        });
    }
});

/**
 * Get overall health status
 * GET /api/health/overall
 */
router.get('/overall', authenticateToken, async (req, res) => {
    try {
        // Get all health components
        const [systemHealth, repositoryHealth, applicationHealth] = await Promise.allSettled([
            getSystemHealthData(),
            getRepositoryHealthData(),
            getApplicationHealthData()
        ]);

        const overallStatus = determineOverallHealth({
            system: systemHealth.status === 'fulfilled' ? systemHealth.value : null,
            repositories: repositoryHealth.status === 'fulfilled' ? repositoryHealth.value : null,
            application: applicationHealth.status === 'fulfilled' ? applicationHealth.value : null
        });

        res.json({
            success: true,
            data: {
                status: overallStatus.status,
                components: {
                    system: systemHealth.status === 'fulfilled' ? systemHealth.value : { status: 'error' },
                    repositories: repositoryHealth.status === 'fulfilled' ? repositoryHealth.value : { status: 'error' },
                    application: applicationHealth.status === 'fulfilled' ? applicationHealth.value : { status: 'error' }
                },
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Failed to get overall health:', error.message);
        res.status(500).json({
            success: false,
            detail: 'Failed to get overall health'
        });
    }
});

/**
 * Helper function to get CPU usage
 */
async function getCpuUsage() {
    try {
        // Use a simple approach to get CPU usage
        const startUsage = process.cpuUsage();
        await new Promise(resolve => setTimeout(resolve, 100));
        const endUsage = process.cpuUsage(startUsage);
        
        const totalUsage = (endUsage.user + endUsage.system) / 1000000; // Convert to seconds
        return Math.min(100, Math.max(0, totalUsage * 10)); // Rough approximation
    } catch (error) {
        console.warn('Failed to get CPU usage:', error.message);
        return 0;
    }
}

/**
 * Helper function to get memory usage
 */
function getMemoryUsage() {
    try {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        return Math.round((usedMem / totalMem) * 100);
    } catch (error) {
        console.warn('Failed to get memory usage:', error.message);
        return 0;
    }
}

/**
 * Helper function to get disk usage
 */
async function getDiskUsage() {
    try {
        const stats = await fs.statvfs ? await fs.statvfs('/') : null;
        if (stats) {
            const total = stats.bavail + stats.bfree;
            const used = total - stats.bavail;
            return Math.round((used / total) * 100);
        }
        
        // Fallback: use df command
        try {
            const { stdout } = await execa('df', ['-h', '/']);
            const lines = stdout.split('\n');
            if (lines.length > 1) {
                const parts = lines[1].split(/\s+/);
                const usage = parts[4];
                return parseInt(usage.replace('%', ''));
            }
        } catch (error) {
            console.warn('Failed to get disk usage via df:', error.message);
        }
        
        return 0;
    } catch (error) {
        console.warn('Failed to get disk usage:', error.message);
        return 0;
    }
}

/**
 * Helper function to check network status
 */
async function checkNetworkStatus() {
    try {
        // Try to ping a reliable host
        await execa('ping', ['-c', '1', '8.8.8.8'], { timeout: 5000 });
        return 'connected';
    } catch (error) {
        return 'disconnected';
    }
}

/**
 * Helper function to get system temperature
 */
async function getSystemTemperature() {
    try {
        const tempPaths = [
            '/sys/class/thermal/thermal_zone0/temp',
            '/sys/class/hwmon/hwmon0/temp1_input',
            '/proc/acpi/thermal_zone/THM0/temperature'
        ];
        
        for (const tempPath of tempPaths) {
            if (await fs.pathExists(tempPath)) {
                const tempRaw = await fs.readFile(tempPath, 'utf8');
                const temp = parseFloat(tempRaw.trim());
                if (!isNaN(temp)) {
                    return temp / 1000.0; // Convert from millidegrees
                }
            }
        }
        
        return null;
    } catch (error) {
        console.warn('Failed to get temperature:', error.message);
        return null;
    }
}

/**
 * Helper function to determine system health
 */
function determineSystemHealth(cpuUsage, memoryUsage, diskUsage) {
    if (cpuUsage >= 90 || memoryUsage >= 90 || diskUsage >= 90) {
        return 'error';
    } else if (cpuUsage >= 80 || memoryUsage >= 80 || diskUsage >= 80) {
        return 'warning';
    } else {
        return 'healthy';
    }
}

/**
 * Helper function to get repository health info
 */
async function getRepositoryHealthInfo(repositoryPath) {
    try {
        // Get repository info
        const repoInfo = await borgmaticCLI.getRepositoryInfo(repositoryPath);
        
        if (!repoInfo.success) {
            return {
                status: 'error',
                last_backup: null,
                backup_count: 0,
                total_size: 0,
                compression_ratio: 0,
                integrity_check: false,
                errors: [`Failed to get repository info: ${repoInfo.error || repoInfo.stderr}`]
            };
        }

        // Get archive list
        const archives = await borgmaticCLI.listArchives(repositoryPath, { json: true });
        
        let lastBackup = null;
        let backupCount = 0;
        let totalSize = 0;
        let compressionRatio = 0;
        let integrityCheck = false;
        const errors = [];

        if (archives.success && archives.stdout) {
            try {
                const archiveData = JSON.parse(archives.stdout);
                if (Array.isArray(archiveData.archives)) {
                    backupCount = archiveData.archives.length;
                    if (backupCount > 0) {
                        const latestArchive = archiveData.archives[archiveData.archives.length - 1];
                        lastBackup = latestArchive.start;
                        totalSize = latestArchive.stats?.original_size || 0;
                        compressionRatio = latestArchive.stats?.compression_ratio || 0;
                    }
                }
            } catch (parseError) {
                console.warn('Failed to parse archive data:', parseError.message);
            }
        }

        // Check for common issues
        let status = 'healthy';
        
        if (!lastBackup) {
            status = 'warning';
            errors.push('No backups found');
        }
        
        if (backupCount === 0) {
            status = 'warning';
            errors.push('No backup archives');
        }
        
        // Check backup age
        if (lastBackup) {
            const lastBackupTime = new Date(lastBackup).getTime();
            const daysSinceBackup = (Date.now() - lastBackupTime) / (1000 * 60 * 60 * 24);
            if (daysSinceBackup > 7) {
                status = 'warning';
                errors.push(`Last backup was ${Math.floor(daysSinceBackup)} days ago`);
            }
        }

        return {
            status,
            last_backup: lastBackup,
            backup_count: backupCount,
            total_size: totalSize,
            compression_ratio: compressionRatio,
            integrity_check: integrityCheck,
            errors
        };
    } catch (error) {
        return {
            status: 'error',
            last_backup: null,
            backup_count: 0,
            total_size: 0,
            compression_ratio: 0,
            integrity_check: false,
            errors: [`Failed to get repository health: ${error.message}`]
        };
    }
}

/**
 * Helper function to determine repository health
 */
function determineRepositoryHealth(repositories) {
    if (repositories.length === 0) {
        return 'warning';
    }
    
    const hasErrors = repositories.some(r => r.status === 'error');
    const hasWarnings = repositories.some(r => r.status === 'warning');
    
    if (hasErrors) {
        return 'error';
    } else if (hasWarnings) {
        return 'warning';
    } else {
        return 'healthy';
    }
}

/**
 * Helper function to check borgmatic availability
 */
async function checkBorgmaticAvailability() {
    try {
        const result = await borgmaticCLI.executeCommand(['--version']);
        return result.success;
    } catch (error) {
        return false;
    }
}

/**
 * Helper function to check configuration validity
 */
async function checkConfigurationValidity() {
    try {
        const config = await borgmaticConfig.loadConfig();
        return config && config.location && config.location.repositories;
    } catch (error) {
        return false;
    }
}

/**
 * Helper function to check required directories
 */
async function checkRequiredDirectories() {
    try {
        const dataDir = path.join(process.cwd(), 'data');
        const logsDir = path.join(process.cwd(), 'logs');
        
        return await fs.pathExists(dataDir) && await fs.pathExists(logsDir);
    } catch (error) {
        return false;
    }
}

/**
 * Helper function to check data directory writability
 */
async function checkDataDirectoryWritable() {
    try {
        const dataDir = path.join(process.cwd(), 'data');
        const testFile = path.join(dataDir, 'test-write.tmp');
        
        await fs.writeFile(testFile, 'test');
        await fs.remove(testFile);
        
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Helper function to determine application health
 */
function determineApplicationHealth(checks) {
    const { borgmaticAvailable, configValid, directoriesExist, dataWritable } = checks;
    
    if (!borgmaticAvailable || !configValid || !directoriesExist || !dataWritable) {
        return 'error';
    }
    
    return 'healthy';
}

/**
 * Helper function to get system health data
 */
async function getSystemHealthData() {
    const cpuUsage = await getCpuUsage();
    const memoryUsage = getMemoryUsage();
    const diskUsage = await getDiskUsage();
    const networkStatus = await checkNetworkStatus();
    const temperature = await getSystemTemperature();
    
    return {
        cpu_usage: cpuUsage,
        memory_usage: memoryUsage,
        disk_usage: diskUsage,
        network_status: networkStatus,
        temperature: temperature,
        status: determineSystemHealth(cpuUsage, memoryUsage, diskUsage)
    };
}

/**
 * Helper function to get repository health data
 */
async function getRepositoryHealthData() {
    const config = await borgmaticConfig.getConfig();
    const repositories = config.location?.repositories || [];
    
    const repositoryHealth = [];
    for (let i = 0; i < repositories.length; i++) {
        const repo = repositories[i];
        const repoInfo = await getRepositoryHealthInfo(repo.path);
        repositoryHealth.push({
            id: i + 1,
            name: path.basename(repo.path),
            path: repo.path,
            encryption: repo.encryption,
            ...repoInfo
        });
    }
    
    return {
        repositories: repositoryHealth,
        status: determineRepositoryHealth(repositoryHealth)
    };
}

/**
 * Helper function to get application health data
 */
async function getApplicationHealthData() {
    const borgmaticAvailable = await checkBorgmaticAvailability();
    const configValid = await checkConfigurationValidity();
    const directoriesExist = await checkRequiredDirectories();
    const dataWritable = await checkDataDirectoryWritable();
    
    return {
        borgmatic_available: borgmaticAvailable,
        config_valid: configValid,
        directories_exist: directoriesExist,
        data_writable: dataWritable,
        status: determineApplicationHealth({
            borgmaticAvailable,
            configValid,
            directoriesExist,
            dataWritable
        })
    };
}

/**
 * Helper function to determine overall health
 */
function determineOverallHealth(components) {
    const statuses = Object.values(components).map(comp => comp?.status || 'error');
    
    if (statuses.includes('error')) {
        return { status: 'error' };
    } else if (statuses.includes('warning')) {
        return { status: 'warning' };
    } else {
        return { status: 'healthy' };
    }
}

module.exports = router;