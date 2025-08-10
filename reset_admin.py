#!/usr/bin/env python3
"""
Utility script to reset admin password
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database.database import engine
from app.database.models import User, Base
from app.core.security import get_password_hash
from sqlalchemy.orm import sessionmaker

def reset_admin_password():
    """Reset admin password to 'admin123'"""
    # Create tables if they don't exist
    Base.metadata.create_all(bind=engine)
    
    # Create session
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Find admin user
        admin_user = db.query(User).filter(User.username == "admin").first()
        
        if admin_user:
            # Reset password
            admin_user.password_hash = get_password_hash("admin123")
            db.commit()
            print("✅ Admin password reset to 'admin123'")
        else:
            # Create admin user
            admin_user = User(
                username="admin",
                password_hash=get_password_hash("admin123"),
                email="admin@borgmatic.local",
                is_active=True,
                is_admin=True
            )
            db.add(admin_user)
            db.commit()
            print("✅ Admin user created with password 'admin123'")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    reset_admin_password() 