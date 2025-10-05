const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const borgmaticCLI = require('../services/borgmatic-cli');
const borgmaticConfig = require('../services/borgmatic-config');

/**
 * List database dumps in an archive
 * GET /api/archives/database-dumps?repository=/path/to/repo&archive=latest&format=json&json=true
 */
router.get('/database-dumps', authenticateToken, async (req, res) => {
    try {
        const { repository, archive, format, json } = req.query;

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
            format,
            json: json === 'true',
            passphrase
        };

        const result = await borgmaticCLI.listDatabaseDumps(repository, options);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                detail: `Failed to list database dumps: ${result.error || result.stderr}`
            });
        }

        res.json({
            success: true,
            data: {
                repository: repository,
                archive: options.archive,
                command: result.command,
                output: result.stdout,
                database_dumps: result.stdout.split('\n').filter(line => line.trim())
            }
        });
    } catch (error) {
        console.error('Failed to list database dumps:', error.message);
        res.status(500).json({
            success: false,
            detail: 'Failed to list database dumps'
        });
    }
});

/**
 * List archives in a repository
 * GET /api/archives/list?repository=/path/to/repo&archive=name&path=/subpath&find=pattern&short=true&format=json&json=true&prefix=prefix&pattern=glob&sortBy=date&first=10&last=5&exclude=pattern&excludeFrom=file&patterns=pattern&patternsFrom=file
 */
router.get('/list', authenticateToken, async (req, res) => {
    try {
        const { 
            repository, 
            archive, 
            path, 
            find, 
            short, 
            format, 
            json, 
            prefix, 
            pattern, 
            sortBy, 
            first, 
            last, 
            exclude, 
            excludeFrom, 
            patterns, 
            patternsFrom 
        } = req.query;

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
            archive,
            path,
            find,
            short: short === 'true',
            format,
            json: json === 'true',
            prefix,
            pattern,
            sortBy,
            first: first ? parseInt(first) : undefined,
            last: last ? parseInt(last) : undefined,
            exclude,
            excludeFrom,
            patterns,
            patternsFrom,
            passphrase
        };

        const result = await borgmaticCLI.listArchives(repository, options);

        if (!result.success) {
            return res.status(500).json({ 
                success: false,
                detail: `Failed to list archives: ${result.error || result.stderr}` 
            });
        }

        res.json({
            success: true,
            data: {
                archives: result.stdout,
                repository: repository,
                command: result.command
            }
        });
    } catch (error) {
        console.error('Failed to list archives:', error.message);
        res.status(500).json({ 
            success: false,
            detail: 'Failed to list archives' 
        });
    }
});

/**
 * Get information about a specific archive
 * GET /api/archives/:archiveId/info?repository=/path/to/repo&json=true&prefix=prefix&pattern=glob&sortBy=date&first=10&last=5&oldest=7d&newest=1d&older=30d&newer=1d
 */
router.get('/:archiveId/info', authenticateToken, async (req, res) => {
    try {
        const { archiveId } = req.params;
        const { 
            repository, 
            json, 
            prefix, 
            pattern, 
            sortBy, 
            first, 
            last, 
            oldest, 
            newest, 
            older, 
            newer 
        } = req.query;

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
            json: json === 'true',
            prefix,
            pattern,
            sortBy,
            first: first ? parseInt(first) : undefined,
            last: last ? parseInt(last) : undefined,
            oldest,
            newest,
            older,
            newer,
            passphrase
        };

        const result = await borgmaticCLI.getArchiveInfo(repository, archiveId, options);

        if (!result.success) {
            return res.status(500).json({ 
                success: false,
                detail: `Failed to get archive info: ${result.error || result.stderr}` 
            });
        }

        res.json({
            success: true,
            data: {
                info: result.stdout,
                archive: archiveId,
                repository: repository,
                command: result.command
            }
        });
    } catch (error) {
        console.error('Failed to get archive info:', error.message);
        res.status(500).json({ 
            success: false,
            detail: 'Failed to get archive info' 
        });
    }
});

/**
 * Get contents of an archive
 * GET /api/archives/:archiveId/contents?repository=/path/to/repo&path=/subpath&find=pattern&short=true&format=json&json=true&pattern=glob&sortBy=date&first=10&last=5&exclude=pattern&excludeFrom=file&patterns=pattern&patternsFrom=file
 */
router.get('/:archiveId/contents', authenticateToken, async (req, res) => {
    try {
        const { archiveId } = req.params;
        const { 
            repository, 
            path, 
            find, 
            short, 
            format, 
            json, 
            pattern, 
            sortBy, 
            first, 
            last, 
            exclude, 
            excludeFrom, 
            patterns, 
            patternsFrom 
        } = req.query;

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
            find,
            short: short === 'true',
            format,
            json: json === 'true',
            pattern,
            sortBy,
            first: first ? parseInt(first) : undefined,
            last: last ? parseInt(last) : undefined,
            exclude,
            excludeFrom,
            patterns,
            patternsFrom,
            passphrase
        };

        const result = await borgmaticCLI.listArchiveContents(repository, archiveId, path || '', options);

        if (!result.success) {
            return res.status(500).json({ 
                success: false,
                detail: `Failed to get archive contents: ${result.error || result.stderr}` 
            });
        }

        res.json({
            success: true,
            data: {
                contents: result.stdout,
                archive: archiveId,
                repository: repository,
                path: path || '/',
                command: result.command
            }
        });
    } catch (error) {
        console.error('Failed to get archive contents:', error.message);
        res.status(500).json({ 
            success: false,
            detail: 'Failed to get archive contents' 
        });
    }
});

/**
 * Delete an archive
 * DELETE /api/archives/:archiveId?repository=/path/to/repo&list=true&stats=true&cacheOnly=true&force=true&keepSecurityInfo=true&saveSpace=true&checkpointInterval=1800&pattern=glob&sortBy=date&first=10&last=5&oldest=7d&newest=1d&older=30d&newer=1d
 */
router.delete('/:archiveId', authenticateToken, async (req, res) => {
    try {
        const { archiveId } = req.params;
        const { 
            repository, 
            list, 
            stats, 
            cacheOnly, 
            force, 
            keepSecurityInfo, 
            saveSpace, 
            checkpointInterval, 
            pattern, 
            sortBy, 
            first, 
            last, 
            oldest, 
            newest, 
            older, 
            newer 
        } = req.query;

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
            list: list === 'true',
            stats: stats === 'true',
            cacheOnly: cacheOnly === 'true',
            force: force === 'true',
            keepSecurityInfo: keepSecurityInfo === 'true',
            saveSpace: saveSpace === 'true',
            checkpointInterval: checkpointInterval ? parseInt(checkpointInterval) : undefined,
            pattern,
            sortBy,
            first: first ? parseInt(first) : undefined,
            last: last ? parseInt(last) : undefined,
            oldest,
            newest,
            older,
            newer,
            passphrase
        };

        const result = await borgmaticCLI.deleteArchive(repository, archiveId, options);

        if (!result.success) {
            return res.status(500).json({ 
                success: false,
                detail: `Failed to delete archive: ${result.error || result.stderr}` 
            });
        }

        res.json({
            success: true,
            data: {
                message: 'Archive deleted successfully',
                archive: archiveId,
                repository: repository,
                command: result.command,
                output: result.stdout
            }
        });
    } catch (error) {
        console.error('Failed to delete archive:', error.message);
        res.status(500).json({ 
            success: false,
            detail: 'Failed to delete archive' 
        });
    }
});

/**
 * Search for files across archives
 * GET /api/archives/search?repository=/path/to/repo&find=pattern&archive=name&path=/subpath&short=true&format=json&json=true&prefix=prefix&pattern=glob&sortBy=date&first=10&last=5&exclude=pattern&excludeFrom=file&patterns=pattern&patternsFrom=file
 */
router.get('/search', authenticateToken, async (req, res) => {
    try {
        const { 
            repository, 
            find, 
            archive, 
            path, 
            short, 
            format, 
            json, 
            prefix, 
            pattern, 
            sortBy, 
            first, 
            last, 
            exclude, 
            excludeFrom, 
            patterns, 
            patternsFrom 
        } = req.query;

        if (!repository) {
            return res.status(400).json({ 
                success: false,
                detail: 'Repository parameter is required' 
            });
        }

        if (!find) {
            return res.status(400).json({ 
                success: false,
                detail: 'Find parameter is required for search' 
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
            archive,
            path,
            find,
            short: short === 'true',
            format,
            json: json === 'true',
            prefix,
            pattern,
            sortBy,
            first: first ? parseInt(first) : undefined,
            last: last ? parseInt(last) : undefined,
            exclude,
            excludeFrom,
            patterns,
            patternsFrom,
            passphrase
        };

        const result = await borgmaticCLI.listArchives(repository, options);

        if (!result.success) {
            return res.status(500).json({ 
                success: false,
                detail: `Failed to search archives: ${result.error || result.stderr}` 
            });
        }

        res.json({
            success: true,
            data: {
                results: result.stdout,
                searchPattern: find,
                repository: repository,
                command: result.command
            }
        });
    } catch (error) {
        console.error('Failed to search archives:', error.message);
        res.status(500).json({ 
            success: false,
            detail: 'Failed to search archives' 
        });
    }
});

/**
 * Get archive statistics
 * GET /api/archives/:archiveId/stats?repository=/path/to/repo&json=true
 */
router.get('/:archiveId/stats', authenticateToken, async (req, res) => {
    try {
        const { archiveId } = req.params;
        const { repository, json } = req.query;

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
            json: json === 'true',
            passphrase
        };

        const result = await borgmaticCLI.getArchiveInfo(repository, archiveId, options);

        if (!result.success) {
            return res.status(500).json({ 
                success: false,
                detail: `Failed to get archive stats: ${result.error || result.stderr}` 
            });
        }

        res.json({
            success: true,
            data: {
                stats: result.stdout,
                archive: archiveId,
                repository: repository,
                command: result.command
            }
        });
    } catch (error) {
        console.error('Failed to get archive stats:', error.message);
        res.status(500).json({ 
            success: false,
            detail: 'Failed to get archive stats' 
        });
    }
});

/**
 * Mount an archive for browsing
 * POST /api/archives/:archiveId/mount
 */
router.post('/:archiveId/mount', authenticateToken, async (req, res) => {
    try {
        const { archiveId } = req.params;
        const { repository, mountPoint, options: mountOptions } = req.body;

        if (!repository) {
            return res.status(400).json({ 
                success: false,
                detail: 'Repository parameter is required' 
            });
        }

        if (!mountPoint) {
            return res.status(400).json({ 
                success: false,
                detail: 'Mount point is required' 
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
            mountPoint,
            ...mountOptions,
            passphrase
        };

        const result = await borgmaticCLI.mountRepository(repository, archiveId, options);

        if (!result.success) {
            return res.status(500).json({ 
                success: false,
                detail: `Failed to mount archive: ${result.error || result.stderr}` 
            });
        }

        res.json({
            success: true,
            data: {
                message: 'Archive mounted successfully',
                archive: archiveId,
                repository: repository,
                mountPoint: mountPoint,
                command: result.command
            }
        });
    } catch (error) {
        console.error('Failed to mount archive:', error.message);
        res.status(500).json({ 
            success: false,
            detail: 'Failed to mount archive' 
        });
    }
});

/**
 * Unmount an archive
 * POST /api/archives/:archiveId/unmount
 */
router.post('/:archiveId/unmount', authenticateToken, async (req, res) => {
    try {
        const { archiveId } = req.params;
        const { mountPoint } = req.body;

        if (!mountPoint) {
            return res.status(400).json({ 
                success: false,
                detail: 'Mount point is required' 
            });
        }

        const result = await borgmaticCLI.unmountRepository(mountPoint);

        if (!result.success) {
            return res.status(500).json({ 
                success: false,
                detail: `Failed to unmount archive: ${result.error || result.stderr}` 
            });
        }

        res.json({
            success: true,
            data: {
                message: 'Archive unmounted successfully',
                archive: archiveId,
                mountPoint: mountPoint,
                command: result.command
            }
        });
    } catch (error) {
        console.error('Failed to unmount archive:', error.message);
        res.status(500).json({ 
            success: false,
            detail: 'Failed to unmount archive' 
        });
    }
});

/**
 * Recreate an archive with different settings
 * POST /api/archives/:archiveId/recreate
 */
router.post('/:archiveId/recreate', authenticateToken, async (req, res) => {
    try {
        const { archiveId } = req.params;
        const { repository, list, stats, progress, dryRun, json, verbosity } = req.body;

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
            list: list === true,
            stats: stats === true,
            progress: progress === true,
            dryRun: dryRun === true,
            json: json === true,
            verbosity: verbosity || 1,
            passphrase
        };

        const result = await borgmaticCLI.recreateArchive(repository, archiveId, options);

        if (!result.success) {
            return res.status(500).json({ 
                success: false,
                detail: `Failed to recreate archive: ${result.error || result.stderr}` 
            });
        }

        res.json({
            success: true,
            data: {
                message: 'Archive recreated successfully',
                archive: archiveId,
                repository: repository,
                command: result.command,
                output: result.stdout
            }
        });
    } catch (error) {
        console.error('Failed to recreate archive:', error.message);
        res.status(500).json({ 
            success: false,
            detail: 'Failed to recreate archive' 
        });
    }
});

/**
 * Transfer archives between repositories
 * POST /api/archives/transfer
 */
router.post('/transfer', authenticateToken, async (req, res) => {
    try {
        const { sourceRepository, destinationRepository, archive, list, stats, progress, dryRun, json, verbosity } = req.body;

        if (!sourceRepository || !destinationRepository) {
            return res.status(400).json({ 
                success: false,
                detail: 'Source and destination repositories are required' 
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
            archive,
            list: list === true,
            stats: stats === true,
            progress: progress === true,
            dryRun: dryRun === true,
            json: json === true,
            verbosity: verbosity || 1,
            passphrase
        };

        const result = await borgmaticCLI.transferArchives(sourceRepository, destinationRepository, options);

        if (!result.success) {
            return res.status(500).json({ 
                success: false,
                detail: `Failed to transfer archives: ${result.error || result.stderr}` 
            });
        }

        res.json({
            success: true,
            data: {
                message: 'Archives transferred successfully',
                sourceRepository: sourceRepository,
                destinationRepository: destinationRepository,
                command: result.command,
                output: result.stdout
            }
        });
    } catch (error) {
        console.error('Failed to transfer archives:', error.message);
        res.status(500).json({ 
            success: false,
            detail: 'Failed to transfer archives' 
        });
    }
});

/**
 * Check archive integrity
 * POST /api/archives/check
 */
router.post('/check', authenticateToken, async (req, res) => {
    try {
        const { 
            repository, 
            archive, 
            repair, 
            verifyData, 
            last, 
            first, 
            prefix, 
            pattern, 
            sortBy, 
            oldest, 
            newest, 
            older, 
            newer, 
            json, 
            verbosity 
        } = req.body;

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
            archive,
            repair: repair === true,
            verifyData: verifyData === true,
            last: last ? parseInt(last) : undefined,
            first: first ? parseInt(first) : undefined,
            prefix,
            pattern,
            sortBy,
            oldest,
            newest,
            older,
            newer,
            json: json === true,
            verbosity: verbosity || 1,
            passphrase
        };

        const result = await borgmaticCLI.checkArchives(repository, options);

        if (!result.success) {
            return res.status(500).json({ 
                success: false,
                detail: `Failed to check archives: ${result.error || result.stderr}` 
            });
        }

        res.json({
            success: true,
            data: {
                message: 'Archive check completed',
                repository: repository,
                command: result.command,
                output: result.stdout
            }
        });
    } catch (error) {
        console.error('Failed to check archives:', error.message);
        res.status(500).json({ 
            success: false,
            detail: 'Failed to check archives' 
        });
    }
});

/**
 * Compact repository to free space
 * POST /api/archives/compact
 */
router.post('/compact', authenticateToken, async (req, res) => {
    try {
        const { 
            repository, 
            progress, 
            cleanupCommits, 
            threshold, 
            minRatio, 
            json, 
            verbosity 
        } = req.body;

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
            progress: progress === true,
            cleanupCommits: cleanupCommits === true,
            threshold: threshold ? parseInt(threshold) : undefined,
            minRatio: minRatio ? parseFloat(minRatio) : undefined,
            json: json === true,
            verbosity: verbosity || 1,
            passphrase
        };

        const result = await borgmaticCLI.compactRepository(repository, options);

        if (!result.success) {
            return res.status(500).json({ 
                success: false,
                detail: `Failed to compact repository: ${result.error || result.stderr}` 
            });
        }

        res.json({
            success: true,
            data: {
                message: 'Repository compacted successfully',
                repository: repository,
                command: result.command,
                output: result.stdout
            }
        });
    } catch (error) {
        console.error('Failed to compact repository:', error.message);
        res.status(500).json({ 
            success: false,
            detail: 'Failed to compact repository' 
        });
    }
});

/**
 * Export archive to tar file
 * POST /api/archives/:archiveId/export-tar
 */
router.post('/:archiveId/export-tar', authenticateToken, async (req, res) => {
    try {
        const { archiveId } = req.params;
        const { repository, destination, path, tarFilter, list, stripComponents } = req.body;

        if (!repository) {
            return res.status(400).json({ 
                success: false,
                detail: 'Repository parameter is required' 
            });
        }

        if (!destination) {
            return res.status(400).json({ 
                success: false,
                detail: 'Destination path is required' 
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
            path,
            tarFilter,
            list: list === true,
            stripComponents: stripComponents ? parseInt(stripComponents) : undefined,
            passphrase
        };

        const result = await borgmaticCLI.exportTar(repository, archiveId, destination, options);

        if (!result.success) {
            return res.status(500).json({ 
                success: false,
                detail: `Failed to export archive: ${result.error || result.stderr}` 
            });
        }

        res.json({
            success: true,
            data: {
                message: 'Archive exported successfully',
                archive: archiveId,
                repository: repository,
                destination: destination,
                command: result.command,
                output: result.stdout
            }
        });
    } catch (error) {
        console.error('Failed to export archive:', error.message);
        res.status(500).json({ 
            success: false,
            detail: 'Failed to export archive' 
        });
    }
});

module.exports = router;
