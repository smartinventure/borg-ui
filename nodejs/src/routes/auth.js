const express = require('express');
const router = express.Router();
const authService = require('../services/auth');
const { authenticateToken } = require('../middleware/auth');

/**
 * Login endpoint
 */
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ 
                detail: 'Username and password are required' 
            });
        }

        const user = await authService.authenticateUser(username, password);
        if (!user) {
            return res.status(401).json({ 
                detail: 'Username or password incorrect!' 
            });
        }

        // Update last login
        await authService.updateLastLogin(username);

        // Create JWT token
        const token = authService.createAccessToken({ sub: username });
        const expiresIn = 1440 * 60; // 24 hours in seconds

        res.json({
            access_token: token,
            token_type: 'bearer',
            expires_in: expiresIn
        });
    } catch (error) {
        console.error('Login error:', error.message);
        res.status(500).json({ 
            detail: 'Internal server error' 
        });
    }
});

/**
 * Logout endpoint (client-side token removal)
 */
router.post('/logout', (req, res) => {
    // JWT tokens are stateless, so logout is handled client-side
    res.json({ 
        message: 'Logged out successfully' 
    });
});

/**
 * Get current user profile
 */
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await authService.getUserProfile(req.user.username);
        if (!user) {
            return res.status(404).json({ 
                detail: 'User not found' 
            });
        }

        res.json(user);
    } catch (error) {
        console.error('Get profile error:', error.message);
        res.status(500).json({ 
            detail: 'Internal server error' 
        });
    }
});

/**
 * Change password endpoint
 */
router.post('/change-password', authenticateToken, async (req, res) => {
    try {
        const { current_password, new_password } = req.body;

        if (!current_password || !new_password) {
            return res.status(400).json({ 
                detail: 'Current password and new password are required' 
            });
        }

        // Verify current password
        const user = await authService.loadAdminUser();
        if (!user) {
            return res.status(404).json({ 
                detail: 'User not found' 
            });
        }

        const isValidPassword = await authService.verifyPassword(current_password, user.password_hash);
        if (!isValidPassword) {
            return res.status(400).json({ 
                detail: 'Current password is incorrect' 
            });
        }

        // Update password
        const newHashedPassword = await authService.hashPassword(new_password);
        user.password_hash = newHashedPassword;
        
        const saved = await authService.saveAdminUser(user);
        if (!saved) {
            return res.status(500).json({ 
                detail: 'Failed to update password' 
            });
        }

        res.json({ 
            message: 'Password updated successfully' 
        });
    } catch (error) {
        console.error('Change password error:', error.message);
        res.status(500).json({ 
            detail: 'Internal server error' 
        });
    }
});

module.exports = router;
