const authService = require('../services/auth');

/**
 * Middleware to authenticate JWT tokens
 */
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({ 
                detail: 'Could not validate credentials',
                error: 'No token provided'
            });
        }

        const decoded = authService.verifyToken(token);
        if (!decoded) {
            return res.status(401).json({ 
                detail: 'Could not validate credentials',
                error: 'Invalid token'
            });
        }

        // Get user from YAML file
        const user = await authService.getUserProfile(decoded.sub);
        if (!user) {
            return res.status(401).json({ 
                detail: 'Could not validate credentials',
                error: 'User not found'
            });
        }

        if (!user.is_active) {
            return res.status(400).json({ 
                detail: 'Inactive user',
                error: 'User account is disabled'
            });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Authentication middleware error:', error.message);
        return res.status(401).json({ 
            detail: 'Could not validate credentials',
            error: 'Authentication failed'
        });
    }
};

/**
 * Middleware to require admin privileges
 */
const requireAdmin = (req, res, next) => {
    if (!req.user || !req.user.is_admin) {
        return res.status(403).json({ 
            detail: 'Not enough permissions',
            error: 'Admin access required'
        });
    }
    next();
};

/**
 * Middleware to require active user
 */
const requireActiveUser = (req, res, next) => {
    if (!req.user || !req.user.is_active) {
        return res.status(400).json({ 
            detail: 'Inactive user',
            error: 'User account is disabled'
        });
    }
    next();
};

module.exports = {
    authenticateToken,
    requireAdmin,
    requireActiveUser
};
