# 🔐 Password Management System

## Overview

This system provides comprehensive password and credential management for borgmatic repositories, supporting all methods documented in the [borgmatic password documentation](https://torsion.org/borgmatic/docs/how-to/provide-your-passwords/).

## 🎯 Supported Password Methods

### 1. **Direct Passphrase** (Development)
```yaml
encryption_passphrase: yourpassphrase
```
- **Security**: Medium
- **Convenience**: High
- **Use Case**: Development, testing
- **Risks**: Plaintext in configuration file

### 2. **Environment Variables**
```yaml
encryption_passphrase: ${YOUR_PASSPHRASE}
```
- **Security**: Low
- **Convenience**: High
- **Use Case**: Simple deployments
- **Risks**: Visible in process list, shell history

### 3. **File-based Credentials** (Recommended)
```yaml
encryption_passphrase: "{credential file /credentials/borgmatic.txt}"
```
- **Security**: High
- **Convenience**: Medium
- **Use Case**: Production deployments
- **Benefits**: Secure file permissions, separate from config

### 4. **systemd Credentials** (Enterprise)
```yaml
encryption_passphrase: "{credential systemd borgmatic.pw}"
```
- **Security**: Very High
- **Convenience**: Medium
- **Use Case**: Enterprise, systemd-based systems
- **Benefits**: Encrypted credentials, system integration

### 5. **Container Secrets** (Docker/Podman)
```yaml
encryption_passphrase: "{credential container borgmatic_passphrase}"
```
- **Security**: High
- **Convenience**: High
- **Use Case**: Containerized deployments
- **Benefits**: Native container secret management

### 6. **KeePassXC Integration**
```yaml
encryption_passphrase: "{credential keepassxc /etc/keys.kdbx borgmatic}"
```
- **Security**: Very High
- **Convenience**: Low
- **Use Case**: Password manager users
- **Benefits**: Integration with existing password manager

### 7. **External Commands**
```yaml
encryption_passcommand: pass path/to/borg-passphrase
```
- **Security**: High
- **Convenience**: Medium
- **Use Case**: Custom password management
- **Benefits**: Integration with any external system

## 🚫 No Encryption Support

For repositories that don't need encryption:

```yaml
repositories:
  - path: /backups/unencrypted-repo
    # No encryption field = no encryption
```

**⚠️ Warning**: No encryption means data is stored in plain text. Only use for:
- Development/testing
- Non-sensitive data
- Temporary repositories

## 🔧 API Endpoints

### Password Methods
- `GET /api/passwords/methods` - Get all available methods
- `GET /api/passwords/recommendations` - Get method recommendations
- `GET /api/passwords/comparison` - Compare all methods
- `GET /api/passwords/security/:method` - Get security analysis

### Password Generation
- `POST /api/passwords/generate` - Generate secure passphrase
- `POST /api/passwords/validate` - Validate password configuration
- `POST /api/passwords/generate-config` - Generate YAML configuration

### Credential Creation
- `POST /api/passwords/create-file` - Create file-based credential
- `POST /api/passwords/create-systemd` - Create systemd credential
- `POST /api/passwords/create-container` - Create container secret

### Testing
- `POST /api/passwords/test-keepassxc` - Test KeePassXC integration
- `POST /api/passwords/test-command` - Test external command

## 🎯 Method Recommendations

### Development
- **Recommended**: Direct passphrase
- **Alternative**: Environment variables
- **Reason**: Simple setup, easy testing

### Production
- **Recommended**: systemd credentials
- **Alternative**: File-based credentials
- **Reason**: High security with system integration

### Containerized
- **Recommended**: Container secrets
- **Alternative**: File-based credentials
- **Reason**: Native container secret management

### Password Manager Users
- **Recommended**: KeePassXC
- **Alternative**: External commands
- **Reason**: Integration with existing password manager

### Simple Setup
- **Recommended**: File-based credentials
- **Alternative**: Direct passphrase
- **Reason**: Good balance of security and simplicity

## 🔒 Security Analysis

| Method | Security | Risks | Mitigations |
|--------|----------|-------|-------------|
| Direct | Medium | Plaintext in config | Secure file permissions |
| Environment | Low | Process visibility | Secure environment setup |
| File | High | File permissions | Secure file permissions (600) |
| systemd | Very High | Credential store | Encrypted credentials |
| Container | High | Secret management | Container secret management |
| KeePassXC | Very High | Database security | Strong database password |
| Command | High | External security | Secure external commands |

## 📋 Usage Examples

### 1. Create File-based Credential
```bash
curl -X POST http://localhost:8000/api/passwords/create-file \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "credentialPath": "/credentials/borgmatic.txt",
    "passphrase": "your-secure-passphrase"
  }'
```

### 2. Generate Secure Passphrase
```bash
curl -X POST http://localhost:8000/api/passwords/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "length": 32,
    "includeSpecial": true
  }'
```

### 3. Get Method Recommendations
```bash
curl -X GET http://localhost:8000/api/passwords/recommendations \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🛡️ Security Best Practices

1. **Use Strong Passphrases**: Minimum 32 characters, include special characters
2. **Secure File Permissions**: Use 600 for credential files
3. **Separate Credentials**: Don't store credentials in configuration files
4. **Regular Rotation**: Change passphrases periodically
5. **Access Control**: Limit access to credential files
6. **Backup Credentials**: Store credentials securely for recovery

## 🔄 Migration Between Methods

The system supports migrating between password methods:

1. **Export Current**: Get current passphrase
2. **Create New Method**: Set up new credential method
3. **Update Configuration**: Change borgmatic config
4. **Test Access**: Verify new method works
5. **Remove Old**: Clean up old credentials

## 🚨 No Encryption Warnings

When using no encryption:

- ⚠️ **Data is stored in plain text**
- ⚠️ **No protection against unauthorized access**
- ⚠️ **Not recommended for sensitive data**
- ⚠️ **Consider encryption for production use**

## 📚 References

- [borgmatic Password Documentation](https://torsion.org/borgmatic/docs/how-to/provide-your-passwords/)
- [BorgBackup Encryption](https://borgbackup.readthedocs.io/en/stable/usage/encryption.html)
- [systemd Credentials](https://systemd.io/CREDENTIALS/)
- [Docker Secrets](https://docs.docker.com/engine/swarm/secrets/)
- [KeePassXC](https://keepassxc.org/)
