const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { execa } = require('execa');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const yamlManager = require('../services/yaml-manager');

/**
 * SSH Keys Management Routes
 * Handles SSH key generation, storage, and management
 * Uses YAML-based storage instead of database
 */

/**
 * Get all SSH keys
 * GET /api/ssh-keys
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const sshKeys = await getSSHKeys();
        
        res.json({
            success: true,
            ssh_keys: sshKeys.map(key => ({
                id: key.id,
                name: key.name,
                description: key.description,
                key_type: key.key_type,
                public_key: key.public_key,
                is_active: key.is_active,
                created_at: key.created_at,
                updated_at: key.updated_at
            }))
        });
    } catch (error) {
        console.error('Failed to get SSH keys:', error.message);
        res.status(500).json({
            success: false,
            detail: 'Failed to retrieve SSH keys'
        });
    }
});

/**
 * Create a new SSH key
 * POST /api/ssh-keys
 */
router.post('/', authenticateToken, async (req, res) => {
    if (!req.user.is_admin) {
        return res.status(403).json({
            success: false,
            detail: 'Admin access required'
        });
    }

    try {
        const { name, description, key_type = 'rsa', public_key, private_key } = req.body;

        if (!name || !public_key || !private_key) {
            return res.status(400).json({
                success: false,
                detail: 'Name, public_key, and private_key are required'
            });
        }

        // Check if SSH key name already exists
        const existingKeys = await getSSHKeys();
        if (existingKeys.some(key => key.name === name)) {
            return res.status(400).json({
                success: false,
                detail: 'SSH key name already exists'
            });
        }

        // Validate SSH key format and content
        if (!isValidPublicKey(public_key)) {
            return res.status(400).json({
                success: false,
                detail: 'Invalid public key format'
            });
        }

        // Validate private key format
        if (!isValidPrivateKey(private_key)) {
            return res.status(400).json({
                success: false,
                detail: 'Invalid private key format'
            });
        }

        // Encrypt private key
        const encryptedPrivateKey = encryptPrivateKey(private_key);

        // Create SSH key record
        const sshKey = {
            id: uuidv4(),
            name: name,
            description: description || null,
            key_type: key_type,
            public_key: public_key,
            private_key: encryptedPrivateKey,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: null
        };

        // Add to storage
        existingKeys.push(sshKey);
        await saveSSHKeys(existingKeys);

        console.log(`SSH key created: ${name} by user ${req.user.username}`);

        res.status(201).json({
            success: true,
            message: 'SSH key created successfully',
            ssh_key: {
                id: sshKey.id,
                name: sshKey.name,
                description: sshKey.description,
                key_type: sshKey.key_type,
                public_key: sshKey.public_key,
                is_active: sshKey.is_active
            }
        });
    } catch (error) {
        console.error('Failed to create SSH key:', error.message);
        res.status(500).json({
            success: false,
            detail: 'Failed to create SSH key'
        });
    }
});

/**
 * Generate a new SSH key pair
 * POST /api/ssh-keys/generate
 */
router.post('/generate', authenticateToken, async (req, res) => {
    if (!req.user.is_admin) {
        return res.status(403).json({
            success: false,
            detail: 'Admin access required'
        });
    }

    try {
        const { name, key_type = 'rsa', description } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                detail: 'Name is required'
            });
        }

        // Check if SSH key name already exists
        const existingKeys = await getSSHKeys();
        if (existingKeys.some(key => key.name === name)) {
            return res.status(400).json({
                success: false,
                detail: 'SSH key name already exists'
            });
        }

        // Validate key type
        const validTypes = ['rsa', 'ed25519', 'ecdsa'];
        if (!validTypes.includes(key_type)) {
            return res.status(400).json({
                success: false,
                detail: `Invalid key type. Must be one of: ${validTypes.join(', ')}`
            });
        }

        // Generate SSH key pair
        const keyResult = await generateSSHKeyPair(key_type);
        
        if (!keyResult.success) {
            return res.status(500).json({
                success: false,
                detail: `Failed to generate SSH key: ${keyResult.error}`
            });
        }

        // Encrypt private key
        const encryptedPrivateKey = encryptPrivateKey(keyResult.private_key);

        // Create SSH key record
        const sshKey = {
            id: uuidv4(),
            name: name,
            description: description || null,
            key_type: key_type,
            public_key: keyResult.public_key,
            private_key: encryptedPrivateKey,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: null
        };

        // Add to storage
        existingKeys.push(sshKey);
        await saveSSHKeys(existingKeys);

        console.log(`SSH key generated: ${name} (${key_type}) by user ${req.user.username}`);

        res.status(201).json({
            success: true,
            message: 'SSH key generated successfully',
            ssh_key: {
                id: sshKey.id,
                name: sshKey.name,
                description: sshKey.description,
                key_type: sshKey.key_type,
                public_key: sshKey.public_key,
                is_active: sshKey.is_active
            }
        });
    } catch (error) {
        console.error('Failed to generate SSH key:', error.message);
        res.status(500).json({
            success: false,
            detail: 'Failed to generate SSH key'
        });
    }
});

/**
 * Get SSH key details
 * GET /api/ssh-keys/:keyId
 */
router.get('/:keyId', authenticateToken, async (req, res) => {
    try {
        const { keyId } = req.params;
        
        // Validate keyId to prevent path traversal
        if (!isValidKeyId(keyId)) {
            return res.status(400).json({
                success: false,
                detail: 'Invalid key ID format'
            });
        }
        
        const sshKeys = await getSSHKeys();
        const sshKey = sshKeys.find(key => key.id === keyId);

        if (!sshKey) {
            return res.status(404).json({
                success: false,
                detail: 'SSH key not found'
            });
        }

        res.json({
            success: true,
            ssh_key: {
                id: sshKey.id,
                name: sshKey.name,
                description: sshKey.description,
                key_type: sshKey.key_type,
                public_key: sshKey.public_key,
                is_active: sshKey.is_active,
                created_at: sshKey.created_at,
                updated_at: sshKey.updated_at
            }
        });
    } catch (error) {
        console.error('Failed to get SSH key:', error.message);
        res.status(500).json({
            success: false,
            detail: 'Failed to retrieve SSH key'
        });
    }
});

/**
 * Update SSH key
 * PUT /api/ssh-keys/:keyId
 */
router.put('/:keyId', authenticateToken, async (req, res) => {
    if (!req.user.is_admin) {
        return res.status(403).json({
            success: false,
            detail: 'Admin access required'
        });
    }

    try {
        const { keyId } = req.params;
        
        // Validate keyId to prevent path traversal
        if (!isValidKeyId(keyId)) {
            return res.status(400).json({
                success: false,
                detail: 'Invalid key ID format'
            });
        }
        
        const { name, description, is_active } = req.body;

        const sshKeys = await getSSHKeys();
        const sshKeyIndex = sshKeys.findIndex(key => key.id === keyId);

        if (sshKeyIndex === -1) {
            return res.status(404).json({
                success: false,
                detail: 'SSH key not found'
            });
        }

        const sshKey = sshKeys[sshKeyIndex];

        // Update fields
        if (name !== undefined) {
            // Check if name already exists
            if (sshKeys.some(key => key.name === name && key.id !== keyId)) {
                return res.status(400).json({
                    success: false,
                    detail: 'SSH key name already exists'
                });
            }
            sshKey.name = name;
        }

        if (description !== undefined) {
            sshKey.description = description;
        }

        if (is_active !== undefined) {
            sshKey.is_active = is_active;
        }

        sshKey.updated_at = new Date().toISOString();

        // Save updated keys
        await saveSSHKeys(sshKeys);

        console.log(`SSH key updated: ${keyId} by user ${req.user.username}`);

        res.json({
            success: true,
            message: 'SSH key updated successfully'
        });
    } catch (error) {
        console.error('Failed to update SSH key:', error.message);
        res.status(500).json({
            success: false,
            detail: 'Failed to update SSH key'
        });
    }
});

/**
 * Delete SSH key
 * DELETE /api/ssh-keys/:keyId
 */
router.delete('/:keyId', authenticateToken, async (req, res) => {
    if (!req.user.is_admin) {
        return res.status(403).json({
            success: false,
            detail: 'Admin access required'
        });
    }

    try {
        const { keyId } = req.params;
        
        // Validate keyId to prevent path traversal
        if (!isValidKeyId(keyId)) {
            return res.status(400).json({
                success: false,
                detail: 'Invalid key ID format'
            });
        }
        
        const sshKeys = await getSSHKeys();
        const sshKeyIndex = sshKeys.findIndex(key => key.id === keyId);

        if (sshKeyIndex === -1) {
            return res.status(404).json({
                success: false,
                detail: 'SSH key not found'
            });
        }

        const sshKey = sshKeys[sshKeyIndex];

        // Check if SSH key is used by any repositories
        const isUsed = await checkSSHKeyUsage(keyId);
        if (isUsed) {
            return res.status(400).json({
                success: false,
                detail: 'Cannot delete SSH key that is used by repositories. Please remove or update repositories first.'
            });
        }

        // Remove SSH key
        sshKeys.splice(sshKeyIndex, 1);
        await saveSSHKeys(sshKeys);

        console.log(`SSH key deleted: ${keyId} by user ${req.user.username}`);

        res.json({
            success: true,
            message: 'SSH key deleted successfully'
        });
    } catch (error) {
        console.error('Failed to delete SSH key:', error.message);
        res.status(500).json({
            success: false,
            detail: 'Failed to delete SSH key'
        });
    }
});

/**
 * Test SSH connection with the specified key
 * POST /api/ssh-keys/:keyId/test-connection
 */
router.post('/:keyId/test-connection', authenticateToken, async (req, res) => {
    try {
        const { keyId } = req.params;
        const { host, username, port = 22 } = req.body;

        if (!host || !username) {
            return res.status(400).json({
                success: false,
                detail: 'Host and username are required'
            });
        }

        // Validate and sanitize input parameters
        if (!isValidHostname(host)) {
            return res.status(400).json({
                success: false,
                detail: 'Invalid hostname format'
            });
        }

        if (!isValidUsername(username)) {
            return res.status(400).json({
                success: false,
                detail: 'Invalid username format'
            });
        }

        if (!isValidPort(port)) {
            return res.status(400).json({
                success: false,
                detail: 'Invalid port number'
            });
        }

        // Validate keyId to prevent path traversal
        if (!isValidKeyId(keyId)) {
            return res.status(400).json({
                success: false,
                detail: 'Invalid key ID format'
            });
        }

        // Additional security checks for command injection
        if (containsShellMetacharacters(host) || containsShellMetacharacters(username)) {
            return res.status(400).json({
                success: false,
                detail: 'Invalid characters in host or username'
            });
        }

        const sshKeys = await getSSHKeys();
        const sshKey = sshKeys.find(key => key.id === keyId);

        if (!sshKey) {
            return res.status(404).json({
                success: false,
                detail: 'SSH key not found'
            });
        }

        // Test SSH connection
        const testResult = await testSSHKeyConnection(sshKey, host, username, port);

        res.json({
            success: true,
            connection_test: testResult
        });
    } catch (error) {
        console.error('Failed to test SSH connection:', error.message);
        res.status(500).json({
            success: false,
            detail: 'Failed to test SSH connection'
        });
    }
});

/**
 * Get SSH key types
 * GET /api/ssh-keys/types
 */
router.get('/types', authenticateToken, (req, res) => {
    res.json({
        success: true,
        key_types: [
            {
                type: 'rsa',
                name: 'RSA',
                description: 'RSA key (recommended for compatibility)',
                default_bits: 4096
            },
            {
                type: 'ed25519',
                name: 'Ed25519',
                description: 'Ed25519 key (recommended for security)',
                default_bits: 256
            },
            {
                type: 'ecdsa',
                name: 'ECDSA',
                description: 'ECDSA key (good balance of security and compatibility)',
                default_bits: 521
            }
        ]
    });
});

/**
 * Get SSH keys from YAML storage
 */
async function getSSHKeys() {
    try {
        const dataPath = path.join(process.cwd(), 'data', 'ssh-keys.yaml');
        if (await fs.pathExists(dataPath)) {
            const data = await yamlManager.loadYaml(dataPath);
            return data.ssh_keys || [];
        }
        return [];
    } catch (error) {
        console.error('Failed to load SSH keys:', error.message);
        return [];
    }
}

/**
 * Save SSH keys to YAML storage
 */
async function saveSSHKeys(sshKeys) {
    try {
        const dataDir = path.join(process.cwd(), 'data');
        await fs.ensureDir(dataDir);
        
        const dataPath = path.join(dataDir, 'ssh-keys.yaml');
        const data = { ssh_keys: sshKeys };
        
        await yamlManager.saveYaml(dataPath, data);
    } catch (error) {
        console.error('Failed to save SSH keys:', error.message);
        throw error;
    }
}

/**
 * Encrypt private key
 */
function encryptPrivateKey(privateKey) {
    try {
        const secretKey = process.env.SECRET_KEY;
        if (!secretKey) {
            throw new Error('SECRET_KEY environment variable is required for encryption');
        }
        
        // Generate random salt for each encryption
        const salt = crypto.randomBytes(32);
        
        // Derive key using PBKDF2 with random salt
        const key = crypto.pbkdf2Sync(secretKey, salt, 100000, 32, 'sha512');
        
        // Generate random IV
        const iv = crypto.randomBytes(16);
        
        // Use secure cipher with proper IV
        const cipher = crypto.createCipherGCM('aes-256-gcm', key, iv);
        
        let encrypted = cipher.update(privateKey, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        // Get authentication tag
        const tag = cipher.getAuthTag();
        
        // Return: salt:iv:tag:encrypted
        return salt.toString('hex') + ':' + iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
    } catch (error) {
        console.error('Failed to encrypt private key:', error.message);
        throw error;
    }
}

/**
 * Decrypt private key
 */
function decryptPrivateKey(encryptedPrivateKey) {
    try {
        const secretKey = process.env.SECRET_KEY;
        if (!secretKey) {
            throw new Error('SECRET_KEY environment variable is required for encryption');
        }
        
        // Parse encrypted data: salt:iv:tag:encrypted
        const parts = encryptedPrivateKey.split(':');
        if (parts.length !== 4) {
            throw new Error('Invalid encrypted private key format');
        }
        
        const [saltHex, ivHex, tagHex, encrypted] = parts;
        
        // Validate hex string lengths to prevent buffer overflow
        if (saltHex.length !== 64 || ivHex.length !== 32 || tagHex.length !== 32) {
            throw new Error('Invalid encrypted private key format - invalid hex lengths');
        }
        
        // Validate hex string format
        if (!/^[0-9a-f]+$/i.test(saltHex) || !/^[0-9a-f]+$/i.test(ivHex) || !/^[0-9a-f]+$/i.test(tagHex)) {
            throw new Error('Invalid encrypted private key format - invalid hex characters');
        }
        
        const salt = Buffer.from(saltHex, 'hex');
        const iv = Buffer.from(ivHex, 'hex');
        const tag = Buffer.from(tagHex, 'hex');
        
        // Derive key using same parameters as encryption
        const key = crypto.pbkdf2Sync(secretKey, salt, 100000, 32, 'sha512');
        
        // Create decipher with authentication
        const decipher = crypto.createDecipherGCM('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);
        
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        console.error('Failed to decrypt private key:', error.message);
        throw error;
    }
}

/**
 * Generate SSH key pair using ssh-keygen
 */
async function generateSSHKeyPair(keyType) {
    let tempDir = null;
    
    try {
        // Create secure temporary directory
        tempDir = await fs.mkdtemp(path.join(process.cwd(), 'ssh-gen-'));
        const keyFile = path.join(tempDir, `id_${keyType}`);
        
        // Build ssh-keygen command with secure options
        const cmd = [
            'ssh-keygen', 
            '-t', keyType, 
            '-f', keyFile, 
            '-N', '',  // No passphrase
            '-C', 'borgmatic-ui-generated'  // Comment
        ];
        
        // Execute command
        const result = await execa(cmd[0], cmd.slice(1), { timeout: 30000 });
        
        if (!result.success) {
            return {
                success: false,
                error: result.stderr || 'Unknown error'
            };
        }
        
        // Read generated keys
        const publicKey = await fs.readFile(`${keyFile}.pub`, 'utf8');
        const privateKey = await fs.readFile(keyFile, 'utf8');
        
        return {
            success: true,
            public_key: publicKey.trim(),
            private_key: privateKey.trim()
        };
    } catch (error) {
        console.error('Failed to generate SSH key pair:', error.message);
        return {
            success: false,
            error: error.message
        };
    } finally {
        // Secure cleanup of temporary files
        if (tempDir) {
            await secureCleanup(tempDir);
        }
    }
}

/**
 * Test SSH connection using the specified key
 */
async function testSSHKeyConnection(sshKey, host, username, port) {
    let tempDir = null;
    
    try {
        // Decrypt private key
        const privateKey = decryptPrivateKey(sshKey.private_key);
        
        // Create secure temporary key file
        const { tempDir: dir, tempFile } = await createSecureTempFile(privateKey, 'ssh-test-');
        tempDir = dir;
        
        // Test SSH connection with sanitized parameters
        // Use separate arguments to prevent command injection
        const cmd = [
            'ssh', '-i', tempFile, 
            '-o', 'StrictHostKeyChecking=no',
            '-o', 'ConnectTimeout=10',
            '-o', 'BatchMode=yes',
            '-o', 'UserKnownHostsFile=/dev/null',
            '-o', 'LogLevel=ERROR',
            '-p', port.toString(),
            `${username}@${host}`,
            'echo "SSH connection successful"'
        ];
        
        // Additional security: validate final command construction
        const targetHost = `${username}@${host}`;
        if (containsShellMetacharacters(targetHost)) {
            throw new Error('Invalid characters detected in host/username combination');
        }
        
        const result = await execa(cmd[0], cmd.slice(1), { timeout: 15000 });
        
        if (result.success) {
            return {
                success: true,
                message: 'SSH connection successful',
                output: result.stdout.trim()
            };
        } else {
            return {
                success: false,
                error: result.stderr || 'SSH connection failed',
                return_code: result.exitCode
            };
        }
    } catch (error) {
        console.error('Failed to test SSH connection:', error.message);
        return {
            success: false,
            error: error.message
        };
    } finally {
        // Secure cleanup of temporary files
        if (tempDir) {
            await secureCleanup(tempDir);
        }
    }
}

/**
 * Check if SSH key is used by any repositories
 */
async function checkSSHKeyUsage(keyId) {
    try {
        // This would check if the SSH key is referenced in any repository configurations
        // For now, we'll implement a simple check
        const borgmaticConfig = require('../services/borgmatic-config');
        const config = await borgmaticConfig.loadConfig();
        
        // Check if key is used in any repository SSH configurations
        const repositories = config.location?.repositories || [];
        for (const repo of repositories) {
            if (repo.ssh_key_id === keyId) {
                return true;
            }
        }
        
        return false;
    } catch (error) {
        console.error('Failed to check SSH key usage:', error.message);
        return false;
    }
}

/**
 * Validate SSH public key format
 */
function isValidPublicKey(publicKey) {
    // Check for valid SSH public key formats
    const validFormats = [
        /^ssh-rsa\s+[A-Za-z0-9+/]+=*\s*.*$/,
        /^ssh-ed25519\s+[A-Za-z0-9+/]+=*\s*.*$/,
        /^ecdsa-sha2-nistp256\s+[A-Za-z0-9+/]+=*\s*.*$/,
        /^ecdsa-sha2-nistp384\s+[A-Za-z0-9+/]+=*\s*.*$/,
        /^ecdsa-sha2-nistp521\s+[A-Za-z0-9+/]+=*\s*.*$/
    ];
    
    return validFormats.some(format => format.test(publicKey.trim()));
}

/**
 * Validate SSH private key format
 */
function isValidPrivateKey(privateKey) {
    // Check for valid SSH private key headers
    const validHeaders = [
        '-----BEGIN OPENSSH PRIVATE KEY-----',
        '-----BEGIN RSA PRIVATE KEY-----',
        '-----BEGIN EC PRIVATE KEY-----',
        '-----BEGIN PRIVATE KEY-----'
    ];
    
    const trimmed = privateKey.trim();
    return validHeaders.some(header => trimmed.startsWith(header));
}

/**
 * Validate hostname format
 */
function isValidHostname(hostname) {
    // More restrictive hostname validation
    const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    
    // Additional length check
    if (hostname.length > 253) {
        return false;
    }
    
    return hostnameRegex.test(hostname) || ipRegex.test(hostname);
}

/**
 * Validate username format
 */
function isValidUsername(username) {
    // More restrictive username validation
    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    return usernameRegex.test(username) && username.length >= 1 && username.length <= 32;
}

/**
 * Validate key ID format (UUID)
 */
function isValidKeyId(keyId) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(keyId);
}

/**
 * Check for shell metacharacters that could be used for command injection
 */
function containsShellMetacharacters(input) {
    // Comprehensive list of dangerous shell metacharacters
    const dangerousChars = /[;&|`$(){}[\]\\'":!*?~#%^+=<>]/;
    return dangerousChars.test(input);
}

/**
 * Validate port number
 */
function isValidPort(port) {
    const portNum = parseInt(port, 10);
    return !isNaN(portNum) && portNum >= 1 && portNum <= 65535;
}

/**
 * Secure temporary file creation with proper cleanup
 */
async function createSecureTempFile(content, prefix = 'ssh-temp-') {
    const tempDir = await fs.mkdtemp(path.join(process.cwd(), prefix));
    const tempFile = path.join(tempDir, 'key');
    
    try {
        await fs.writeFile(tempFile, content, { mode: 0o600 });
        return { tempDir, tempFile };
    } catch (error) {
        // Clean up on error
        await fs.remove(tempDir);
        throw error;
    }
}

/**
 * Secure cleanup of temporary files
 */
async function secureCleanup(tempDir) {
    try {
        if (tempDir && await fs.pathExists(tempDir)) {
            // Overwrite files with random data before deletion
            const files = await fs.readdir(tempDir);
            for (const file of files) {
                const filePath = path.join(tempDir, file);
                const stats = await fs.stat(filePath);
                if (stats.isFile()) {
                    // Overwrite with random data
                    const randomData = crypto.randomBytes(stats.size);
                    await fs.writeFile(filePath, randomData);
                }
            }
            await fs.remove(tempDir);
        }
    } catch (error) {
        console.error('Failed to secure cleanup:', error.message);
        // Force remove even if secure cleanup fails
        try {
            await fs.remove(tempDir);
        } catch (cleanupError) {
            console.error('Failed to cleanup temp directory:', cleanupError.message);
        }
    }
}

module.exports = router;
