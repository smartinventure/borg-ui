from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
import structlog
from typing import List, Dict, Any

from app.database.database import get_db
from app.database.models import User, BackupJob
from app.core.security import get_current_user
from app.core.borgmatic import borgmatic
from app.api.events import event_manager

logger = structlog.get_logger()
router = APIRouter()

# Pydantic models
class BackupRequest(BaseModel):
    repository: str = None
    config_file: str = None

class BackupResponse(BaseModel):
    job_id: int
    status: str
    message: str

@router.post("/start", response_model=BackupResponse)
async def start_backup(
    backup_request: BackupRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Start a manual backup operation"""
    try:
        # Create backup job record
        backup_job = BackupJob(
            repository=backup_request.repository or "default",
            status="running"
        )
        db.add(backup_job)
        db.commit()
        db.refresh(backup_job)
        
        # Send initial progress update
        await event_manager.broadcast_event(
            "backup_progress",
            {
                "job_id": str(backup_job.id),
                "progress": 0,
                "status": "starting",
                "message": "Backup job started"
            },
            str(current_user.id)
        )
        
        # Execute backup
        result = await borgmatic.run_backup(
            repository=backup_request.repository,
            config_file=backup_request.config_file
        )
        
        # Update job status
        if result["success"]:
            backup_job.status = "completed"
            backup_job.progress = 100
            backup_job.logs = result["stdout"]
            
            # Send completion update
            await event_manager.broadcast_event(
                "backup_progress",
                {
                    "job_id": str(backup_job.id),
                    "progress": 100,
                    "status": "completed",
                    "message": "Backup completed successfully"
                },
                str(current_user.id)
            )
        else:
            backup_job.status = "failed"
            backup_job.error_message = result["stderr"]
            backup_job.logs = result["stdout"]
            
            # Send failure update
            await event_manager.broadcast_event(
                "backup_progress",
                {
                    "job_id": str(backup_job.id),
                    "progress": 0,
                    "status": "failed",
                    "message": f"Backup failed: {result['stderr']}"
                },
                str(current_user.id)
            )
        
        db.commit()
        
        logger.info("Backup completed", job_id=backup_job.id, user=current_user.username)
        
        return BackupResponse(
            job_id=backup_job.id,
            status=backup_job.status,
            message="Backup completed successfully" if result["success"] else "Backup failed"
        )
    except Exception as e:
        logger.error("Failed to start backup", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to start backup"
        )

@router.get("/status/{job_id}")
async def get_backup_status(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get backup job status"""
    try:
        job = db.query(BackupJob).filter(BackupJob.id == job_id).first()
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Backup job not found"
            )
        
        return {
            "id": job.id,
            "repository": job.repository,
            "status": job.status,
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
            "progress": job.progress,
            "error_message": job.error_message,
            "logs": job.logs
        }
    except Exception as e:
        logger.error("Failed to get backup status", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get backup status"
        )

@router.delete("/cancel/{job_id}")
async def cancel_backup(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel a running backup job"""
    try:
        job = db.query(BackupJob).filter(BackupJob.id == job_id).first()
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Backup job not found"
            )
        
        if job.status != "running":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Can only cancel running jobs"
            )
        
        job.status = "cancelled"
        db.commit()
        
        logger.info("Backup cancelled", job_id=job_id, user=current_user.username)
        return {"message": "Backup cancelled successfully"}
    except Exception as e:
        logger.error("Failed to cancel backup", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel backup"
        )

@router.get("/logs/{job_id}")
async def get_backup_logs(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get backup job logs"""
    try:
        job = db.query(BackupJob).filter(BackupJob.id == job_id).first()
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Backup job not found"
            )
        
        return {
            "job_id": job.id,
            "logs": job.logs or "",
            "error_message": job.error_message or ""
        }
    except Exception as e:
        logger.error("Failed to get backup logs", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get backup logs"
        ) 