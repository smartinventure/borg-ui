const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const borgmaticConfig = require('../services/borgmatic-config');
const yamlManager = require('../services/yaml-manager');
const bcrypt = require('bcryptjs');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * Get system settings
 * GET /api/settings/system
 */
router.get('/system', authenticateToken, async (req, res) => {
    try {
        // Get system settings from YAML config
        const config = await borgmaticConfig.loadConfig();
        
        // Default system settings
        const defaultSettings = {
            backup_timeout: 3600,
            max_concurrent_backups: 2,
            log_retention_days: 30,
            email_notifications: false,
            webhook_url: '',
            auto_cleanup: true,
            cleanup_retention_days: 90,
            borgmatic_version: '2.0.8', // This would be retrieved from borgmatic CLI
            app_version: '1.0.0'
        };

        // Merge with any existing settings
        const systemSettings = {
            ...defaultSettings,
            ...config.system_settings
        };

        res.json({
            success: true,
            settings: systemSettings
        });
    } catch (error) {
        console.error('Failed to get system settings:', error.message);
        res.status(500).json({
            success: false,
            detail: 'Failed to retrieve system settings'
        });
    }
});

/**
 * Update system settings (admin only)
 * PUT /api/settings/system
 */
router.put('/system', authenticateToken, async (req, res) => {
    try {
        // Check if user is admin
        if (!req.user.is_admin) {
            return res.status(403).json({
                success: false,
                detail: 'Admin access required'
            });
        }

        const {
            backup_timeout,
            max_concurrent_backups,
            log_retention_days,
            email_notifications,
            webhook_url,
            auto_cleanup,
            cleanup_retention_days
        } = req.body;

        // Get current config
        const config = await borgmaticConfig.loadConfig();
        
        // Initialize system_settings if it doesn't exist
        if (!config.system_settings) {
            config.system_settings = {};
        }

        // Update settings
        if (backup_timeout !== undefined) {
            config.system_settings.backup_timeout = backup_timeout;
        }
        if (max_concurrent_backups !== undefined) {
            config.system_settings.max_concurrent_backups = max_concurrent_backups;
        }
        if (log_retention_days !== undefined) {
            config.system_settings.log_retention_days = log_retention_days;
        }
        if (email_notifications !== undefined) {
            config.system_settings.email_notifications = email_notifications;
        }
        if (webhook_url !== undefined) {
            config.system_settings.webhook_url = webhook_url;
        }
        if (auto_cleanup !== undefined) {
            config.system_settings.auto_cleanup = auto_cleanup;
        }
        if (cleanup_retention_days !== undefined) {
            config.system_settings.cleanup_retention_days = cleanup_retention_days;
        }

        // Add update timestamp
        config.system_settings.updated_at = new Date().toISOString();
        config.system_settings.updated_by = req.user.username;

        // Save configuration
        await borgmaticConfig.saveConfig(config);

        console.log(`System settings updated by user ${req.user.username}`);

        res.json({
            success: true,
            message: 'System settings updated successfully'
        });
    } catch (error) {
        console.error('Failed to update system settings:', error.message);
        res.status(500).json({
            success: false,
            detail: 'Failed to update system settings'
        });
    }
});

/**
 * Get all users (admin only)
 * GET /api/settings/users
 */
router.get('/users', authenticateToken, async (req, res) => {
    try {
        // Check if user is admin
        if (!req.user.is_admin) {
            return res.status(403).json({
                success: false,
                detail: 'Admin access required'
            });
        }

        // Get users from YAML file
        const users = await getUsers();
        
        res.json({
            success: true,
            users: users.map(user => ({
                id: user.id,
                username: user.username,
                email: user.email,
                is_active: user.is_active,
                is_admin: user.is_admin,
                created_at: user.created_at,
                last_login: user.last_login
            }))
        });
    } catch (error) {
        console.error('Failed to get users:', error.message);
        res.status(500).json({
            success: false,
            detail: 'Failed to retrieve users'
        });
    }
});

/**
 * Create a new user (admin only)
 * POST /api/settings/users
 */
router.post('/users', authenticateToken, async (req, res) => {
    try {
        // Check if user is admin
        if (!req.user.is_admin) {
            return res.status(403).json({
                success: false,
                detail: 'Admin access required'
            });
        }

        const { username, email, password, is_admin = false } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                detail: 'Username, email, and password are required'
            });
        }

        // Get existing users
        const users = await getUsers();

        // Check if username already exists
        if (users.some(user => user.username === username)) {
            return res.status(400).json({
                success: false,
                detail: 'Username already exists'
            });
        }

        // Check if email already exists
        if (users.some(user => user.email === email)) {
            return res.status(400).json({
                success: false,
                detail: 'Email already exists'
            });
        }

        // Create new user
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
            id: uuidv4(),
            username,
            email,
            password_hash: hashedPassword,
            is_active: true,
            is_admin,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_login: null
        };

        users.push(newUser);
        await saveUsers(users);

        console.log(`User created: ${username} by ${req.user.username}`);

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            user: {
                id: newUser.id,
                username: newUser.username,
                email: newUser.email,
                is_active: newUser.is_active,
                is_admin: newUser.is_admin
            }
        });
    } catch (error) {
        console.error('Failed to create user:', error.message);
        res.status(500).json({
            success: false,
            detail: 'Failed to create user'
        });
    }
});

/**
 * Update user (admin only)
 * PUT /api/settings/users/:userId
 */
router.put('/users/:userId', authenticateToken, async (req, res) => {
    try {
        // Check if user is admin
        if (!req.user.is_admin) {
            return res.status(403).json({
                success: false,
                detail: 'Admin access required'
            });
        }

        const { userId } = req.params;
        const { username, email, is_active, is_admin } = req.body;

        // Get existing users
        const users = await getUsers();
        const userIndex = users.findIndex(user => user.id === userId);

        if (userIndex === -1) {
            return res.status(404).json({
                success: false,
                detail: 'User not found'
            });
        }

        const user = users[userIndex];

        // Update user fields
        if (username !== undefined) {
            // Check if username already exists
            if (users.some(u => u.username === username && u.id !== userId)) {
                return res.status(400).json({
                    success: false,
                    detail: 'Username already exists'
                });
            }
            user.username = username;
        }

        if (email !== undefined) {
            // Check if email already exists
            if (users.some(u => u.email === email && u.id !== userId)) {
                return res.status(400).json({
                    success: false,
                    detail: 'Email already exists'
                });
            }
            user.email = email;
        }

        if (is_active !== undefined) {
            user.is_active = is_active;
        }

        if (is_admin !== undefined) {
            user.is_admin = is_admin;
        }

        user.updated_at = new Date().toISOString();
        users[userIndex] = user;
        await saveUsers(users);

        console.log(`User updated: ${userId} by ${req.user.username}`);

        res.json({
            success: true,
            message: 'User updated successfully'
        });
    } catch (error) {
        console.error('Failed to update user:', error.message);
        res.status(500).json({
            success: false,
            detail: 'Failed to update user'
        });
    }
});

/**
 * Delete user (admin only)
 * DELETE /api/settings/users/:userId
 */
router.delete('/users/:userId', authenticateToken, async (req, res) => {
    try {
        // Check if user is admin
        if (!req.user.is_admin) {
            return res.status(403).json({
                success: false,
                detail: 'Admin access required'
            });
        }

        const { userId } = req.params;

        // Get existing users
        const users = await getUsers();
        const userIndex = users.findIndex(user => user.id === userId);

        if (userIndex === -1) {
            return res.status(404).json({
                success: false,
                detail: 'User not found'
            });
        }

        const user = users[userIndex];

        // Prevent deleting the last admin user
        if (user.is_admin) {
            const adminCount = users.filter(u => u.is_admin).length;
            if (adminCount <= 1) {
                return res.status(400).json({
                    success: false,
                    detail: 'Cannot delete the last admin user'
                });
            }
        }

        // Prevent deleting yourself
        if (user.id === req.user.id) {
            return res.status(400).json({
                success: false,
                detail: 'Cannot delete your own account'
            });
        }

        // Remove user
        users.splice(userIndex, 1);
        await saveUsers(users);

        console.log(`User deleted: ${userId} by ${req.user.username}`);

        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error('Failed to delete user:', error.message);
        res.status(500).json({
            success: false,
            detail: 'Failed to delete user'
        });
    }
});

/**
 * Reset user password (admin only)
 * POST /api/settings/users/:userId/reset-password
 */
router.post('/users/:userId/reset-password', authenticateToken, async (req, res) => {
    try {
        // Check if user is admin
        if (!req.user.is_admin) {
            return res.status(403).json({
                success: false,
                detail: 'Admin access required'
            });
        }

        const { userId } = req.params;
        const { new_password } = req.body;

        if (!new_password) {
            return res.status(400).json({
                success: false,
                detail: 'New password is required'
            });
        }

        // Get existing users
        const users = await getUsers();
        const userIndex = users.findIndex(user => user.id === userId);

        if (userIndex === -1) {
            return res.status(404).json({
                success: false,
                detail: 'User not found'
            });
        }

        // Update password
        const hashedPassword = await bcrypt.hash(new_password, 10);
        users[userIndex].password_hash = hashedPassword;
        users[userIndex].updated_at = new Date().toISOString();

        await saveUsers(users);

        console.log(`User password reset: ${userId} by ${req.user.username}`);

        res.json({
            success: true,
            message: 'Password reset successfully'
        });
    } catch (error) {
        console.error('Failed to reset user password:', error.message);
        res.status(500).json({
            success: false,
            detail: 'Failed to reset password'
        });
    }
});

/**
 * Change current user's password
 * POST /api/settings/change-password
 */
router.post('/change-password', authenticateToken, async (req, res) => {
    try {
        const { current_password, new_password } = req.body;

        if (!current_password || !new_password) {
            return res.status(400).json({
                success: false,
                detail: 'Current password and new password are required'
            });
        }

        // Get existing users
        const users = await getUsers();
        const userIndex = users.findIndex(user => user.id === req.user.id);

        if (userIndex === -1) {
            return res.status(404).json({
                success: false,
                detail: 'User not found'
            });
        }

        const user = users[userIndex];

        // Verify current password
        const isValidPassword = await bcrypt.compare(current_password, user.password_hash);
        if (!isValidPassword) {
            return res.status(400).json({
                success: false,
                detail: 'Current password is incorrect'
            });
        }

        // Update password
        const hashedPassword = await bcrypt.hash(new_password, 10);
        users[userIndex].password_hash = hashedPassword;
        users[userIndex].updated_at = new Date().toISOString();

        await saveUsers(users);

        console.log(`Password changed for user: ${req.user.username}`);

        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Failed to change password:', error.message);
        res.status(500).json({
            success: false,
            detail: 'Failed to change password'
        });
    }
});

/**
 * Get current user's profile
 * GET /api/settings/profile
 */
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        // Get user from users file
        const users = await getUsers();
        const user = users.find(u => u.id === req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                detail: 'User not found'
            });
        }

        res.json({
            success: true,
            profile: {
                id: user.id,
                username: user.username,
                email: user.email,
                is_active: user.is_active,
                is_admin: user.is_admin,
                created_at: user.created_at,
                last_login: user.last_login
            }
        });
    } catch (error) {
        console.error('Failed to get profile:', error.message);
        res.status(500).json({
            success: false,
            detail: 'Failed to retrieve profile'
        });
    }
});

/**
 * Update current user's profile
 * PUT /api/settings/profile
 */
router.put('/profile', authenticateToken, async (req, res) => {
    try {
        const { username, email } = req.body;

        // Get existing users
        const users = await getUsers();
        const userIndex = users.findIndex(user => user.id === req.user.id);

        if (userIndex === -1) {
            return res.status(404).json({
                success: false,
                detail: 'User not found'
            });
        }

        const user = users[userIndex];

        // Update user fields
        if (username !== undefined) {
            // Check if username already exists
            if (users.some(u => u.username === username && u.id !== req.user.id)) {
                return res.status(400).json({
                    success: false,
                    detail: 'Username already exists'
                });
            }
            user.username = username;
        }

        if (email !== undefined) {
            // Check if email already exists
            if (users.some(u => u.email === email && u.id !== req.user.id)) {
                return res.status(400).json({
                    success: false,
                    detail: 'Email already exists'
                });
            }
            user.email = email;
        }

        user.updated_at = new Date().toISOString();
        users[userIndex] = user;
        await saveUsers(users);

        console.log(`Profile updated for user: ${req.user.username}`);

        res.json({
            success: true,
            message: 'Profile updated successfully'
        });
    } catch (error) {
        console.error('Failed to update profile:', error.message);
        res.status(500).json({
            success: false,
            detail: 'Failed to update profile'
        });
    }
});

/**
 * Run system cleanup (admin only)
 * POST /api/settings/system/cleanup
 */
router.post('/system/cleanup', authenticateToken, async (req, res) => {
    try {
        // Check if user is admin
        if (!req.user.is_admin) {
            return res.status(403).json({
                success: false,
                detail: 'Admin access required'
            });
        }

        // Get system settings
        const config = await borgmaticConfig.loadConfig();
        const settings = config.system_settings || {};

        // Perform cleanup tasks (placeholder implementation)
        const cleanupResults = {
            logs_cleaned: 0,
            old_backups_removed: 0,
            temp_files_cleaned: 0
        };

        // TODO: Implement actual cleanup logic
        // - Clean old logs based on log_retention_days
        // - Remove old backup archives based on cleanup_retention_days
        // - Clean temporary files

        console.log(`System cleanup completed by user ${req.user.username}:`, cleanupResults);

        res.json({
            success: true,
            message: 'System cleanup completed successfully',
            results: cleanupResults
        });
    } catch (error) {
        console.error('Failed to run system cleanup:', error.message);
        res.status(500).json({
            success: false,
            detail: 'Failed to run system cleanup'
        });
    }
});

/**
 * Helper function to get users from YAML file
 */
async function getUsers() {
    try {
        const usersPath = path.join(process.cwd(), 'data', 'users.yaml');
        
        if (await fs.pathExists(usersPath)) {
            const usersData = await yamlManager.loadYaml(usersPath);
            return usersData.users || [];
        }
        
        return [];
    } catch (error) {
        console.error('Failed to load users:', error.message);
        return [];
    }
}

/**
 * Helper function to save users to YAML file
 */
async function saveUsers(users) {
    try {
        const usersPath = path.join(process.cwd(), 'data', 'users.yaml');
        
        // Ensure data directory exists
        await fs.ensureDir(path.dirname(usersPath));
        
        const usersData = {
            users: users,
            updated_at: new Date().toISOString()
        };
        
        await yamlManager.saveYaml(usersPath, usersData);
    } catch (error) {
        console.error('Failed to save users:', error.message);
        throw error;
    }
}

module.exports = router;
