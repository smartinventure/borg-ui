# Borgmatic Web UI - Implementation

A lightweight web-based user interface for Borgmatic, designed to run efficiently on resource-constrained devices like Raspberry Pi or Odroid.

## 🚀 Implementation Status

### ✅ Completed
- **Backend API**: FastAPI with comprehensive endpoints
- **Authentication**: JWT-based with bcrypt password hashing
- **Database**: SQLite with SQLAlchemy ORM
- **Borgmatic Integration**: Full CLI interface wrapper
- **Docker Configuration**: Multi-stage build with production setup
- **API Documentation**: Auto-generated Swagger/OpenAPI docs
- **Health Monitoring**: System and backup health checks
- **Frontend Foundation**: React 18 + TypeScript + Tailwind CSS
- **Authentication UI**: Complete login/logout system with form validation
- **Dashboard**: System metrics, health monitoring, and status overview
- **Layout**: Responsive navigation with mobile support
- **API Integration**: Complete service layer with error handling
- **Configuration Management**: ✅ **COMPLETE** - Full YAML editor with validation, templates, save/load, and download functionality
- **Backup Operations**: ✅ **COMPLETE** - Manual backup triggers, real-time progress monitoring, job history, and cancellation
- **Archive Management**: ✅ **COMPLETE** - Browse archives, file browser, search, details, and deletion
- **Restore Operations**: ✅ **COMPLETE** - Archive selection, file/folder selection, destination config, preview, and restore execution
- **Scheduling**: Cron job management (basic structure)
- **Logging**: Structured logging with rotation
- **Security**: Rate limiting, CORS, authentication

### 🔄 Next Phase (Ready for Development)
- **Log Management**: Log viewing and search functionality
- **Settings Management**: System configuration and user management
- **Real-time Updates**: Server-Sent Events implementation
- **Advanced Scheduling**: Cron expression builder
- **Email Notifications**: Backup completion alerts
- **Webhook Integration**: External service notifications

### 📋 Planned
- **Email Notifications**: Backup completion alerts
- **Webhook Integration**: External service notifications
- **Advanced Analytics**: Backup statistics and trends
- **Mobile Optimization**: Touch-friendly interface
- **Plugin System**: Extensible architecture

## 🎯 Key Features

- **Resource Efficiency**: Minimal memory and CPU footprint suitable for ARM-based devices
- **Comprehensive Functionality**: Full backup management capabilities through web interface
- **Easy Deployment**: Docker-based containerization for simplified deployment
- **Security**: Authentication and secure remote access capabilities
- **User Experience**: Intuitive interface for non-technical users

## 🏗️ Technology Stack

### Backend
- **Framework**: FastAPI (Python 3.9+)
- **Process Management**: Subprocess for Borgmatic CLI interaction
- **Authentication**: JWT-based with bcrypt password hashing
- **Database**: SQLite for lightweight storage
- **Logging**: Structured logging with rotation

### Frontend
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS for lightweight, responsive design
- **State Management**: React Query + Context API
- **HTTP Client**: Axios for API communication
- **UI Components**: Lucide React icons, React Hook Form
- **Build Tool**: Vite for fast development and building

### Containerization
- **Runtime**: Docker with multi-stage builds
- **Base Image**: Python 3.9-slim for minimal footprint
- **Web Server**: Gunicorn with Uvicorn workers

## 🚀 Quick Start

### Prerequisites
- **Docker and Docker Compose** (required for production)
- ARM-based device (Raspberry Pi, Odroid, etc.) or any Linux system
- **Note**: Borg and borgmatic are automatically installed in the Docker container

### Option 1: Docker Compose (Production Ready)

> **⚠️ Important**: This application requires Borg and Borgmatic to be installed for full functionality. The Docker setup automatically installs these dependencies. For local development without Docker, you must install Borg and Borgmatic manually.

#### 1. Clone and Setup
```bash
git clone <repository-url>
cd borg-ui

# Run the test script to verify setup
./test_docker.sh
```

#### 2. Configure Environment
```bash
# Copy environment template
cp env.example .env

# Edit configuration (IMPORTANT: Change SECRET_KEY!)
nano .env
```

#### 3. Start the Application
```bash
# Start with Docker Compose
docker-compose up -d

# Or use the startup script
./start.sh
```

### Option 2: Portainer Deployment

#### 1. In Portainer:
- Go to **Stacks** → **Add stack**
- Name: `borgmatic-ui`
- Build method: **Web editor**
- Copy the contents of `docker-compose.yml`

#### 2. Environment Variables:
- Add your environment variables in the Portainer interface
- Or use the `.env` file by mounting it

#### 3. Deploy:
- Click **Deploy the stack**

### Option 3: Docker Swarm Stack

For Docker Swarm environments, use `docker-stack.yml`:

```bash
# Deploy to swarm
docker stack deploy -c docker-stack.yml borgmatic-ui
```

## 🐳 Docker Features

### **Borg Installation**
- **Automatic Installation**: Borg and borgmatic are automatically installed in the container
- **No Host Dependencies**: No need to install borg on the host system
- **Version Control**: Specific versions of borg and borgmatic are installed
- **Additional Tools**: Includes monitoring tools (htop, iotop, ncdu)

### **Portainer Compatibility**
- **UID 1001**: Uses Portainer-recommended user ID
- **Non-root Execution**: Container runs as non-root user
- **Proper Permissions**: All volumes have correct ownership
- **Health Checks**: Built-in health monitoring
- **Resource Limits**: Memory and CPU limits configured

### **Security Features**
- **Encrypted Backups**: Borg provides encryption by default
- **SSH Support**: SSH keys can be mounted for remote repositories
- **Cron Integration**: Secure cron job execution
- **Audit Logging**: Comprehensive logging system

## 🛠️ Local Development (Non-Docker)

> **⚠️ Warning**: Local development requires manual installation of Borg and Borgmatic. For production use, we strongly recommend using the Docker setup which automatically installs all dependencies.

### **Prerequisites**
- Python 3.9+
- **Borg and borgmatic installed on the host system** (required for full functionality)
- Node.js 18+ (for frontend development)

### **Installation**
```bash
# Run the installation script to install Borg and Borgmatic
./install_borg.sh
```

### **Setup**
```bash
# Clone the repository
git clone <repository-url>
cd borg-ui

# Run the setup script to create directories and configuration
./setup_directories.sh

# Install Python dependencies
pip install -r requirements.txt

# Install frontend dependencies
cd frontend && npm install && cd ..

# Start the backend
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# In another terminal, start the frontend
cd frontend && npm run dev

# The application will be available at:
# - Frontend: http://localhost:7879
# - Backend API: http://localhost:8000
# - API Documentation: http://localhost:8000/api/docs
```

### **Troubleshooting**

#### **Permission Denied Errors**
If you encounter "Permission denied" errors when creating repositories:

1. **Run the setup script**: `./setup_directories.sh`
2. **Check directory permissions**: Ensure `backups`, `config`, `logs`, and `data` directories exist and are writable
3. **Use relative paths**: Repository paths should be relative to the `backups` directory (e.g., `./backups/repo1`)
4. **Check environment variables**: Ensure `BORGMATIC_BACKUP_PATH` is set correctly in your `.env` file

#### **Common Issues**
- **"Failed to create repository: [Errno 13] Permission denied"**: Run `./setup_directories.sh` to create proper directory structure
- **"Borgmatic not available"**: Install borg and borgmatic on your system
- **"Directory 'app/static/assets' does not exist"**: Build the frontend with `cd frontend && npm run build`
./start.sh

# Or manually with Docker Compose
docker-compose up --build -d
```

### 4. Access the Application
- **Web Interface**: http://localhost:7879
- **API Documentation**: http://localhost:7879/api/docs
- **Health Check**: http://localhost:7879/api/health/system

> **Note**: Port 7879 was chosen to avoid conflicts with common services like web servers (8080) and development servers (3000). This follows the pattern of other self-hosted applications like Radarr (8989), Sonarr (8989), etc.

### 5. Default Login
- **Username**: `admin`
- **Password**: `admin123`
- **⚠️ Important**: Change the default password immediately!

## 🔧 Core Features

### 1. Dashboard
- Real-time backup status overview
- Storage metrics and system health
- Quick action buttons for common operations

### 2. Configuration Management
- YAML editor with syntax highlighting
- Configuration validation
- Template system for common scenarios

### 3. Backup Control
- Manual backup operations
- Real-time progress monitoring
- Repository selection and management

### 4. Archive Browser
- Repository and archive listing
- File browser with search capabilities
- Archive metadata and operations

### 5. Restore Functionality
- Archive selection and path browsing
- Restore destination configuration
- Progress monitoring and dry-run capabilities

### 6. Scheduling Management
- Visual cron expression builder
- Job management and execution history
- Manual trigger capabilities

### 7. Log Management
- Real-time log streaming
- Log level filtering and search
- Export capabilities

### 8. System Settings
- Authentication and user management
- Network configuration
- Notification settings

### 9. Health Monitoring
- System resource monitoring
- Backup health checks
- Alert system

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt with salt rounds
- **HTTPS Support**: TLS/SSL encryption
- **Rate Limiting**: API rate limiting to prevent abuse
- **CORS Configuration**: Configurable Cross-Origin Resource Sharing

## 📊 Resource Requirements

### Minimum Requirements
- **CPU**: 1 core ARM Cortex-A53 or equivalent
- **RAM**: 512MB (1GB recommended)
- **Storage**: 2GB for application + backup storage
- **Network**: Ethernet or WiFi connection

### Recommended Requirements
- **CPU**: 2+ cores ARM Cortex-A72 or equivalent
- **RAM**: 2GB
- **Storage**: 8GB+ for application and backup storage
- **Network**: Gigabit Ethernet

## 🧪 Testing the Backend

### 1. Health Check
```bash
curl http://localhost:7879/api/health/system
```

### 2. API Documentation
Visit http://localhost:7879/api/docs to:
- View all available endpoints
- Test API calls directly
- See request/response schemas

### 3. Authentication Test
```bash
# Login
curl -X POST "http://localhost:7879/api/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin123"

# Use the returned token for authenticated requests
curl -X GET "http://localhost:7879/api/dashboard/status" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 🛠️ Development

### Backend Development
```bash
# Install Python dependencies
pip install -r requirements.txt

# Run in development mode
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Development
```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at http://localhost:7879 and will proxy API requests to the backend at http://localhost:8000.

### Database Management
```bash
# Access SQLite database
sqlite3 borgmatic.db

# View tables
.tables

# View users
SELECT * FROM users;
```

## 📖 API Documentation

The API is fully documented with OpenAPI/Swagger:

- **Interactive Docs**: http://localhost:7879/api/docs
- **ReDoc**: http://localhost:7879/api/redoc
- **OpenAPI JSON**: http://localhost:7879/openapi.json

### Key Endpoints

#### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/refresh` - Refresh token

#### Dashboard
- `GET /api/dashboard/status` - Comprehensive dashboard status
- `GET /api/dashboard/metrics` - System metrics
- `GET /api/dashboard/health` - System health

#### Configuration
- `GET /api/config/current` - Get current configuration
- `PUT /api/config/update` - Update configuration
- `POST /api/config/validate` - Validate configuration

#### Backup
- `POST /api/backup/start` - Start manual backup
- `GET /api/backup/status/{job_id}` - Get backup status
- `DELETE /api/backup/cancel/{job_id}` - Cancel backup

#### Archives
- `GET /api/archives/list` - List archives
- `GET /api/archives/{archive_id}/info` - Get archive info
- `GET /api/archives/{archive_id}/contents` - Browse archive contents

#### Health
- `GET /api/health/system` - System health
- `GET /api/health/backups` - Backup health

## 🔄 Docker Commands

```bash
# Build and start
docker-compose up --build -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Restart services
docker-compose restart

# Rebuild without cache
docker-compose build --no-cache

# Access container shell
docker-compose exec borgmatic-ui bash
```

## 🐛 Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Change port in docker-compose.yml
   ports:
     - "8081:8000"  # Use different port
   ```

2. **Permission denied**
   ```bash
   # Fix directory permissions
   sudo chown -R $USER:$USER config backups logs
   ```

3. **Borgmatic not found**
   ```bash
   # Install borgmatic on host
   sudo apt-get install borgbackup
   pip install borgmatic
   ```

4. **Database errors**
   ```bash
   # Remove and recreate database
   rm borgmatic.db
   docker-compose restart
   ```

### Logs and Debugging
```bash
# View application logs
docker-compose logs -f borgmatic-ui

# View specific service logs
docker-compose logs -f --tail=100 borgmatic-ui

# Check container status
docker-compose ps

# Access container for debugging
docker-compose exec borgmatic-ui bash
```

## 🤝 Contributing

This project is actively being developed. Contributions are welcome in the following areas:

- **Frontend Development**: React components and UI improvements
- **Backend Enhancements**: Additional API endpoints and features
- **Testing**: Unit tests, integration tests, and E2E tests
- **Documentation**: User guides and developer documentation
- **Security**: Security audits and improvements
- **Performance**: Optimization for resource-constrained devices

## 📄 License

This project is provided as-is for educational and development purposes. The implementation should follow appropriate open-source licensing.

## 🔗 Related Links

- [Borgmatic Documentation](https://torsion.org/borgmatic/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://reactjs.org/)
- [Docker Documentation](https://docs.docker.com/)

---

**Note**: This is a working implementation with both backend API and frontend UI. The backend is fully functional, and the frontend provides a modern web interface. You can access the full application at http://localhost:7879 or run the frontend in development mode at http://localhost:7879. 