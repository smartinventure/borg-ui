#!/usr/bin/env node

/**
 * Reset Admin Password Utility
 * Usage: node src/utils/reset-admin.js [new-password]
 */

const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const config = require('../config');

class AdminPasswordReset {
    constructor() {
        this.adminConfigPath = config.adminConfigPath;
    }

    /**
     * Generate a secure random password
     */
    generateSecurePassword() {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        return Array.from({ length: 20 }, () => 
            alphabet[crypto.randomInt(0, alphabet.length)]
        ).join('');
    }

    /**
     * Reset admin password
     */
    async resetPassword(newPassword = null) {
        try {
            // Generate password if not provided
            const password = newPassword || this.generateSecurePassword();
            
            // Hash the password
            const hashedPassword = await bcrypt.hash(password, 12);
            
            // Load existing admin config or create new one
            let adminConfig = {};
            if (await fs.pathExists(this.adminConfigPath)) {
                const content = await fs.readFile(this.adminConfigPath, 'utf8');
                adminConfig = yaml.load(content) || {};
            }
            
            // Update admin user
            adminConfig.admin = {
                username: 'admin',
                password_hash: hashedPassword,
                email: 'admin@borgmatic.local',
                is_active: true,
                is_admin: true,
                created_at: adminConfig.admin?.created_at || new Date().toISOString(),
                updated_at: new Date().toISOString(),
                last_login: adminConfig.admin?.last_login || null
            };
            
            // Ensure directory exists
            await fs.ensureDir(path.dirname(this.adminConfigPath));
            
            // Save to YAML file
            await fs.writeFile(this.adminConfigPath, yaml.dump(adminConfig, {
                indent: 2,
                lineWidth: 120
            }));
            
            console.log('\n' + '='.repeat(60));
            console.log('🔐 ADMIN PASSWORD RESET');
            console.log('='.repeat(60));
            console.log(`Username: admin`);
            console.log(`Password: ${password}`);
            console.log('='.repeat(60));
            console.log('⚠️  STORE THIS SECURELY - WILL NOT BE SHOWN AGAIN!');
            console.log('='.repeat(60));
            console.log('✅ Admin password reset successfully!');
            
            return password;
        } catch (error) {
            console.error('❌ Failed to reset admin password:', error.message);
            process.exit(1);
        }
    }
}

// Command line interface
async function main() {
    const args = process.argv.slice(2);
    const newPassword = args[0] || null;
    
    console.log('🔧 Borgmatic UI - Admin Password Reset');
    console.log('=====================================');
    
    if (newPassword) {
        console.log('Using provided password...');
    } else {
        console.log('Generating secure random password...');
    }
    
    const resetter = new AdminPasswordReset();
    await resetter.resetPassword(newPassword);
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = AdminPasswordReset;
