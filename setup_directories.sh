#!/bin/bash

# Borgmatic Web UI - Directory Setup Script
# This script creates the necessary directories for running the application outside of Docker

set -e

echo "🐳 Setting up directories for Borgmatic Web UI"
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
        return 1
    fi
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Create necessary directories
echo -e "\n📁 Creating necessary directories..."

# Create backups directory (this is where repositories will be stored)
if [ ! -d "backups" ]; then
    mkdir -p backups
    print_status 0 "Created backups directory"
else
    print_status 0 "Backups directory already exists"
fi

# Create config directory
if [ ! -d "config" ]; then
    mkdir -p config
    print_status 0 "Created config directory"
else
    print_status 0 "Config directory already exists"
fi

# Create logs directory
if [ ! -d "logs" ]; then
    mkdir -p logs
    print_status 0 "Created logs directory"
else
    print_status 0 "Logs directory already exists"
fi

# Create data directory (for files to be backed up)
if [ ! -d "data" ]; then
    mkdir -p data
    print_status 0 "Created data directory"
else
    print_status 0 "Data directory already exists"
fi

# Set proper permissions
echo -e "\n🔐 Setting proper permissions..."
chmod 755 backups config logs data
print_status 0 "Set permissions for directories"

# Check if running as root and adjust ownership
if [ "$EUID" -eq 0 ]; then
    print_warning "Running as root - setting ownership to current user"
    CURRENT_USER=$(who am i | awk '{print $1}')
    if [ -n "$CURRENT_USER" ]; then
        chown -R $CURRENT_USER:$CURRENT_USER backups config logs data
        print_status 0 "Set ownership to $CURRENT_USER"
    else
        print_warning "Could not determine current user - please set ownership manually"
    fi
else
    print_status 0 "Running as non-root user - ownership is correct"
fi

# Create default borgmatic config if it doesn't exist
echo -e "\n📝 Setting up borgmatic configuration..."
if [ ! -f "config/borgmatic.yaml" ]; then
    if [ -f "config/borgmatic.yaml.template" ]; then
        cp config/borgmatic.yaml.template config/borgmatic.yaml
        print_status 0 "Created borgmatic.yaml from template"
        print_warning "Please edit config/borgmatic.yaml with your specific configuration"
    else
        print_warning "No borgmatic.yaml.template found - creating basic config"
        cat > config/borgmatic.yaml << 'EOF'
# Borgmatic Configuration
# Edit this file with your specific backup configuration

# Location of the repository
repositories:
  - path: ./backups/repo
    label: local-backup

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
  - ./data

# Hooks
hooks:
  before_backup:
    - echo "Starting backup at $(date)"
  after_backup:
    - echo "Backup completed at $(date)"
  on_error:
    - echo "Backup failed at $(date)"
EOF
        print_status 0 "Created basic borgmatic.yaml"
    fi
else
    print_status 0 "borgmatic.yaml already exists"
fi

# Create .env file if it doesn't exist
echo -e "\n🔧 Setting up environment configuration..."
if [ ! -f ".env" ]; then
    if [ -f "env.example" ]; then
        cp env.example .env
        print_status 0 "Created .env file from template"
        print_warning "Please edit .env file with your configuration (especially SECRET_KEY!)"
    else
        print_warning "No env.example found - creating basic .env"
        cat > .env << 'EOF'
# Borgmatic Web UI Environment Configuration
# IMPORTANT: Change these values for production use!

# Security
SECRET_KEY=your-secret-key-change-this-in-production
ENVIRONMENT=development

# Database
DATABASE_URL=sqlite:///./borgmatic.db

# Borgmatic settings
BORGMATIC_CONFIG_PATH=./config/borgmatic.yaml
BORGMATIC_BACKUP_PATH=./backups

# Logging
LOG_LEVEL=INFO

# CORS settings
CORS_ORIGINS=["http://localhost:7879","http://localhost:8000"]

# Cron settings
ENABLE_CRON_BACKUPS=false
EOF
        print_status 0 "Created basic .env file"
    fi
else
    print_status 0 ".env file already exists"
fi

# Check if borgmatic is installed
echo -e "\n🔍 Checking borgmatic installation..."
if command -v borgmatic &> /dev/null; then
    BORGMATIC_VERSION=$(borgmatic --version)
    print_status 0 "Borgmatic is installed: $BORGMATIC_VERSION"
else
    print_warning "Borgmatic is not installed"
    echo -e "\n📦 To install borgmatic:"
    echo -e "   pip install borgmatic"
    echo -e "   or"
    echo -e "   sudo apt-get install borgmatic"
fi

# Check if borg is installed
if command -v borg &> /dev/null; then
    BORG_VERSION=$(borg --version)
    print_status 0 "Borg is installed: $BORG_VERSION"
else
    print_warning "Borg is not installed"
    echo -e "\n📦 To install borg:"
    echo -e "   sudo apt-get install borgbackup"
    echo -e "   or"
    echo -e "   pip install borgbackup"
fi

# Summary
echo -e "\n================================================"
echo -e "${GREEN}🎉 Directory setup completed successfully!${NC}"
echo -e "\n📋 Next steps:"
echo -e "1. Edit .env file with your configuration"
echo -e "2. Edit config/borgmatic.yaml with your backup settings"
echo -e "3. Install borg and borgmatic if not already installed"
echo -e "4. Run: python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
echo -e "5. Access the application at: http://localhost:8000"
echo -e "\n⚠️  Important notes:"
echo -e "   - Repository paths will be relative to ./backups"
echo -e "   - Data to be backed up should be placed in ./data"
echo -e "   - Logs will be written to ./logs"
echo -e "   - Configuration files are in ./config"
echo -e "================================================"
