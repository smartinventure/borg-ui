#!/bin/bash

# Borgmatic Web UI - Docker Test Script
# This script tests the Docker setup and borg installation

set -e

echo "🐳 Testing Borgmatic Web UI Docker Setup"
echo "=========================================="

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

# Test 1: Check if Docker is installed
echo -e "\n1. Checking Docker installation..."
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    print_status 0 "Docker is installed: $DOCKER_VERSION"
else
    print_status 1 "Docker is not installed"
    exit 1
fi

# Test 2: Check if Docker Compose is installed
echo -e "\n2. Checking Docker Compose installation..."
if command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(docker-compose --version)
    print_status 0 "Docker Compose is installed: $COMPOSE_VERSION"
elif docker compose version &> /dev/null; then
    COMPOSE_VERSION=$(docker compose version)
    print_status 0 "Docker Compose is installed: $COMPOSE_VERSION"
else
    print_status 1 "Docker Compose is not installed"
    exit 1
fi

# Test 3: Check if Docker daemon is running
echo -e "\n3. Checking Docker daemon..."
if docker info &> /dev/null; then
    print_status 0 "Docker daemon is running"
else
    print_status 1 "Docker daemon is not running"
    exit 1
fi

# Test 4: Check if required files exist
echo -e "\n4. Checking required files..."
REQUIRED_FILES=("Dockerfile" "docker-compose.yml" "requirements.txt" "start.sh" "config/borgmatic.yaml.template")

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        print_status 0 "File exists: $file"
    else
        print_status 1 "File missing: $file"
        exit 1
    fi
done

# Test 5: Check if directories exist
echo -e "\n5. Checking required directories..."
REQUIRED_DIRS=("app" "frontend" "config")

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        print_status 0 "Directory exists: $dir"
    else
        print_status 1 "Directory missing: $dir"
        exit 1
    fi
done

# Test 6: Create necessary directories
echo -e "\n6. Creating necessary directories..."
mkdir -p config backups logs data
print_status 0 "Created directories: config, backups, logs, data"

# Test 7: Set proper permissions
echo -e "\n7. Setting proper permissions..."
chmod 755 config backups logs data
print_status 0 "Set permissions for directories"

# Test 8: Check if .env file exists
echo -e "\n8. Checking environment configuration..."
if [ -f ".env" ]; then
    print_status 0 ".env file exists"
else
    print_warning ".env file does not exist, copying from template..."
    if [ -f "env.example" ]; then
        cp env.example .env
        print_status 0 "Created .env file from template"
        print_warning "Please edit .env file with your configuration!"
    else
        print_status 1 "env.example file not found"
        exit 1
    fi
fi

# Test 9: Test Docker build
echo -e "\n9. Testing Docker build..."
if docker build -t borgmatic-web-ui:test . &> /dev/null; then
    print_status 0 "Docker build successful"
else
    print_status 1 "Docker build failed"
    exit 1
fi

# Test 10: Test container startup
echo -e "\n10. Testing container startup..."
if docker run --rm --name borgmatic-test \
    -e SECRET_KEY=test-key \
    -e BORGMATIC_CONFIG_PATH=/app/config \
    -e BORGMATIC_BACKUP_PATH=/backups \
    borgmatic-web-ui:test /app/start.sh --help &> /dev/null; then
    print_status 0 "Container startup test successful"
else
    print_status 1 "Container startup test failed"
fi

# Test 11: Check borg installation in container
echo -e "\n11. Testing borg installation in container..."
if docker run --rm borgmatic-web-ui:test which borg &> /dev/null; then
    BORG_VERSION=$(docker run --rm borgmatic-web-ui:test borg --version)
    print_status 0 "Borg is installed: $BORG_VERSION"
else
    print_status 1 "Borg is not installed in container"
fi

# Test 12: Check borgmatic installation in container
echo -e "\n12. Testing borgmatic installation in container..."
if docker run --rm borgmatic-web-ui:test which borgmatic &> /dev/null; then
    BORGMATIC_VERSION=$(docker run --rm borgmatic-web-ui:test borgmatic --version)
    print_status 0 "Borgmatic is installed: $BORGMATIC_VERSION"
else
    print_status 1 "Borgmatic is not installed in container"
fi

# Test 13: Check user permissions
echo -e "\n13. Testing user permissions..."
USER_INFO=$(docker run --rm borgmatic-web-ui:test id)
if echo "$USER_INFO" | grep -q "uid=1001"; then
    print_status 0 "Container runs as UID 1001 (borgmatic user)"
else
    print_status 1 "Container does not run as UID 1001"
fi

# Test 14: Check health endpoint
echo -e "\n14. Testing health endpoint..."
# Start container in background
docker run -d --name borgmatic-health-test \
    -e SECRET_KEY=test-key \
    -e BORGMATIC_CONFIG_PATH=/app/config \
    -e BORGMATIC_BACKUP_PATH=/backups \
    -p 8001:8000 \
    borgmatic-web-ui:test

# Wait for container to start
sleep 10

# Test health endpoint
if curl -f http://localhost:8001/api/health/system &> /dev/null; then
    print_status 0 "Health endpoint is accessible"
else
    print_status 1 "Health endpoint is not accessible"
fi

# Cleanup test container
docker stop borgmatic-health-test &> /dev/null || true
docker rm borgmatic-health-test &> /dev/null || true

# Test 15: Cleanup test image
echo -e "\n15. Cleaning up test image..."
docker rmi borgmatic-web-ui:test &> /dev/null || true
print_status 0 "Cleaned up test image"

# Summary
echo -e "\n=========================================="
echo -e "${GREEN}🎉 All tests completed successfully!${NC}"
echo -e "\n📋 Next steps:"
echo -e "1. Edit .env file with your configuration"
echo -e "2. Run: docker-compose up -d"
echo -e "3. Access the application at: http://localhost:7879"
echo -e "4. Default login: admin / admin123"
echo -e "\n⚠️  Remember to change the default password!"
echo -e "=========================================="
