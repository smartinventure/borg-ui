#!/bin/bash
set -e

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Check if borgmatic is available
if ! command -v borgmatic &> /dev/null; then
    log "ERROR: borgmatic is not installed or not in PATH"
    exit 1
fi

# Check if borg is available
if ! command -v borg &> /dev/null; then
    log "ERROR: borg is not installed or not in PATH"
    exit 1
fi

# Display versions
log "Borg version: $(borg --version)"
log "Borgmatic version: $(borgmatic --version)"

# Create default config if it doesn't exist
if [ ! -f /app/config/borgmatic.yaml ]; then
    log "Creating default borgmatic configuration..."
    cp /etc/borgmatic/config.yaml.template /app/config/borgmatic.yaml
    chown borgmatic:borgmatic /app/config/borgmatic.yaml
fi

# Set up cron job for automatic backups (if enabled)
if [ "$ENABLE_CRON_BACKUPS" = "true" ]; then
    log "Setting up cron job for automatic backups..."
    echo "0 2 * * * borgmatic create --config /app/config/borgmatic.yaml >> /app/logs/cron.log 2>&1" | sudo tee /etc/cron.d/borgmatic
    sudo chmod 644 /etc/cron.d/borgmatic
    sudo crontab /etc/cron.d/borgmatic
fi

# Start cron daemon in background
if [ "$ENABLE_CRON_BACKUPS" = "true" ]; then
    log "Starting cron daemon..."
    sudo cron
fi

# Start the application
log "Starting Borgmatic Web UI..."
exec gunicorn app.main:app \
    --bind 0.0.0.0:8000 \
    --workers 2 \
    --worker-class uvicorn.workers.UvicornWorker \
    --access-logfile /app/logs/access.log \
    --error-logfile /app/logs/error.log \
    --log-level info 