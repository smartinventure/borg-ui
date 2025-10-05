const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { execa } = require('execa');

/**
 * Password Manager Service
 * Handles all borgmatic password and credential methods
 * Based on: https://torsion.org/borgmatic/docs/how-to/provide-your-passwords/
 */
class PasswordManager {
    constructor() {
        this.credentialMethods = {
            'direct': {
                name: 'Direct Passphrase',
                description: 'Store passphrase directly in configuration',
                security: 'Medium',
                convenience: 'High',
                example: 'encryption_passphrase: yourpassphrase'
            },
            'environment': {
                name: 'Environment Variable',
                description: 'Read from environment variable',
                security: 'Low',
                convenience: 'High',
                example: 'encryption_passphrase: ${YOUR_PASSPHRASE}'
            },
            'file': {
                name: 'File-based Credentials',
                description: 'Read from file on filesystem',
                security: 'High',
                convenience: 'Medium',
                example: 'encryption_passphrase: "{credential file /credentials/borgmatic.txt}"'
            },
            'systemd': {
                name: 'systemd Credentials',
                description: 'Read from systemd encrypted credentials',
                security: 'Very High',
                convenience: 'Medium',
                example: 'encryption_passphrase: "{credential systemd borgmatic.pw}"'
            },
            'container': {
                name: 'Container Secrets',
                description: 'Read from Docker/Podman secrets',
                security: 'High',
                convenience: 'High',
                example: 'encryption_passphrase: "{credential container borgmatic_passphrase}"'
            },
            'keepassxc': {
                name: 'KeePassXC',
                description: 'Read from KeePassXC password manager',
                security: 'Very High',
                convenience: 'Low',
                example: 'encryption_passphrase: "{credential keepassxc /etc/keys.kdbx borgmatic}"'
            },
            'passcommand': {
                name: 'External Command',
                description: 'Execute command to get passphrase',
                security: 'High',
                convenience: 'Medium',
                example: 'encryption_passcommand: pass path/to/borg-passphrase'
            }
        };
    }

    /**
     * Get available credential methods
     */
    getCredentialMethods() {
        return this.credentialMethods;
    }

    /**
     * Generate secure passphrase
     */
    generateSecurePassphrase(length = 32, includeSpecial = true) {
        let alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        
        if (includeSpecial) {
            alphabet += '!@#$%^&*()_+-=[]{}|;:,.<>?';
        }

        return Array.from({ length }, () => 
            alphabet[crypto.randomInt(0, alphabet.length)]
        ).join('');
    }

    /**
     * Create file-based credential
     */
    async createFileCredential(credentialPath, passphrase) {
        try {
            await fs.ensureDir(path.dirname(credentialPath));
            await fs.writeFile(credentialPath, passphrase, 'utf8');
            
            // Set secure permissions (readable only by owner)
            await fs.chmod(credentialPath, 0o600);
            
            return {
                success: true,
                path: credentialPath,
                method: 'file',
                configValue: `{credential file ${credentialPath}}`
            };
        } catch (error) {
            console.error('Failed to create file credential:', error.message);
            throw error;
        }
    }

    /**
     * Create systemd credential
     */
    async createSystemdCredential(credentialName, passphrase) {
        try {
            const credentialPath = `/etc/credstore.encrypted/${credentialName}`;
            
            // Create the credential using systemd-creds
            const { stdout, stderr } = await execa('systemd-creds', [
                'encrypt',
                '--name', credentialName,
                '-',
                credentialPath
            ], {
                input: passphrase
            });

            if (stderr) {
                throw new Error(`systemd-creds error: ${stderr}`);
            }

            return {
                success: true,
                path: credentialPath,
                method: 'systemd',
                configValue: `{credential systemd ${credentialName}}`,
                systemdCommand: `systemd-ask-password -n | systemd-creds encrypt - ${credentialPath}`
            };
        } catch (error) {
            console.error('Failed to create systemd credential:', error.message);
            throw error;
        }
    }

    /**
     * Create container secret
     */
    async createContainerSecret(secretName, passphrase, secretsDir = '/run/secrets') {
        try {
            const secretPath = path.join(secretsDir, secretName);
            await fs.ensureDir(path.dirname(secretPath));
            await fs.writeFile(secretPath, passphrase, 'utf8');
            
            // Set secure permissions
            await fs.chmod(secretPath, 0o600);
            
            return {
                success: true,
                path: secretPath,
                method: 'container',
                configValue: `{credential container ${secretName}}`
            };
        } catch (error) {
            console.error('Failed to create container secret:', error.message);
            throw error;
        }
    }

    /**
     * Test KeePassXC credential
     */
    async testKeepassxcCredential(databasePath, entryTitle) {
        try {
            const { stdout, stderr } = await execa('keepassxc-cli', [
                'show',
                databasePath,
                entryTitle,
                '--password'
            ]);

            if (stderr && !stderr.includes('Password:')) {
                throw new Error(`KeePassXC error: ${stderr}`);
            }

            return {
                success: true,
                method: 'keepassxc',
                configValue: `{credential keepassxc ${databasePath} ${entryTitle}}`
            };
        } catch (error) {
            console.error('Failed to test KeePassXC credential:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Test external command
     */
    async testExternalCommand(command) {
        try {
            const { stdout, stderr } = await execa('sh', ['-c', command]);
            
            if (stderr) {
                throw new Error(`Command error: ${stderr}`);
            }

            return {
                success: true,
                method: 'passcommand',
                configValue: command,
                output: stdout.trim()
            };
        } catch (error) {
            console.error('Failed to test external command:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get password method recommendations
     */
    getPasswordMethodRecommendations() {
        return {
            'development': {
                recommended: 'direct',
                alternatives: ['environment', 'file'],
                reason: 'Simple setup for development'
            },
            'production': {
                recommended: 'systemd',
                alternatives: ['file', 'container'],
                reason: 'High security with system integration'
            },
            'containerized': {
                recommended: 'container',
                alternatives: ['file', 'environment'],
                reason: 'Native container secret management'
            },
            'password_manager': {
                recommended: 'keepassxc',
                alternatives: ['passcommand'],
                reason: 'Integration with existing password manager'
            },
            'simple': {
                recommended: 'file',
                alternatives: ['direct', 'environment'],
                reason: 'Good balance of security and simplicity'
            }
        };
    }

    /**
     * Validate password configuration
     */
    validatePasswordConfig(method, config) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: []
        };

        switch (method) {
            case 'direct':
                if (!config.passphrase || config.passphrase.length < 8) {
                    validation.isValid = false;
                    validation.errors.push('Passphrase must be at least 8 characters');
                }
                break;

            case 'environment':
                if (!config.environmentVariable) {
                    validation.isValid = false;
                    validation.errors.push('Environment variable name is required');
                }
                break;

            case 'file':
                if (!config.filePath) {
                    validation.isValid = false;
                    validation.errors.push('File path is required');
                }
                break;

            case 'systemd':
                if (!config.credentialName) {
                    validation.isValid = false;
                    validation.errors.push('Credential name is required');
                }
                break;

            case 'container':
                if (!config.secretName) {
                    validation.isValid = false;
                    validation.errors.push('Secret name is required');
                }
                break;

            case 'keepassxc':
                if (!config.databasePath || !config.entryTitle) {
                    validation.isValid = false;
                    validation.errors.push('Database path and entry title are required');
                }
                break;

            case 'passcommand':
                if (!config.command) {
                    validation.isValid = false;
                    validation.errors.push('Command is required');
                }
                break;
        }

        return validation;
    }

    /**
     * Generate configuration for password method
     */
    generatePasswordConfig(method, config) {
        switch (method) {
            case 'direct':
                return `encryption_passphrase: ${config.passphrase}`;

            case 'environment':
                return `encryption_passphrase: \${${config.environmentVariable}}`;

            case 'file':
                return `encryption_passphrase: "{credential file ${config.filePath}}"`;

            case 'systemd':
                return `encryption_passphrase: "{credential systemd ${config.credentialName}}"`;

            case 'container':
                return `encryption_passphrase: "{credential container ${config.secretName}}"`;

            case 'keepassxc':
                return `encryption_passphrase: "{credential keepassxc ${config.databasePath} ${config.entryTitle}}"`;

            case 'passcommand':
                return `encryption_passcommand: ${config.command}`;

            default:
                throw new Error(`Unknown password method: ${method}`);
        }
    }

    /**
     * Get security analysis for password method
     */
    getSecurityAnalysis(method) {
        const analyses = {
            'direct': {
                security: 'Medium',
                risks: ['Configuration file contains plaintext password', 'File permissions must be secure'],
                mitigations: ['Use secure file permissions (600)', 'Restrict access to configuration file']
            },
            'environment': {
                security: 'Low',
                risks: ['Environment variables visible in process list', 'May be logged in shell history'],
                mitigations: ['Use secure environment setup', 'Avoid logging environment variables']
            },
            'file': {
                security: 'High',
                risks: ['File permissions must be secure', 'File location must be protected'],
                mitigations: ['Use secure file permissions (600)', 'Store in protected directory']
            },
            'systemd': {
                security: 'Very High',
                risks: ['Requires systemd integration', 'Credential store must be secure'],
                mitigations: ['Use systemd encrypted credentials', 'Secure credential store directory']
            },
            'container': {
                security: 'High',
                risks: ['Container secret management required', 'Secrets directory must be secure'],
                mitigations: ['Use container secret management', 'Secure secrets directory']
            },
            'keepassxc': {
                security: 'Very High',
                risks: ['Requires KeePassXC setup', 'Database must be secure'],
                mitigations: ['Use strong KeePassXC database password', 'Secure database file location']
            },
            'passcommand': {
                security: 'High',
                risks: ['External command security', 'Command output must be secure'],
                mitigations: ['Use secure external commands', 'Validate command output']
            }
        };

        return analyses[method] || {
            security: 'Unknown',
            risks: ['Unknown method'],
            mitigations: ['Contact administrator']
        };
    }
}

module.exports = new PasswordManager();
