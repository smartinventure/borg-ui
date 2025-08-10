from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
import yaml
import structlog
from typing import List, Dict, Any

from app.database.database import get_db
from app.database.models import User
from app.core.security import get_current_user, get_current_admin_user
from app.core.borgmatic import borgmatic
from app.config import settings

logger = structlog.get_logger()
router = APIRouter()

# Pydantic models
class ConfigContent(BaseModel):
    content: str

class ConfigValidation(BaseModel):
    valid: bool
    errors: List[str] = []
    warnings: List[str] = []

class ConfigTemplate(BaseModel):
    name: str
    description: str
    content: str

class ConfigBackupResponse(BaseModel):
    id: int
    name: str
    description: str = None
    created_at: str

    class Config:
        from_attributes = True

@router.get("/current")
async def get_current_config(
    current_user: User = Depends(get_current_user)
):
    """Get current borgmatic configuration"""
    try:
        config_info = await borgmatic.get_config_info()
        if not config_info["success"]:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=config_info.get("error", "Configuration not found")
            )
        
        return {
            "content": yaml.dump(config_info["config"], default_flow_style=False),
            "config_path": config_info["config_path"],
            "parsed": config_info["config"]
        }
    except Exception as e:
        logger.error("Failed to get current config", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get configuration"
        )

@router.put("/update")
async def update_config(
    config_data: ConfigContent,
    current_user: User = Depends(get_current_admin_user)
):
    """Update borgmatic configuration"""
    try:
        # Validate configuration
        validation = await borgmatic.validate_config(config_data.content)
        if not validation["success"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid configuration: {validation['error']}"
            )
        
        # Write configuration file
        config_path = settings.borgmatic_config_path
        with open(config_path, 'w') as f:
            f.write(config_data.content)
        
        logger.info("Configuration updated", user=current_user.username)
        return {"message": "Configuration updated successfully"}
    except Exception as e:
        logger.error("Failed to update config", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update configuration"
        )

@router.post("/validate")
async def validate_config(
    config_data: ConfigContent,
    current_user: User = Depends(get_current_user)
):
    """Validate configuration content"""
    try:
        validation = await borgmatic.validate_config(config_data.content)
        return ConfigValidation(
            valid=validation["success"],
            errors=validation.get("errors", [validation["error"]] if not validation["success"] else []),
            warnings=validation.get("warnings", [])
        )
    except Exception as e:
        logger.error("Failed to validate config", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to validate configuration"
        )

@router.get("/templates")
async def get_config_templates(
    current_user: User = Depends(get_current_user)
):
    """Get available configuration templates"""
    templates = [
        ConfigTemplate(
            name="basic",
            description="Basic backup configuration",
            content="""repositories:
  - path: /path/to/repository
    label: my-backup

storage:
  compression: lz4
  encryption: repokey

retention:
  keep_daily: 7
  keep_weekly: 4
  keep_monthly: 6

consistency:
  checks:
    - repository
    - archives
  check_last: 3"""
        ),
        ConfigTemplate(
            name="encrypted",
            description="Encrypted backup configuration",
            content="""repositories:
  - path: /path/to/encrypted/repository
    label: encrypted-backup

storage:
  compression: zstd
  encryption: repokey-blake2

retention:
  keep_daily: 7
  keep_weekly: 4
  keep_monthly: 12
  keep_yearly: 3

consistency:
  checks:
    - repository
    - archives
  check_last: 3"""
        ),
        ConfigTemplate(
            name="minimal",
            description="Minimal backup configuration",
            content="""repositories:
  - path: /path/to/repository

storage:
  compression: lz4

retention:
  keep_daily: 7"""
        )
    ]
    
    return templates

@router.post("/backup")
async def backup_config(
    backup_data: ConfigContent,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Backup current configuration"""
    # TODO: Implement when ConfigBackup model is added back
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Configuration backup not implemented yet"
    )

@router.get("/backups", response_model=List[ConfigBackupResponse])
async def list_config_backups(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List configuration backups"""
    # TODO: Implement when ConfigBackup model is added back
    return []

@router.get("/backups/{backup_id}")
async def get_config_backup(
    backup_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get specific configuration backup"""
    # TODO: Implement when ConfigBackup model is added back
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Configuration backup not found"
    )

@router.post("/restore/{backup_id}")
async def restore_config_backup(
    backup_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Restore configuration from backup"""
    # TODO: Implement when ConfigBackup model is added back
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Configuration restore not implemented yet"
    ) 