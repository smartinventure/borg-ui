from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import structlog

from app.config import settings
from app.database.database import get_db
from app.database.models import User

logger = structlog.get_logger()

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT token security
security = HTTPBearer()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create a JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt

def verify_token(token: str) -> Optional[str]:
    """Verify and decode a JWT token"""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        username: str = payload.get("sub")
        if username is None:
            return None
        return username
    except JWTError:
        return None

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Get the current authenticated user"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        username = verify_token(credentials.credentials)
        if username is None:
            raise credentials_exception
        
        user = db.query(User).filter(User.username == username).first()
        if user is None:
            raise credentials_exception
        
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Inactive user"
            )
        
        return user
    except JWTError:
        raise credentials_exception

async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Get the current active user"""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

async def get_current_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """Get the current admin user"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user

async def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
    """Authenticate a user with username and password"""
    user = db.query(User).filter(User.username == username).first()
    if not user:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user

async def create_first_user():
    """Create the first admin user if no users exist"""
    db = next(get_db())
    try:
        # Check if admin user already exists
        admin_user = db.query(User).filter(User.username == "admin").first()
        if admin_user:
            logger.info("Admin user already exists", username="admin")
            return
        
        # Check if any users exist
        user_count = db.query(User).count()
        if user_count == 0:
            # Generate secure random password
            import secrets
            import string
            
            # Generate 20-character password with mixed case, numbers, and symbols
            alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
            default_password = ''.join(secrets.choice(alphabet) for _ in range(20))
            hashed_password = get_password_hash(default_password)
            
            admin_user = User(
                username="admin",
                password_hash=hashed_password,
                email="admin@borgmatic.local",
                is_active=True,
                is_admin=True
            )
            
            db.add(admin_user)
            db.commit()
            
            logger.info("Created default admin user", username="admin")
            logger.warning(
                "SECURE ADMIN PASSWORD GENERATED - SAVE THIS SECURELY!",
                username="admin",
                password=default_password
            )
            
            # Print password to console for user to save
            print("\n" + "="*60)
            print("🔐 SECURELY GENERATED ADMIN PASSWORD")
            print("="*60)
            print(f"Username: admin")
            print(f"Password: {default_password}")
            print("="*60)
            print("⚠️  STORE THIS SECURELY - WILL NOT BE SHOWN AGAIN!")
            print("="*60)
            print("Press Enter to continue...")
            input()
            
    except Exception as e:
        # Check if it's a duplicate key error
        if "UNIQUE constraint failed" in str(e) or "duplicate key" in str(e).lower():
            logger.info("Admin user already exists (caught constraint error)", username="admin")
        else:
            logger.error("Failed to create first user", error=str(e))
        db.rollback()
    finally:
        db.close()

def create_user(db: Session, username: str, password: str, email: str = None, is_admin: bool = False) -> User:
    """Create a new user"""
    hashed_password = get_password_hash(password)
    user = User(
        username=username,
        password_hash=hashed_password,
        email=email,
        is_admin=is_admin
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def update_user_password(db: Session, user_id: int, new_password: str) -> bool:
    """Update a user's password"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return False
    
    user.password_hash = get_password_hash(new_password)
    db.commit()
    return True 