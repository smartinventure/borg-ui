from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime
import structlog
import os
import subprocess
import asyncio
import tempfile
from cryptography.fernet import Fernet
import base64

from app.database.database import get_db
from app.database.models import User, SSHKey
from app.core.security import get_current_user
from app.config import settings

logger = structlog.get_logger()
router = APIRouter(tags=["ssh-keys"])

# Pydantic models
from pydantic import BaseModel

class SSHKeyCreate(BaseModel):
    name: str
    description: Optional[str] = None
    key_type: str = "rsa"  # rsa, ed25519, ecdsa
    public_key: str
    private_key: str

class SSHKeyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class SSHKeyInfo(BaseModel):
    id: int
    name: str
    description: Optional[str]
    key_type: str
    public_key: str
    is_active: bool
    created_at: str
    updated_at: Optional[str]

@router.get("/")
async def get_ssh_keys(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all SSH keys"""
    try:
        ssh_keys = db.query(SSHKey).all()
        return {
            "success": True,
            "ssh_keys": [
                {
                    "id": key.id,
                    "name": key.name,
                    "description": key.description,
                    "key_type": key.key_type,
                    "public_key": key.public_key,
                    "is_active": key.is_active,
                    "created_at": key.created_at.isoformat(),
                    "updated_at": key.updated_at.isoformat() if key.updated_at else None
                }
                for key in ssh_keys
            ]
        }
    except Exception as e:
        logger.error("Failed to get SSH keys", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to retrieve SSH keys: {str(e)}")

@router.post("/")
async def create_ssh_key(
    key_data: SSHKeyCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new SSH key"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        # Check if SSH key name already exists
        existing_key = db.query(SSHKey).filter(SSHKey.name == key_data.name).first()
        if existing_key:
            raise HTTPException(status_code=400, detail="SSH key name already exists")
        
        # Validate SSH key format
        if not key_data.public_key.startswith(('ssh-rsa', 'ssh-ed25519', 'ecdsa-sha2')):
            raise HTTPException(status_code=400, detail="Invalid public key format")
        
        # Encrypt private key
        encryption_key = settings.secret_key.encode()[:32]
        cipher = Fernet(base64.urlsafe_b64encode(encryption_key))
        encrypted_private_key = cipher.encrypt(key_data.private_key.encode()).decode()
        
        # Create SSH key record
        ssh_key = SSHKey(
            name=key_data.name,
            description=key_data.description,
            key_type=key_data.key_type,
            public_key=key_data.public_key,
            private_key=encrypted_private_key,
            is_active=True
        )
        
        db.add(ssh_key)
        db.commit()
        db.refresh(ssh_key)
        
        logger.info("SSH key created", name=key_data.name, user=current_user.username)
        
        return {
            "success": True,
            "message": "SSH key created successfully",
            "ssh_key": {
                "id": ssh_key.id,
                "name": ssh_key.name,
                "description": ssh_key.description,
                "key_type": ssh_key.key_type,
                "public_key": ssh_key.public_key,
                "is_active": ssh_key.is_active
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to create SSH key", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to create SSH key: {str(e)}")

@router.post("/generate")
async def generate_ssh_key(
    name: str,
    key_type: str = "rsa",
    description: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate a new SSH key pair"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        # Check if SSH key name already exists
        existing_key = db.query(SSHKey).filter(SSHKey.name == name).first()
        if existing_key:
            raise HTTPException(status_code=400, detail="SSH key name already exists")
        
        # Validate key type
        valid_types = ["rsa", "ed25519", "ecdsa"]
        if key_type not in valid_types:
            raise HTTPException(status_code=400, detail=f"Invalid key type. Must be one of: {', '.join(valid_types)}")
        
        # Generate SSH key pair
        key_result = await generate_ssh_key_pair(key_type)
        
        if not key_result["success"]:
            raise HTTPException(status_code=500, detail=f"Failed to generate SSH key: {key_result['error']}")
        
        # Encrypt private key
        encryption_key = settings.secret_key.encode()[:32]
        cipher = Fernet(base64.urlsafe_b64encode(encryption_key))
        encrypted_private_key = cipher.encrypt(key_result["private_key"].encode()).decode()
        
        # Create SSH key record
        ssh_key = SSHKey(
            name=name,
            description=description,
            key_type=key_type,
            public_key=key_result["public_key"],
            private_key=encrypted_private_key,
            is_active=True
        )
        
        db.add(ssh_key)
        db.commit()
        db.refresh(ssh_key)
        
        logger.info("SSH key generated", name=name, key_type=key_type, user=current_user.username)
        
        return {
            "success": True,
            "message": "SSH key generated successfully",
            "ssh_key": {
                "id": ssh_key.id,
                "name": ssh_key.name,
                "description": ssh_key.description,
                "key_type": ssh_key.key_type,
                "public_key": ssh_key.public_key,
                "is_active": ssh_key.is_active
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to generate SSH key", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to generate SSH key: {str(e)}")

@router.get("/{key_id}")
async def get_ssh_key(
    key_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get SSH key details"""
    try:
        ssh_key = db.query(SSHKey).filter(SSHKey.id == key_id).first()
        if not ssh_key:
            raise HTTPException(status_code=404, detail="SSH key not found")
        
        return {
            "success": True,
            "ssh_key": {
                "id": ssh_key.id,
                "name": ssh_key.name,
                "description": ssh_key.description,
                "key_type": ssh_key.key_type,
                "public_key": ssh_key.public_key,
                "is_active": ssh_key.is_active,
                "created_at": ssh_key.created_at.isoformat(),
                "updated_at": ssh_key.updated_at.isoformat() if ssh_key.updated_at else None
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get SSH key", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to retrieve SSH key: {str(e)}")

@router.put("/{key_id}")
async def update_ssh_key(
    key_id: int,
    key_data: SSHKeyUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update SSH key"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        ssh_key = db.query(SSHKey).filter(SSHKey.id == key_id).first()
        if not ssh_key:
            raise HTTPException(status_code=404, detail="SSH key not found")
        
        # Update fields
        if key_data.name is not None:
            # Check if name already exists
            existing_key = db.query(SSHKey).filter(
                SSHKey.name == key_data.name,
                SSHKey.id != key_id
            ).first()
            if existing_key:
                raise HTTPException(status_code=400, detail="SSH key name already exists")
            ssh_key.name = key_data.name
        
        if key_data.description is not None:
            ssh_key.description = key_data.description
        
        if key_data.is_active is not None:
            ssh_key.is_active = key_data.is_active
        
        ssh_key.updated_at = datetime.utcnow()
        db.commit()
        
        logger.info("SSH key updated", key_id=key_id, user=current_user.username)
        
        return {
            "success": True,
            "message": "SSH key updated successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to update SSH key", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to update SSH key: {str(e)}")

@router.delete("/{key_id}")
async def delete_ssh_key(
    key_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete SSH key"""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        ssh_key = db.query(SSHKey).filter(SSHKey.id == key_id).first()
        if not ssh_key:
            raise HTTPException(status_code=404, detail="SSH key not found")
        
        # Check if SSH key is used by any repositories
        if ssh_key.repositories:
            raise HTTPException(
                status_code=400, 
                detail="Cannot delete SSH key that is used by repositories. Please remove or update repositories first."
            )
        
        # Delete SSH key from database
        db.delete(ssh_key)
        db.commit()
        
        logger.info("SSH key deleted", key_id=key_id, user=current_user.username)
        
        return {
            "success": True,
            "message": "SSH key deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to delete SSH key", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to delete SSH key: {str(e)}")

@router.post("/{key_id}/test-connection")
async def test_ssh_connection(
    key_id: int,
    host: str,
    username: str,
    port: int = 22,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Test SSH connection with the specified key"""
    try:
        ssh_key = db.query(SSHKey).filter(SSHKey.id == key_id).first()
        if not ssh_key:
            raise HTTPException(status_code=404, detail="SSH key not found")
        
        # Test SSH connection
        test_result = await test_ssh_key_connection(ssh_key, host, username, port)
        
        return {
            "success": True,
            "connection_test": test_result
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to test SSH connection", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to test SSH connection: {str(e)}")

async def generate_ssh_key_pair(key_type: str) -> Dict[str, Any]:
    """Generate SSH key pair using ssh-keygen"""
    try:
        # Create temporary directory for key generation
        with tempfile.TemporaryDirectory() as temp_dir:
            key_file = os.path.join(temp_dir, f"id_{key_type}")
            
            # Build ssh-keygen command
            cmd = ["ssh-keygen", "-t", key_type, "-f", key_file, "-N", ""]
            
            # Execute command
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=30)
            
            if process.returncode != 0:
                return {
                    "success": False,
                    "error": stderr.decode() if stderr else "Unknown error"
                }
            
            # Read generated keys
            with open(f"{key_file}.pub", "r") as f:
                public_key = f.read().strip()
            
            with open(key_file, "r") as f:
                private_key = f.read().strip()
            
            return {
                "success": True,
                "public_key": public_key,
                "private_key": private_key
            }
    except Exception as e:
        logger.error("Failed to generate SSH key pair", error=str(e))
        return {
            "success": False,
            "error": str(e)
        }

async def test_ssh_key_connection(ssh_key: SSHKey, host: str, username: str, port: int) -> Dict[str, Any]:
    """Test SSH connection using the specified key"""
    try:
        # Decrypt private key
        encryption_key = settings.secret_key.encode()[:32]
        cipher = Fernet(base64.urlsafe_b64encode(encryption_key))
        private_key = cipher.decrypt(ssh_key.private_key.encode()).decode()
        
        # Create temporary key file
        with tempfile.NamedTemporaryFile(mode='w', delete=False) as f:
            f.write(private_key)
            temp_key_file = f.name
        
        try:
            # Test SSH connection
            cmd = [
                "ssh", "-i", temp_key_file, "-o", "StrictHostKeyChecking=no",
                "-o", "ConnectTimeout=10", "-p", str(port),
                f"{username}@{host}", "echo 'SSH connection successful'"
            ]
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=15)
            
            if process.returncode == 0:
                return {
                    "success": True,
                    "message": "SSH connection successful",
                    "output": stdout.decode().strip()
                }
            else:
                return {
                    "success": False,
                    "error": stderr.decode() if stderr else "SSH connection failed",
                    "return_code": process.returncode
                }
        finally:
            # Clean up temporary key file
            os.unlink(temp_key_file)
    except Exception as e:
        logger.error("Failed to test SSH connection", error=str(e))
        return {
            "success": False,
            "error": str(e)
        }
