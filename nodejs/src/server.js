const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const https = require('https');
const http = require('http');
const fs = require('fs');
const authService = require('./services/auth');
const config = require('./config');

const app = express();
const PORT = config.port;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// HTTPS redirect middleware
app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https' && process.env.NODE_ENV === 'production') {
        res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
        next();
    }
});

// Import routes
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const repositoriesRoutes = require('./routes/repositories');
const backupRoutes = require('./routes/backup');
const archivesRoutes = require('./routes/archives');
const restoreRoutes = require('./routes/restore');
const healthRoutes = require('./routes/health');
const configRoutes = require('./routes/config');
const appriseRoutes = require('./routes/apprise');
const encryptionRoutes = require('./routes/encryption');
const passwordRoutes = require('./routes/passwords');
const borgmaticRoutes = require('./routes/borgmatic');
const scheduleRoutes = require('./routes/schedule');
const logsRoutes = require('./routes/logs');
const settingsRoutes = require('./routes/settings');
const eventsRoutes = require('./routes/events');
const sshKeysRoutes = require('./routes/ssh-keys');
const { eventManager } = require('./routes/events');
const monitoringIntegration = require('./services/monitoring-integration');

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/repositories', repositoriesRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/archives', archivesRoutes);
app.use('/api/restore', restoreRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/config', configRoutes);
app.use('/api/apprise', appriseRoutes);
app.use('/api/encryption', encryptionRoutes);
app.use('/api/passwords', passwordRoutes);
app.use('/api/borgmatic', borgmaticRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/ssh-keys', sshKeysRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        backend: 'nodejs'
    });
});

// Serve static files in production
if (config.nodeEnv === 'production') {
    const frontendBuildPath = path.join(__dirname, '../../frontend/build');
    
    // Serve static files from React build
    app.use(express.static(frontendBuildPath));
    
    // Handle React routing - return index.html for all non-API routes
    app.get('*', (req, res) => {
        // Don't serve index.html for API routes
        if (req.path.startsWith('/api/')) {
            return res.status(404).json({ error: 'API endpoint not found' });
        }
        
        // Serve index.html for all other routes (React Router)
        res.sendFile(path.join(frontendBuildPath, 'index.html'));
    });
} else {
    // Development mode - serve simple status page
    app.get('/', (req, res) => {
        res.send(`
            <html>
                <head><title>Borgmatic UI - Development</title></head>
                <body>
                    <h1>🚀 Borgmatic UI Backend</h1>
                    <p>Backend is running in development mode.</p>
                    <p>Frontend should be running on <a href="http://localhost:7879">http://localhost:7879</a></p>
                    <p>API available at <a href="/api/health">/api/health</a></p>
                </body>
            </html>
        `);
    });
}


// Initialize admin user on startup
async function initializeApp() {
    try {
        console.log('🔐 Initializing authentication system...');
        await authService.createFirstUser();
        console.log('✅ Authentication system ready');
    } catch (error) {
        console.error('❌ Failed to initialize authentication:', error.message);
    }
}

// Create self-signed certificate if it doesn't exist
function createSelfSignedCert() {
    const certPath = path.join(process.cwd(), 'ssl', 'cert.pem');
    const keyPath = path.join(process.cwd(), 'ssl', 'key.pem');
    
    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
        console.log('🔐 Creating self-signed certificate...');
        
        // Create ssl directory if it doesn't exist
        const sslDir = path.join(process.cwd(), 'ssl');
        if (!fs.existsSync(sslDir)) {
            fs.mkdirSync(sslDir, { recursive: true });
        }
        
        // Generate self-signed certificate using OpenSSL
        const { execSync } = require('child_process');
        try {
            execSync(`openssl req -x509 -newkey rsa:4096 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"`, { stdio: 'pipe' });
            console.log('✅ Self-signed certificate created');
        } catch (error) {
            console.error('❌ Failed to create self-signed certificate:', error.message);
            console.log('💡 Please install OpenSSL or manually create SSL certificates');
            return null;
        }
    }
    
    return { certPath, keyPath };
}

// Start server with HTTPS support
async function startServer() {
    console.log(`🚀 Borgmatic UI Server starting...`);
    console.log(`📁 Working directory: ${process.cwd()}`);
    console.log(`🔧 Environment: ${config.nodeEnv}`);
    
    // Initialize admin user
    await initializeApp();
    
    // Start background tasks for real-time events
    try {
        eventManager.startBackgroundTasks();
        console.log('📡 Started real-time event monitoring');
    } catch (error) {
        console.error('❌ Failed to start event monitoring:', error.message);
    }
    
    // Initialize monitoring integration
    try {
        await monitoringIntegration.initialize();
        console.log('🔔 Monitoring integration ready');
    } catch (error) {
        console.error('❌ Failed to initialize monitoring integration:', error.message);
    }
    
    // Try to start HTTPS server
    const sslPaths = createSelfSignedCert();
    
    if (sslPaths && fs.existsSync(sslPaths.certPath) && fs.existsSync(sslPaths.keyPath)) {
        try {
            const httpsOptions = {
                key: fs.readFileSync(sslPaths.keyPath),
                cert: fs.readFileSync(sslPaths.certPath)
            };
            
            // Start HTTPS server
            const httpsServer = https.createServer(httpsOptions, app);
            httpsServer.listen(8448, () => {
                console.log(`🔒 HTTPS Server running on port 8448`);
                console.log(`🌐 Access: https://localhost:8448`);
            });
            
            // Start HTTP server for API access (no redirects for API calls)
            const httpServer = http.createServer((req, res) => {
                // Don't redirect API calls - serve them directly
                if (req.url.startsWith('/api/')) {
                    // Serve API requests directly
                    app(req, res);
                } else {
                    // Redirect non-API requests to HTTPS
                    res.writeHead(301, { "Location": `https://${req.headers.host.replace(':8000', ':8448')}${req.url}` });
                    res.end();
                }
            });
            httpServer.listen(PORT, () => {
                console.log(`🔄 HTTP Server running on port ${PORT} (API access + redirects to HTTPS)`);
            });
            
        } catch (error) {
            console.error('❌ Failed to start HTTPS server:', error.message);
            console.log('🔄 Falling back to HTTP only...');
            startHttpServer();
        }
    } else {
        console.log('🔄 Starting HTTP server (no SSL certificates found)...');
        startHttpServer();
    }
}

function startHttpServer() {
    app.listen(PORT, () => {
        console.log(`🌐 HTTP Server running on port ${PORT}`);
        console.log(`🔗 Access: http://localhost:${PORT}`);
    });
}

// Start the server
startServer();

// Graceful shutdown handling
process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    eventManager.cleanup();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    eventManager.cleanup();
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    eventManager.cleanup();
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    eventManager.cleanup();
    process.exit(1);
});
