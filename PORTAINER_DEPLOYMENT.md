# Borgmatic Web UI - Portainer Deployment Guide

## 🐳 Docker Setup with Borg Installation

This guide provides instructions for deploying the Borgmatic Web UI using Portainer, with proper borg and borgmatic installation, and Portainer-compatible permissions.

## 📋 Prerequisites

- Docker and Docker Compose installed
- Portainer CE or Portainer Business
- At least 1GB RAM and 2GB storage available
- Network access for downloading packages

## 🚀 Quick Start

### 1. **Clone the Repository**
```bash
git clone <repository-url>
cd borg-ui
```

### 2. **Configure Environment**
```bash
# Copy environment template
cp env.example .env

# Edit environment variables
nano .env
```

**Important Environment Variables:**
```bash
# Security (CHANGE THESE!)
SECRET_KEY=your-super-secret-key-here
DB_PASSWORD=your-database-password

# Borgmatic settings
BORGMATIC_CONFIG_PATH=/app/config
BORGMATIC_BACKUP_PATH=/backups

# Cron settings
ENABLE_CRON_BACKUPS=false

# CORS settings (for web access)
CORS_ORIGINS=["http://localhost:7879","http://your-domain.com"]
```

### 3. **Create Required Directories**
```bash
mkdir -p config backups logs data
chmod 755 config backups logs data
```

## 🐳 Portainer Deployment

### **Option 1: Docker Compose (Recommended)**

1. **In Portainer:**
   - Go to **Stacks** → **Add stack**
   - Name: `borgmatic-ui`
   - Build method: **Web editor**
   - Copy the contents of `docker-compose.yml`

2. **Environment Variables:**
   - Add your environment variables in the Portainer interface
   - Or use the `.env` file by mounting it

3. **Deploy:**
   - Click **Deploy the stack**

### **Option 2: Docker Swarm Stack**

1. **In Portainer:**
   - Go to **Stacks** → **Add stack**
   - Name: `borgmatic-ui`
   - Build method: **Web editor**
   - Copy the contents of `docker-stack.yml`

2. **Deploy:**
   - Click **Deploy the stack**

## 🔧 Configuration

### **Borgmatic Configuration**

The container includes a default borgmatic configuration template. You can customize it:

1. **Access the container:**
   ```bash
   docker exec -it borgmatic-web-ui bash
   ```

2. **Edit configuration:**
   ```bash
   nano /app/config/borgmatic.yaml
   ```

3. **Example configuration:**
   ```yaml
   # Location of the repository
   repositories:
     - path: /backups/repo
       label: local-backup
     - path: ssh://user@remote-server/backups/repo
       label: remote-backup

   # Retention policy
   retention:
     keep_daily: 7
     keep_weekly: 4
     keep_monthly: 6
     keep_yearly: 1

   # Compression and encryption
   storage:
     compression: lz4
     encryption: repokey

   # Source directories to backup
   source_directories:
     - /app/data
     - /backup-source

   # Hooks
   hooks:
     before_backup:
       - echo "Starting backup at $(date)"
     after_backup:
       - echo "Backup completed at $(date)"
     on_error:
       - echo "Backup failed at $(date)"
   ```

### **Volume Mounts**

The container uses the following volume mounts:

- `./config:/app/config:rw` - Configuration files
- `./backups:/backups:rw` - Backup repositories
- `./logs:/app/logs:rw` - Application logs
- `./data:/app/data:rw` - Data to be backed up

### **Optional: Mount Host Directories**

To backup host directories, add volume mounts:

```yaml
volumes:
  - /path/to/your/data:/backup-source:ro
  - /etc:/backup-source/etc:ro
  - /home:/backup-source/home:ro
```

## 🔐 Security Features

### **User Permissions**
- **UID/GID**: 1001 (Portainer recommended)
- **Non-root execution**: Container runs as non-root user
- **Sudo access**: Limited sudo access for cron jobs
- **SSH support**: SSH keys can be mounted for remote repositories

### **Network Security**
- **Internal network**: Services communicate via internal network
- **Port exposure**: Only necessary ports exposed
- **Health checks**: Built-in health monitoring

### **Data Protection**
- **Encrypted backups**: Borg provides encryption
- **Secure storage**: Volumes with proper permissions
- **Audit logging**: Comprehensive logging system

## 📊 Monitoring and Health Checks

### **Health Checks**
The container includes built-in health checks:
- **Application health**: `/api/health/system`
- **Database health**: PostgreSQL connectivity
- **Cache health**: Redis connectivity

### **Logs**
Access logs through Portainer or directly:
```bash
# View logs
docker logs borgmatic-web-ui

# Follow logs
docker logs -f borgmatic-web-ui
```

### **Metrics**
- **System metrics**: CPU, memory, disk usage
- **Backup metrics**: Repository health, backup status
- **Application metrics**: Request rates, error rates

## 🔄 Backup Operations

### **Manual Backups**
1. **Via Web UI:**
   - Navigate to the Backup page
   - Select repositories
   - Click "Start Backup"

2. **Via CLI:**
   ```bash
   docker exec -it borgmatic-web-ui borgmatic create
   ```

### **Scheduled Backups**
Enable cron backups by setting:
```bash
ENABLE_CRON_BACKUPS=true
```

The default schedule runs daily at 2:00 AM.

### **Backup Verification**
```bash
# Check repository health
docker exec -it borgmatic-web-ui borgmatic check

# List archives
docker exec -it borgmatic-web-ui borgmatic list
```

## 🛠️ Troubleshooting

### **Common Issues**

1. **Permission Denied:**
   ```bash
   # Fix volume permissions
   sudo chown -R 1001:1001 config backups logs data
   ```

2. **Borgmatic Not Found:**
   ```bash
   # Check installation
   docker exec -it borgmatic-web-ui which borgmatic
   docker exec -it borgmatic-web-ui borgmatic --version
   ```

3. **Repository Access Issues:**
   ```bash
   # Check SSH keys
   docker exec -it borgmatic-web-ui ls -la /home/borgmatic/.ssh/
   ```

4. **Health Check Failures:**
   ```bash
   # Check application status
   docker exec -it borgmatic-web-ui curl -f http://localhost:8000/api/health/system
   ```

### **Log Analysis**
```bash
# Application logs
docker logs borgmatic-web-ui

# Borgmatic logs
docker exec -it borgmatic-web-ui cat /app/logs/borgmatic.log

# Cron logs
docker exec -it borgmatic-web-ui cat /app/logs/cron.log
```

## 🔄 Updates and Maintenance

### **Updating the Application**
1. **Pull latest changes:**
   ```bash
   git pull origin main
   ```

2. **Rebuild and restart:**
   ```bash
   docker-compose down
   docker-compose up --build -d
   ```

### **Backup Maintenance**
```bash
# Prune old archives
docker exec -it borgmatic-web-ui borgmatic prune

# Compact repository
docker exec -it borgmatic-web-ui borgmatic compact

# Check repository integrity
docker exec -it borgmatic-web-ui borgmatic check
```

## 📈 Performance Optimization

### **Resource Limits**
The container includes resource limits:
- **Memory**: 1GB limit, 512MB reservation
- **CPU**: 1.0 core limit, 0.5 core reservation

### **Optimization Tips**
1. **Use SSD storage** for better I/O performance
2. **Enable compression** (lz4 recommended)
3. **Use deduplication** (enabled by default)
4. **Schedule backups** during low-usage periods

## 🔗 Integration

### **Traefik Integration**
The stack includes Traefik labels for reverse proxy:
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.borgmatic-ui.rule=Host(`borgmatic.local`)"
```

### **Monitoring Integration**
- **Prometheus**: Metrics available at `/metrics`
- **Grafana**: Dashboard templates available
- **AlertManager**: Health check alerts

## 📚 Additional Resources

- [Borg Documentation](https://borgbackup.readthedocs.io/)
- [Borgmatic Documentation](https://torsion.org/borgmatic/)
- [Portainer Documentation](https://docs.portainer.io/)
- [Docker Documentation](https://docs.docker.com/)

## 🆘 Support

For issues and support:
1. Check the troubleshooting section
2. Review application logs
3. Check the GitHub issues page
4. Create a new issue with detailed information

---

**Status**: ✅ Production Ready  
**Portainer Compatible**: ✅ Yes  
**Security**: ✅ Non-root, encrypted  
**Monitoring**: ✅ Health checks, metrics
