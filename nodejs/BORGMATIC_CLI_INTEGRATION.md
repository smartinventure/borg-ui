# 🔧 Borgmatic CLI Integration

## Overview

This system provides comprehensive integration with borgmatic CLI commands, supporting all major borgmatic operations as documented in the [borgmatic command-line reference](https://torsion.org/borgmatic/docs/reference/command-line/).

## 🎯 Default Encryption: `repokey-blake2`

**✅ Default encryption is now `repokey-blake2`** - the most secure option with Blake2 hash algorithm.

## 📋 Supported Commands

### **Repository Management**

| Command | API Endpoint | Description |
|---------|--------------|-------------|
| `borgmatic repo-create` | `POST /api/borgmatic/repository/create` | Create new repository |
| `borgmatic repo-delete` | `DELETE /api/borgmatic/repository/:path` | Delete repository |
| `borgmatic repo-list` | `GET /api/borgmatic/repository/:path/list` | List repository contents |
| `borgmatic repo-info` | `GET /api/borgmatic/repository/:path/info` | Show repository info |
| `borgmatic repo-check` | `POST /api/borgmatic/repository/:path/check` | Check repository |

### **Archive Management**

| Command | API Endpoint | Description |
|---------|--------------|-------------|
| `borgmatic create` | `POST /api/borgmatic/archive/create` | Create archive (backup) |
| `borgmatic list` | `GET /api/borgmatic/archive/list` | List archives |
| `borgmatic info` | `GET /api/borgmatic/archive/info` | Show archive info |
| `borgmatic delete` | `DELETE /api/borgmatic/archive/delete` | Delete archive |
| `borgmatic extract` | `POST /api/borgmatic/archive/extract` | Extract archive |
| `borgmatic mount` | `POST /api/borgmatic/archive/mount` | Mount archive |
| `borgmatic umount` | `POST /api/borgmatic/archive/unmount` | Unmount archive |

### **Key Management**

| Command | API Endpoint | Description |
|---------|--------------|-------------|
| `borgmatic key export` | `POST /api/borgmatic/key/export` | Export repository key |
| `borgmatic key import` | `POST /api/borgmatic/key/import` | Import repository key |
| `borgmatic key change-passphrase` | `POST /api/borgmatic/key/change-passphrase` | Change key passphrase |

### **Utility Commands**

| Command | API Endpoint | Description |
|---------|--------------|-------------|
| `borgmatic break-lock` | `POST /api/borgmatic/break-lock` | Break repository locks |
| `borgmatic check` | `POST /api/borgmatic/archive/check` | Check archives |
| `borgmatic prune` | `POST /api/borgmatic/archive/prune` | Prune archives |
| `borgmatic compact` | `POST /api/borgmatic/archive/compact` | Compact repository |
| `borgmatic transfer` | `POST /api/borgmatic/archive/transfer` | Transfer archives |
| `borgmatic export-tar` | `POST /api/borgmatic/archive/export-tar` | Export as tar |

## 🔧 API Usage Examples

### **1. Create Repository with Default Encryption**

```bash
curl -X POST http://localhost:8000/api/borgmatic/repository/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "repositoryPath": "/opt/speedbits/backups/my-repo",
    "encryption": "repokey-blake2",
    "options": {
      "makeParentDirs": true
    }
  }'
```

### **2. Create Archive (Backup)**

```bash
curl -X POST http://localhost:8000/api/borgmatic/archive/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "repositoryPath": "/opt/speedbits/backups/my-repo",
    "options": {
      "progress": true,
      "stats": true,
      "comment": "Daily backup"
    }
  }'
```

### **3. List Archives**

```bash
curl -X GET "http://localhost:8000/api/borgmatic/archive/list?repositoryPath=/opt/speedbits/backups/my-repo&json=true" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### **4. Extract Archive**

```bash
curl -X POST http://localhost:8000/api/borgmatic/archive/extract \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "repositoryPath": "/opt/speedbits/backups/my-repo",
    "archiveName": "2025-01-01T12:00:00",
    "destinationPath": "/tmp/restore",
    "options": {
      "progress": true
    }
  }'
```

### **5. Mount Archive**

```bash
curl -X POST http://localhost:8000/api/borgmatic/archive/mount \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "repositoryPath": "/opt/speedbits/backups/my-repo",
    "mountPoint": "/mnt/backup",
    "options": {
      "archive": "2025-01-01T12:00:00",
      "foreground": false
    }
  }'
```

### **6. Export Repository Key**

```bash
curl -X POST http://localhost:8000/api/borgmatic/key/export \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "repositoryPath": "/opt/speedbits/backups/my-repo",
    "keyPath": "/opt/speedbits/backups/my-repo-key",
    "options": {
      "paper": false,
      "qrHtml": false
    }
  }'
```

## 🔒 Encryption Options

### **Default: `repokey-blake2`**
- **Security**: Very High
- **Convenience**: High
- **Key Location**: Repository
- **Algorithm**: Blake2 hash
- **Recommended**: ✅ Yes

### **Alternative Options**

| Type | Security | Convenience | Use Case |
|------|----------|-------------|----------|
| `repokey` | High | High | Standard repositories |
| `keyfile` | High | Medium | Shared repositories |
| `keyfile-blake2` | Very High | Medium | Enhanced security |
| `none` | None | High | Non-sensitive data |

## 🎯 Key Features

### **✅ Complete CLI Integration**
- All borgmatic commands supported
- Proper error handling and JSON output
- Timeout management for long operations
- Environment variable support

### **✅ Repository Management**
- Create/delete repositories
- List repository contents
- Get repository information
- Check repository consistency

### **✅ Archive Operations**
- Create archives (backups)
- List/search archives
- Extract archives
- Mount/unmount archives
- Delete archives

### **✅ Key Management**
- Export/import repository keys
- Change key passphrases
- Paper key support
- QR code generation

### **✅ Utility Functions**
- Break repository locks
- Check archive consistency
- Prune old archives
- Compact repositories
- Transfer between repositories

## 🚀 Advanced Features

### **Progress Monitoring**
```bash
# Enable progress output
{
  "options": {
    "progress": true,
    "stats": true
  }
}
```

### **JSON Output**
```bash
# Get structured data
{
  "json": true
}
```

### **Pattern Matching**
```bash
# Filter archives
{
  "pattern": "2025-01-*",
  "exclude": "*.tmp"
}
```

### **Sorting and Filtering**
```bash
# Sort and limit results
{
  "sortBy": "timestamp",
  "first": 10,
  "last": 5
}
```

## 🔧 Error Handling

All commands return structured responses:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "output": "Command output",
  "data": {} // For JSON responses
}
```

Error responses:
```json
{
  "success": false,
  "message": "Operation failed",
  "error": "Error message",
  "stderr": "Error details"
}
```

## 📚 Command Reference

### **Repository Commands**
- `POST /api/borgmatic/repository/create` - Create repository
- `DELETE /api/borgmatic/repository/:path` - Delete repository
- `GET /api/borgmatic/repository/:path/list` - List repository
- `GET /api/borgmatic/repository/:path/info` - Repository info
- `POST /api/borgmatic/repository/:path/check` - Check repository

### **Archive Commands**
- `POST /api/borgmatic/archive/create` - Create archive
- `GET /api/borgmatic/archive/list` - List archives
- `GET /api/borgmatic/archive/info` - Archive info
- `DELETE /api/borgmatic/archive/delete` - Delete archive
- `POST /api/borgmatic/archive/extract` - Extract archive
- `POST /api/borgmatic/archive/mount` - Mount archive
- `POST /api/borgmatic/archive/unmount` - Unmount archive

### **Key Commands**
- `POST /api/borgmatic/key/export` - Export key
- `POST /api/borgmatic/key/import` - Import key
- `POST /api/borgmatic/key/change-passphrase` - Change passphrase

### **Utility Commands**
- `POST /api/borgmatic/break-lock` - Break locks
- `GET /api/borgmatic/version` - Get version
- `GET /api/borgmatic/help` - Get help

## 🛡️ Security Features

1. **Authentication Required**: All endpoints require valid JWT token
2. **Input Validation**: All parameters are validated
3. **Error Handling**: Secure error messages without sensitive data
4. **Timeout Management**: Prevents hanging operations
5. **Path Validation**: Prevents directory traversal attacks

## 📖 References

- [borgmatic Command-line Reference](https://torsion.org/borgmatic/docs/reference/command-line/)
- [BorgBackup Documentation](https://borgbackup.readthedocs.io/)
- [Borgmatic Configuration](https://torsion.org/borgmatic/docs/reference/configuration/)
