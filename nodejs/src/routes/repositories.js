const express = require('express');
const router = express.Router();
const borgmaticConfig = require('../services/borgmatic-config');
const borgmaticCLI = require('../services/borgmatic-cli');
const { authenticateToken } = require('../middleware/auth');
const fs = require('fs-extra');
const path = require('path');

/**
 * Get all repositories
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const repositories = await borgmaticConfig.getRepositories();
        res.json({
            success: true,
            data: {
                repositories: repositories.map((repo, index) => ({
                    id: index + 1,
                    name: repo.label || `Repository ${index + 1}`,
                    path: repo.path,
                    encryption: repo.encryption || 'none',
                    compression: 'lz4', // Default compression
                    last_backup: null,
                    total_size: null,
                    archive_count: 0,
                    is_active: true,
                    created_at: new Date().toISOString(),
                    updated_at: null
                }))
            }
        });
    } catch (error) {
        console.error('Failed to get repositories:', error.message);
        res.status(500).json({ detail: 'Failed to get repositories' });
    }
});

/**
 * Create a new repository
 */
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { name, path: repoPath, encryption, compression, passphrase, repository_type, host, port, username, ssh_key_id } = req.body;

        if (!name || !repoPath) {
            return res.status(400).json({ detail: 'Name and path are required' });
        }

        // Add repository to borgmatic configuration
        const repositoryData = {
            path: repoPath,
            encryption: encryption || 'repokey-blake2',
            label: name
        };

        await borgmaticConfig.addRepository(repositoryData);

        // If encryption is not 'none', set the passphrase
        if (encryption && encryption !== 'none' && passphrase) {
            await borgmaticConfig.updateGlobalEncryptionPassphrase(passphrase);
        }

        res.status(201).json({
            success: true,
            message: 'Repository created successfully',
            data: {
                id: Date.now(), // Simple ID generation
                name,
                path: repoPath,
                encryption,
                compression,
                is_active: true,
                created_at: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Failed to create repository:', error.message);
        res.status(500).json({ detail: 'Failed to create repository' });
    }
});

/**
 * Test if a path exists and is writable
 */
router.post('/test-path', authenticateToken, async (req, res) => {
    try {
        const { path: testPath } = req.body;

        if (!testPath) {
            return res.status(400).json({ detail: 'Path is required' });
        }

        const fullPath = path.resolve(testPath);
        
        try {
            // Check if path exists
            const exists = await fs.pathExists(fullPath);
            
            if (exists) {
                // Test if we can write to it
                const testFile = path.join(fullPath, '.borgmatic-test-write');
                await fs.writeFile(testFile, 'test');
                await fs.remove(testFile);
                
                res.json({
                    success: true,
                    exists: true,
                    writable: true,
                    message: 'Path exists and is writable'
                });
            } else {
                res.json({
                    success: true,
                    exists: false,
                    writable: false,
                    message: 'Path does not exist'
                });
            }
        } catch (error) {
            res.json({
                success: false,
                exists: false,
                writable: false,
                message: `Path test failed: ${error.message}`
            });
        }
    } catch (error) {
        console.error('Failed to test path:', error.message);
        res.status(500).json({ detail: 'Failed to test path' });
    }
});

/**
 * Create a directory path
 */
router.post('/create-path', authenticateToken, async (req, res) => {
    try {
        const { path: createPath } = req.body;

        if (!createPath) {
            return res.status(400).json({ detail: 'Path is required' });
        }

        const fullPath = path.resolve(createPath);
        
        try {
            // Create the directory
            await fs.ensureDir(fullPath);
            
            // Test if we can write to it
            const testFile = path.join(fullPath, '.borgmatic-test-write');
            await fs.writeFile(testFile, 'test');
            await fs.remove(testFile);
            
            res.json({
                success: true,
                message: 'Path created successfully and is writable'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: `Failed to create path: ${error.message}`
            });
        }
    } catch (error) {
        console.error('Failed to create path:', error.message);
        res.status(500).json({ detail: 'Failed to create path' });
    }
});

/**
 * Get repository by ID
 */
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const repositories = await borgmaticConfig.getRepositories();
        const repoIndex = parseInt(req.params.id) - 1;
        
        if (repoIndex < 0 || repoIndex >= repositories.length) {
            return res.status(404).json({ detail: 'Repository not found' });
        }

        const repo = repositories[repoIndex];
        res.json({
            success: true,
            data: {
                id: parseInt(req.params.id),
                name: repo.label || `Repository ${req.params.id}`,
                path: repo.path,
                encryption: repo.encryption || 'none',
                compression: 'lz4',
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: null
            }
        });
    } catch (error) {
        console.error('Failed to get repository:', error.message);
        res.status(500).json({ detail: 'Failed to get repository' });
    }
});

/**
 * Update repository
 */
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { name, path: repoPath, compression, is_active } = req.body;
        const repositories = await borgmaticConfig.getRepositories();
        const repoIndex = parseInt(req.params.id) - 1;
        
        if (repoIndex < 0 || repoIndex >= repositories.length) {
            return res.status(404).json({ detail: 'Repository not found' });
        }

        const repo = repositories[repoIndex];
        
        // Update repository data
        const updatedRepo = {
            ...repo,
            label: name || repo.label,
            path: repoPath || repo.path
        };

        await borgmaticConfig.updateRepository(repo.path, updatedRepo);

        res.json({
            success: true,
            message: 'Repository updated successfully',
            data: {
                id: parseInt(req.params.id),
                name: updatedRepo.label,
                path: updatedRepo.path,
                compression,
                is_active,
                updated_at: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Failed to update repository:', error.message);
        res.status(500).json({ detail: 'Failed to update repository' });
    }
});

/**
 * Delete repository
 */
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const repositories = await borgmaticConfig.getRepositories();
        const repoIndex = parseInt(req.params.id) - 1;
        
        if (repoIndex < 0 || repoIndex >= repositories.length) {
            return res.status(404).json({ detail: 'Repository not found' });
        }

        const repo = repositories[repoIndex];
        await borgmaticConfig.removeRepository(repo.path);

        res.json({
            success: true,
            message: 'Repository deleted successfully'
        });
    } catch (error) {
        console.error('Failed to delete repository:', error.message);
        res.status(500).json({ detail: 'Failed to delete repository' });
    }
});

/**
 * Check repository
 */
router.post('/:id/check', authenticateToken, async (req, res) => {
    try {
        const repositories = await borgmaticConfig.getRepositories();
        const repoIndex = parseInt(req.params.id) - 1;
        
        if (repoIndex < 0 || repoIndex >= repositories.length) {
            return res.status(404).json({ detail: 'Repository not found' });
        }

        const repo = repositories[repoIndex];
        const result = await borgmaticCLI.checkRepository(repo.path);

        if (result.success) {
            res.json({
                success: true,
                message: 'Repository check completed successfully',
                output: result.stdout
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Repository check failed',
                error: result.error
            });
        }
    } catch (error) {
        console.error('Failed to check repository:', error.message);
        res.status(500).json({ detail: 'Failed to check repository' });
    }
});

/**
 * Compact repository
 */
router.post('/:id/compact', authenticateToken, async (req, res) => {
    try {
        const repositories = await borgmaticConfig.getRepositories();
        const repoIndex = parseInt(req.params.id) - 1;
        
        if (repoIndex < 0 || repoIndex >= repositories.length) {
            return res.status(404).json({ detail: 'Repository not found' });
        }

        const repo = repositories[repoIndex];
        const result = await borgmaticCLI.compactRepository(repo.path);

        if (result.success) {
            res.json({
                success: true,
                message: 'Repository compaction completed successfully',
                output: result.stdout
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Repository compaction failed',
                error: result.error
            });
        }
    } catch (error) {
        console.error('Failed to compact repository:', error.message);
        res.status(500).json({ detail: 'Failed to compact repository' });
    }
});

/**
 * Get repository stats
 */
router.get('/:id/stats', authenticateToken, async (req, res) => {
    try {
        const repositories = await borgmaticConfig.getRepositories();
        const repoIndex = parseInt(req.params.id) - 1;
        
        if (repoIndex < 0 || repoIndex >= repositories.length) {
            return res.status(404).json({ detail: 'Repository not found' });
        }

        const repo = repositories[repoIndex];
        const result = await borgmaticCLI.getRepositoryInfo(repo.path);

        if (result.success) {
            res.json({
                success: true,
                data: {
                    total_size: 'Unknown', // Would need to parse from borg info
                    archive_count: 0, // Would need to parse from borg list
                    last_backup: null
                }
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to get repository stats',
                error: result.error
            });
        }
    } catch (error) {
        console.error('Failed to get repository stats:', error.message);
        res.status(500).json({ detail: 'Failed to get repository stats' });
    }
});

module.exports = router;
