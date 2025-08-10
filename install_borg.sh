#!/bin/bash
# Borgmatic Web UI - Borg Installation Script
# This script helps install Borg and Borgmatic for local development

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

echo "🐳 Borgmatic Web UI - Borg Installation Script"
echo "================================================"
echo ""
print_info "This script will install Borg and Borgmatic for local development."
print_warning "For production use, we recommend using the Docker setup instead."
echo ""

# Detect OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
else
    echo -e "${RED}❌ Unsupported operating system: $OSTYPE${NC}"
    exit 1
fi

print_info "Detected OS: $OS"
echo ""

# Check if already installed
if command -v borg &> /dev/null; then
    BORG_VERSION=$(borg --version)
    print_status 0 "Borg is already installed: $BORG_VERSION"
else
    print_warning "Borg is not installed"
fi

if command -v borgmatic &> /dev/null; then
    BORGMATIC_VERSION=$(borgmatic --version)
    print_status 0 "Borgmatic is already installed: $BORGMATIC_VERSION"
else
    print_warning "Borgmatic is not installed"
fi

echo ""

# Installation based on OS
if [ "$OS" = "macos" ]; then
    print_info "Installing on macOS..."
    
    # Check if Homebrew is installed
    if ! command -v brew &> /dev/null; then
        print_warning "Homebrew is not installed. Installing Homebrew first..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi
    
    # Install Borg
    if ! command -v borg &> /dev/null; then
        print_info "Installing Borg..."
        brew install borgbackup
        print_status 0 "Borg installed successfully"
    fi
    
    # Install Borgmatic
    if ! command -v borgmatic &> /dev/null; then
        print_info "Installing Borgmatic..."
        brew install borgmatic
        print_status 0 "Borgmatic installed successfully"
    fi

elif [ "$OS" = "linux" ]; then
    print_info "Installing on Linux..."
    
    # Detect distribution
    if [ -f /etc/debian_version ]; then
        DISTRO="debian"
        print_info "Detected Debian/Ubuntu distribution"
        
        # Update package list
        print_info "Updating package list..."
        sudo apt-get update
        
        # Install Borg
        if ! command -v borg &> /dev/null; then
            print_info "Installing Borg..."
            sudo apt-get install -y borgbackup
            print_status 0 "Borg installed successfully"
        fi
        
        # Install Borgmatic
        if ! command -v borgmatic &> /dev/null; then
            print_info "Installing Borgmatic..."
            sudo apt-get install -y borgmatic
            print_status 0 "Borgmatic installed successfully"
        fi
        
    elif [ -f /etc/redhat-release ]; then
        DISTRO="redhat"
        print_info "Detected Red Hat/CentOS/Fedora distribution"
        
        # Install Borg
        if ! command -v borg &> /dev/null; then
            print_info "Installing Borg..."
            sudo dnf install -y borgbackup || sudo yum install -y borgbackup
            print_status 0 "Borg installed successfully"
        fi
        
        # Install Borgmatic
        if ! command -v borgmatic &> /dev/null; then
            print_info "Installing Borgmatic..."
            sudo dnf install -y borgmatic || sudo yum install -y borgmatic
            print_status 0 "Borgmatic installed successfully"
        fi
        
    else
        print_warning "Unsupported Linux distribution. Please install Borg and Borgmatic manually:"
        echo "  - Borg: https://borgbackup.readthedocs.io/en/stable/installation.html"
        echo "  - Borgmatic: https://torsion.org/borgmatic/docs/how-to/set-up-backups/#installation"
        exit 1
    fi
fi

echo ""
print_info "Verifying installation..."

# Verify Borg
if command -v borg &> /dev/null; then
    BORG_VERSION=$(borg --version)
    print_status 0 "Borg verification successful: $BORG_VERSION"
else
    print_status 1 "Borg verification failed"
    exit 1
fi

# Verify Borgmatic
if command -v borgmatic &> /dev/null; then
    BORGMATIC_VERSION=$(borgmatic --version)
    print_status 0 "Borgmatic verification successful: $BORGMATIC_VERSION"
else
    print_status 1 "Borgmatic verification failed"
    exit 1
fi

echo ""
echo "================================================"
print_status 0 "Installation completed successfully!"
echo ""
print_info "You can now run the application locally:"
echo "  1. Run: ./setup_directories.sh"
echo "  2. Start backend: python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
echo "  3. Start frontend: cd frontend && npm run dev"
echo "  4. Access: http://localhost:7879"
echo ""
print_warning "Remember: For production use, use the Docker setup instead!"
echo "================================================"
