#!/bin/bash
set -e

# ============================================================================
# Borg-UI Standalone Setup Script (Local Build Version)
# 
# This script sets up Borg-UI by building the Docker image locally
# for testing purposes before publishing to registry.
# ============================================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BORGUI_DIR="/opt/speedbits/borgmatic-ui"
BACKUP_DIR="/opt/speedbits-backup"
CONFIG_DIR="$BORGUI_DIR/config"
DATA_DIR="$BORGUI_DIR/data"
LOGS_DIR="$BORGUI_DIR/logs"

echo -e "${BLUE}================================================================"
echo -e "🔐 Borg-UI Standalone Setup (Local Build)"
echo -e "================================================================"
echo -e "${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ This script must be run as root${NC}"
    echo "Please run: sudo bash setup-standalone-local.sh"
    exit 1
fi

# Check if Docker is available
if ! command -v docker >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    echo "Please install Docker first:"
    echo "  curl -fsSL https://get.docker.com -o get-docker.sh"
    echo "  sh get-docker.sh"
    exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker Compose is not installed${NC}"
    echo "Please install Docker Compose first"
    exit 1
fi

echo -e "${GREEN}✅ Docker and Docker Compose are available${NC}"

# Check if we're in the borg-ui directory
if [ ! -f "Dockerfile" ]; then
    echo -e "${RED}❌ Dockerfile not found${NC}"
    echo "Please run this script from the borg-ui directory"
    echo "Current directory: $(pwd)"
    exit 1
fi

# Create directory structure
echo -e "${BLUE}📁 Creating directory structure...${NC}"
mkdir -p "$BORGUI_DIR"
mkdir -p "$CONFIG_DIR"
mkdir -p "$DATA_DIR"
mkdir -p "$LOGS_DIR"
mkdir -p "$BACKUP_DIR"

# Generate secure passwords and keys
echo -e "${BLUE}🔐 Generating secure credentials...${NC}"

# Generate admin password (20 characters with mixed case, numbers, symbols)
# Avoid $ characters that cause bash escaping issues
ADMIN_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/$" | cut -c1-20 | sed 's/./&!/' | head -c 20)

# Generate secret key for JWT signing
SECRET_KEY=$(openssl rand -base64 32 | tr -d "=+/$")

# Generate encryption password for borgmatic backups
ENCRYPTION_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/$" | cut -c1-32)

echo -e "${GREEN}✅ Secure credentials generated${NC}"

# Create environment file
echo -e "${BLUE}📝 Creating environment configuration...${NC}"
cat > "$BORGUI_DIR/.env" << EOF
# Borg-UI Configuration
SECRET_KEY=$SECRET_KEY
DATABASE_URL=sqlite:///./data/borgmatic.db
BORGMATIC_CONFIG_PATH=/app/config/borgmatic.yaml
BORGMATIC_BACKUP_PATH=/backups
LOG_LEVEL=INFO
ENVIRONMENT=production

# Admin credentials (will be created on first run)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=$ADMIN_PASSWORD

# CORS settings
CORS_ORIGINS=["http://localhost:7879","http://localhost:8000"]
EOF

# Create basic borgmatic configuration
echo -e "${BLUE}📝 Creating basic borgmatic configuration...${NC}"
cat > "$CONFIG_DIR/borgmatic.yaml" << EOF
location:
  source_directories:
    - /backup-source
  repositories:
    - /backups/borgmatic-repo

storage:
  compression: zstd
  encryption_passphrase: "$ENCRYPTION_PASSWORD"

retention:
  keep_daily: 7
  keep_weekly: 4
  keep_monthly: 6

hooks:
  before_backup:
    - echo "Starting backup at \$(date)"
  after_backup:
    - echo "Backup completed at \$(date)"
EOF

# Save encryption password to a secure file
echo -e "${BLUE}💾 Saving encryption password to secure file...${NC}"
cat > "$BORGUI_DIR/encryption-password.txt" << EOF
# Borgmatic Encryption Password
# Generated on: $(date)
# 
# ⚠️  CRITICAL: Store this securely!
# If you lose this password, you can NEVER restore your backups!
#
# Encryption Password: $ENCRYPTION_PASSWORD
#
# To use this password with borgmatic manually:
# export BORG_PASSPHRASE="$ENCRYPTION_PASSWORD"
# borgmatic list --repository /path/to/repo
EOF
chmod 600 "$BORGUI_DIR/encryption-password.txt"

# Create docker-compose.yml for local build
echo -e "${BLUE}🐳 Creating Docker Compose configuration...${NC}"
cat > "$BORGUI_DIR/docker-compose.yml" << EOF
services:
  borgmatic-ui:
    build: $(pwd)
    container_name: borgmatic-web-ui
    restart: unless-stopped
    
    ports:
      - "7879:8000"
    
    volumes:
      - $CONFIG_DIR:/app/config:rw
      - $DATA_DIR:/app/data:rw
      - $LOGS_DIR:/app/logs:rw
      - $BACKUP_DIR:/backups:rw
      - /opt/speedbits:/backup-source:ro
      - /etc/localtime:/etc/localtime:ro
    
    environment:
      - SECRET_KEY=$SECRET_KEY
      - DATABASE_URL=sqlite:///./data/borgmatic.db
      - BORGMATIC_CONFIG_PATH=/app/config/borgmatic.yaml
      - BORGMATIC_BACKUP_PATH=/backups
      - LOG_LEVEL=INFO
      - ENVIRONMENT=production
      - CORS_ORIGINS=["http://localhost:7879","http://localhost:8000"]
    
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/health/system"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '1.0'
        reservations:
          memory: 512M
          cpus: '0.5'
EOF

# Set proper permissions
echo -e "${BLUE}🔒 Setting proper permissions...${NC}"
chown -R 1001:1001 "$BORGUI_DIR"
chmod -R 755 "$BORGUI_DIR"
chmod 600 "$BORGUI_DIR/.env"

# Build and start the application
echo -e "${BLUE}🔨 Building and starting Borg-UI...${NC}"
cd "$BORGUI_DIR"

# Build the Docker image
echo -e "${BLUE}📦 Building Docker image...${NC}"
docker compose build

# Start the application
echo -e "${BLUE}🚀 Starting Borg-UI...${NC}"
docker compose up -d

# Wait for the application to start
echo -e "${BLUE}⏳ Waiting for application to start...${NC}"
sleep 30

# Check if the application is running
if docker ps --format '{{.Names}}' | grep -q "^borgmatic-web-ui$"; then
    echo -e "${GREEN}✅ Borg-UI is running successfully!${NC}"
else
    echo -e "${RED}❌ Failed to start Borg-UI${NC}"
    echo "Check logs with: docker logs borgmatic-web-ui"
    exit 1
fi

# Display access information
echo ""
echo -e "${GREEN}================================================================"
echo -e "🎉 Borg-UI Setup Complete!"
echo -e "================================================================"
echo -e "${NC}"
echo -e "${YELLOW}🔐 SECURELY GENERATED CREDENTIALS${NC}"
echo -e "${YELLOW}================================================================"
echo -e "Username: admin"
echo -e "Password: $ADMIN_PASSWORD"
echo -e "================================================================"
echo -e "${YELLOW}🔐 ENCRYPTION PASSWORD FOR ALL BACKUPS${NC}"
echo -e "${YELLOW}================================================================"
echo -e "Encryption Password: $ENCRYPTION_PASSWORD"
echo -e "================================================================"
echo -e "${RED}⚠️  STORE THESE SECURELY - WILL NOT BE SHOWN AGAIN!${NC}"
echo -e "${RED}⚠️  IF YOU LOSE THE ENCRYPTION PASSWORD, YOU CAN NEVER RESTORE BACKUPS!${NC}"
echo -e "${YELLOW}================================================================"
echo -e "${NC}"

echo -e "${BLUE}📡 Access Information:${NC}"
echo -e "  • Web Interface: http://localhost:7879"
echo -e "  • Username: admin"
echo -e "  • Password: $ADMIN_PASSWORD"
echo ""

echo -e "${BLUE}📁 Configuration Files:${NC}"
echo -e "  • Docker Compose: $BORGUI_DIR/docker-compose.yml"
echo -e "  • Environment: $BORGUI_DIR/.env"
echo -e "  • Borgmatic Config: $CONFIG_DIR/borgmatic.yaml"
echo -e "  • Encryption Password: $BORGUI_DIR/encryption-password.txt"
echo -e "  • Data Directory: $DATA_DIR"
echo -e "  • Backup Directory: $BACKUP_DIR"
echo ""

echo -e "${BLUE}🔧 Management Commands:${NC}"
echo -e "  • View logs: docker logs borgmatic-web-ui"
echo -e "  • Restart: cd $BORGUI_DIR && docker compose restart"
echo -e "  • Stop: cd $BORGUI_DIR && docker compose down"
echo -e "  • Update: cd $BORGUI_DIR && docker compose pull && docker compose up -d"
echo ""

echo -e "${BLUE}📝 Next Steps:${NC}"
echo -e "  1. Open http://localhost:7879 in your browser"
echo -e "  2. Login with the credentials above"
echo -e "  3. Configure your backup sources and repositories"
echo -e "  4. Change the default encryption passphrase in borgmatic.yaml"
echo -e "  5. Test your first backup"
echo ""

echo -e "${GREEN}✅ Setup completed successfully!${NC}"
echo ""
