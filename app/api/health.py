from fastapi import APIRouter, Depends, HTTPException, status
import psutil
import structlog
import time
import os
import subprocess
from typing import List, Dict, Any

from app.database.models import User
from app.core.security import get_current_user
from app.core.borgmatic import borgmatic

logger = structlog.get_logger()
router = APIRouter()

@router.get("/system")
async def get_system_health(
    current_user: User = Depends(get_current_user)
):
    """Get comprehensive system health status"""
    try:
        # CPU usage
        cpu_usage = psutil.cpu_percent(interval=1)
        
        # Memory usage
        memory = psutil.virtual_memory()
        
        # Disk usage
        disk = psutil.disk_usage('/')
        
        # System uptime
        uptime = time.time() - psutil.boot_time()
        
        # Network status (simple check)
        network_status = "connected"
        try:
            # Try to ping a reliable host
            subprocess.run(["ping", "-c", "1", "8.8.8.8"], 
                         capture_output=True, timeout=5, check=True)
        except (subprocess.TimeoutExpired, subprocess.CalledProcessError, FileNotFoundError):
            network_status = "disconnected"
        
        # Temperature (if available)
        temperature = None
        try:
            # Try to read temperature from common locations
            temp_paths = [
                "/sys/class/thermal/thermal_zone0/temp",
                "/sys/class/hwmon/hwmon0/temp1_input",
                "/proc/acpi/thermal_zone/THM0/temperature"
            ]
            for temp_path in temp_paths:
                if os.path.exists(temp_path):
                    with open(temp_path, 'r') as f:
                        temp_raw = f.read().strip()
                        if temp_raw.isdigit():
                            temperature = float(temp_raw) / 1000.0  # Convert from millidegrees
                            break
        except Exception:
            pass  # Temperature reading is optional
        
        return {
            "cpu_usage": cpu_usage,
            "memory_usage": memory.percent,
            "disk_usage": disk.percent,
            "network_status": network_status,
            "uptime": uptime,
            "temperature": temperature,
            "status": "healthy" if cpu_usage < 90 and memory.percent < 90 and disk.percent < 90 else "warning"
        }
    except Exception as e:
        logger.error("Failed to get system health", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get system health"
        )

@router.get("/repositories")
async def get_repository_health(
    current_user: User = Depends(get_current_user)
):
    """Get comprehensive repository health status"""
    try:
        # Get repository status from borgmatic
        repo_status = await borgmatic.get_repository_status()
        
        if not repo_status.get("success", False):
            return {
                "repositories": [],
                "status": "error",
                "message": "Failed to get repository status"
            }
        
        repositories = []
        for repo in repo_status.get("repositories", []):
            try:
                # Get detailed repository information
                repo_info = await borgmatic.get_repository_info(repo.get("path", ""))
                
                # Determine repository health status
                status = "healthy"
                errors = []
                
                # Check for common issues
                if not repo_info.get("last_backup"):
                    status = "warning"
                    errors.append("No backups found")
                
                if repo_info.get("backup_count", 0) == 0:
                    status = "warning"
                    errors.append("No backup archives")
                
                # Check disk space
                if repo_info.get("disk_usage", 0) > 90:
                    status = "error"
                    errors.append("Low disk space")
                
                # Check backup age
                if repo_info.get("last_backup"):
                    last_backup_time = time.mktime(time.strptime(
                        repo_info["last_backup"], "%Y-%m-%d %H:%M:%S"
                    ))
                    days_since_backup = (time.time() - last_backup_time) / 86400
                    if days_since_backup > 7:
                        status = "warning"
                        errors.append(f"Last backup was {int(days_since_backup)} days ago")
                
                repositories.append({
                    "id": len(repositories) + 1,  # Simple ID generation
                    "name": repo.get("name", os.path.basename(repo.get("path", ""))),
                    "path": repo.get("path", ""),
                    "status": status,
                    "last_backup": repo_info.get("last_backup"),
                    "backup_count": repo_info.get("backup_count", 0),
                    "total_size": repo_info.get("total_size", 0),
                    "compression_ratio": repo_info.get("compression_ratio", 0),
                    "integrity_check": repo_info.get("integrity_check", False),
                    "errors": errors
                })
                
            except Exception as e:
                logger.error(f"Failed to get info for repository {repo.get('path', '')}", error=str(e))
                repositories.append({
                    "id": len(repositories) + 1,
                    "name": os.path.basename(repo.get("path", "")),
                    "path": repo.get("path", ""),
                    "status": "error",
                    "last_backup": None,
                    "backup_count": 0,
                    "total_size": 0,
                    "compression_ratio": 0,
                    "integrity_check": False,
                    "errors": [f"Failed to get repository info: {str(e)}"]
                })
        
        return {
            "repositories": repositories,
            "status": "healthy" if all(r["status"] == "healthy" for r in repositories) else "warning"
        }
        
    except Exception as e:
        logger.error("Failed to get repository health", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get repository health"
        )

@router.get("/backups")
async def get_backup_health(
    current_user: User = Depends(get_current_user)
):
    """Get backup health status (legacy endpoint for compatibility)"""
    try:
        repo_status = await borgmatic.get_repository_status()
        return {
            "repositories": repo_status.get("repositories", []),
            "status": "healthy" if repo_status["success"] else "error"
        }
    except Exception as e:
        logger.error("Failed to get backup health", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get backup health"
        ) 