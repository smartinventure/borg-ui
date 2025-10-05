#!/usr/bin/env node

/**
 * SSL Certificate Generator
 * Creates self-signed SSL certificates for HTTPS development
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const sslDir = path.join(process.cwd(), 'ssl');
const certPath = path.join(sslDir, 'cert.pem');
const keyPath = path.join(sslDir, 'key.pem');

console.log('🔐 SSL Certificate Generator');
console.log('==========================');

// Create ssl directory if it doesn't exist
if (!fs.existsSync(sslDir)) {
    fs.mkdirSync(sslDir, { recursive: true });
    console.log('📁 Created SSL directory');
}

// Check if certificates already exist
if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    console.log('✅ SSL certificates already exist');
    console.log(`📄 Certificate: ${certPath}`);
    console.log(`🔑 Private Key: ${keyPath}`);
    process.exit(0);
}

console.log('🔧 Generating self-signed certificate...');

try {
    // Generate self-signed certificate
    const command = `openssl req -x509 -newkey rsa:4096 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/C=US/ST=State/L=City/O=BorgmaticUI/CN=localhost"`;
    
    execSync(command, { 
        stdio: 'pipe',
        cwd: process.cwd()
    });
    
    console.log('✅ Self-signed certificate generated successfully!');
    console.log(`📄 Certificate: ${certPath}`);
    console.log(`🔑 Private Key: ${keyPath}`);
    console.log('');
    console.log('🔒 Certificate Details:');
    console.log('  - Valid for: 365 days');
    console.log('  - Key size: 4096 bits');
    console.log('  - Subject: CN=localhost');
    console.log('');
    console.log('⚠️  Note: This is a self-signed certificate for development only.');
    console.log('   Your browser will show a security warning - this is normal.');
    console.log('   Click "Advanced" and "Proceed to localhost" to continue.');
    
} catch (error) {
    console.error('❌ Failed to generate SSL certificate:', error.message);
    console.log('');
    console.log('💡 Solutions:');
    console.log('  1. Install OpenSSL: https://www.openssl.org/');
    console.log('  2. On Windows: Install Git for Windows (includes OpenSSL)');
    console.log('  3. On macOS: brew install openssl');
    console.log('  4. On Linux: sudo apt-get install openssl');
    console.log('');
    console.log('🔄 The server will fall back to HTTP-only mode.');
    process.exit(1);
}
