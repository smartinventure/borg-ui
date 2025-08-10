from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timedelta
import os
import re
from app.core.security import get_current_user
from app.database.models import User
from app.core.borgmatic import BorgmaticInterface
import structlog

logger = structlog.get_logger()
router = APIRouter(tags=["logs"])

# Initialize Borgmatic interface
borgmatic = BorgmaticInterface()

@router.get("/")
async def get_logs(
    current_user: User = Depends(get_current_user),
    log_type: str = Query("borgmatic", description="Type of logs to retrieve"),
    lines: int = Query(100, description="Number of lines to retrieve"),
    search: Optional[str] = Query(None, description="Search term"),
    level: Optional[str] = Query(None, description="Log level filter"),
    start_time: Optional[datetime] = Query(None, description="Start time filter"),
    end_time: Optional[datetime] = Query(None, description="End time filter")
):
    """Get logs with optional filtering and search"""
    try:
        # Determine log file path based on type
        if log_type == "borgmatic":
            log_path = "/app/logs/borgmatic.log"
        elif log_type == "system":
            log_path = "/var/log/syslog"
        elif log_type == "application":
            log_path = "/app/logs/app.log"
        else:
            raise HTTPException(status_code=400, detail="Invalid log type")
        
        if not os.path.exists(log_path):
            return {
                "success": True,
                "logs": [],
                "total_lines": 0,
                "message": f"Log file {log_path} not found"
            }
        
        # Read log file
        with open(log_path, 'r') as f:
            all_lines = f.readlines()
        
        # Apply filters
        filtered_lines = []
        for line in all_lines:
            # Apply search filter
            if search and search.lower() not in line.lower():
                continue
            
            # Apply level filter
            if level and level.upper() not in line.upper():
                continue
            
            # Apply time filter (basic implementation)
            if start_time or end_time:
                try:
                    # Extract timestamp from log line (adjust pattern as needed)
                    timestamp_match = re.search(r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})', line)
                    if timestamp_match:
                        log_time = datetime.strptime(timestamp_match.group(1), '%Y-%m-%d %H:%M:%S')
                        if start_time and log_time < start_time:
                            continue
                        if end_time and log_time > end_time:
                            continue
                except:
                    pass  # Skip time filtering if timestamp parsing fails
            
            filtered_lines.append(line)
        
        # Get requested number of lines (from end)
        total_lines = len(filtered_lines)
        if lines > 0:
            filtered_lines = filtered_lines[-lines:]
        
        return {
            "success": True,
            "logs": filtered_lines,
            "total_lines": total_lines,
            "log_type": log_type,
            "log_path": log_path
        }
        
    except Exception as e:
        logger.error("Failed to get logs", error=str(e), log_type=log_type)
        raise HTTPException(status_code=500, detail=f"Failed to retrieve logs: {str(e)}")

@router.get("/types")
async def get_log_types(current_user: User = Depends(get_current_user)):
    """Get available log types"""
    log_types = [
        {
            "id": "borgmatic",
            "name": "Borgmatic Logs",
            "description": "Backup operation logs",
            "path": "/app/logs/borgmatic.log"
        },
        {
            "id": "application",
            "name": "Application Logs",
            "description": "Web UI application logs",
            "path": "/app/logs/app.log"
        },
        {
            "id": "system",
            "name": "System Logs",
            "description": "System and service logs",
            "path": "/var/log/syslog"
        }
    ]
    
    return {
        "success": True,
        "log_types": log_types
    }

@router.get("/stats")
async def get_log_stats(
    current_user: User = Depends(get_current_user),
    log_type: str = Query("borgmatic", description="Type of logs to analyze"),
    hours: int = Query(24, description="Hours to analyze")
):
    """Get log statistics for the specified time period"""
    try:
        # Determine log file path
        if log_type == "borgmatic":
            log_path = "/app/logs/borgmatic.log"
        elif log_type == "system":
            log_path = "/var/log/syslog"
        elif log_type == "application":
            log_path = "/app/logs/app.log"
        else:
            raise HTTPException(status_code=400, detail="Invalid log type")
        
        if not os.path.exists(log_path):
            return {
                "success": True,
                "stats": {
                    "total_entries": 0,
                    "error_count": 0,
                    "warning_count": 0,
                    "info_count": 0,
                    "success_rate": 0.0
                }
            }
        
        # Calculate time threshold
        threshold_time = datetime.now() - timedelta(hours=hours)
        
        # Read and analyze logs
        with open(log_path, 'r') as f:
            lines = f.readlines()
        
        stats = {
            "total_entries": 0,
            "error_count": 0,
            "warning_count": 0,
            "info_count": 0,
            "success_rate": 0.0
        }
        
        for line in lines:
            try:
                # Extract timestamp and check if within time range
                timestamp_match = re.search(r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})', line)
                if timestamp_match:
                    log_time = datetime.strptime(timestamp_match.group(1), '%Y-%m-%d %H:%M:%S')
                    if log_time >= threshold_time:
                        stats["total_entries"] += 1
                        
                        # Count by level
                        line_lower = line.lower()
                        if "error" in line_lower:
                            stats["error_count"] += 1
                        elif "warning" in line_lower:
                            stats["warning_count"] += 1
                        elif "info" in line_lower:
                            stats["info_count"] += 1
            except:
                continue
        
        # Calculate success rate (basic implementation)
        if stats["total_entries"] > 0:
            non_error_entries = stats["total_entries"] - stats["error_count"]
            stats["success_rate"] = (non_error_entries / stats["total_entries"]) * 100
        
        return {
            "success": True,
            "stats": stats,
            "time_period_hours": hours
        }
        
    except Exception as e:
        logger.error("Failed to get log stats", error=str(e), log_type=log_type)
        raise HTTPException(status_code=500, detail=f"Failed to retrieve log statistics: {str(e)}")

@router.delete("/clear")
async def clear_logs(
    current_user: User = Depends(get_current_user),
    log_type: str = Query("borgmatic", description="Type of logs to clear")
):
    """Clear logs (admin only)"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        # Determine log file path
        if log_type == "borgmatic":
            log_path = "/app/logs/borgmatic.log"
        elif log_type == "application":
            log_path = "/app/logs/app.log"
        else:
            raise HTTPException(status_code=400, detail="Invalid log type")
        
        if os.path.exists(log_path):
            # Clear the log file
            with open(log_path, 'w') as f:
                f.write("")
            
            logger.info("Logs cleared", log_type=log_type, user=current_user.username)
            
            return {
                "success": True,
                "message": f"Logs cleared successfully: {log_type}"
            }
        else:
            return {
                "success": True,
                "message": f"Log file not found: {log_path}"
            }
            
    except Exception as e:
        logger.error("Failed to clear logs", error=str(e), log_type=log_type)
        raise HTTPException(status_code=500, detail=f"Failed to clear logs: {str(e)}") 