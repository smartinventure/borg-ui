#!/usr/bin/env python3
"""
Simple test script to validate the backend code structure
"""

import sys
import os

def test_imports():
    """Test if all modules can be imported"""
    print("🔍 Testing backend imports...")
    
    try:
        # Test core imports
        import app.config
        print("✅ app.config imported successfully")
        
        import app.database.database
        print("✅ app.database.database imported successfully")
        
        import app.database.models
        print("✅ app.database.models imported successfully")
        
        import app.core.security
        print("✅ app.core.security imported successfully")
        
        import app.core.borgmatic
        print("✅ app.core.borgmatic imported successfully")
        
        # Test API imports
        import app.api.auth
        print("✅ app.api.auth imported successfully")
        
        import app.api.dashboard
        print("✅ app.api.dashboard imported successfully")
        
        import app.api.config
        print("✅ app.api.config imported successfully")
        
        import app.api.backup
        print("✅ app.api.backup imported successfully")
        
        import app.api.archives
        print("✅ app.api.archives imported successfully")
        
        import app.api.restore
        print("✅ app.api.restore imported successfully")
        
        import app.api.schedule
        print("✅ app.api.schedule imported successfully")
        
        import app.api.logs
        print("✅ app.api.logs imported successfully")
        
        import app.api.settings
        print("✅ app.api.settings imported successfully")
        
        import app.api.health
        print("✅ app.api.health imported successfully")
        
        print("\n🎉 All imports successful!")
        return True
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

def test_file_structure():
    """Test if all required files exist"""
    print("\n📁 Testing file structure...")
    
    required_files = [
        "requirements.txt",
        "Dockerfile",
        "docker-compose.yml",
        "env.example",
        "start.sh",
        "app/main.py",
        "app/config.py",
        "app/database/database.py",
        "app/database/models.py",
        "app/core/security.py",
        "app/core/borgmatic.py",
        "app/api/auth.py",
        "app/api/dashboard.py",
        "app/api/config.py",
        "app/api/backup.py",
        "app/api/archives.py",
        "app/api/restore.py",
        "app/api/schedule.py",
        "app/api/logs.py",
        "app/api/settings.py",
        "app/api/health.py",
        "app/static/index.html",
    ]
    
    missing_files = []
    for file_path in required_files:
        if os.path.exists(file_path):
            print(f"✅ {file_path}")
        else:
            print(f"❌ {file_path} - MISSING")
            missing_files.append(file_path)
    
    if missing_files:
        print(f"\n⚠️  Missing {len(missing_files)} files")
        return False
    else:
        print("\n🎉 All required files present!")
        return True

def test_dependencies():
    """Test if dependencies are listed in requirements.txt"""
    print("\n📦 Testing dependencies...")
    
    try:
        with open("requirements.txt", "r") as f:
            requirements = f.read()
        
        required_deps = [
            "fastapi",
            "uvicorn",
            "gunicorn",
            "python-jose",
            "passlib",
            "sqlalchemy",
            "structlog",
            "psutil",
            "pyyaml",
            "python-dotenv"
        ]
        
        missing_deps = []
        for dep in required_deps:
            if dep in requirements:
                print(f"✅ {dep}")
            else:
                print(f"❌ {dep} - MISSING")
                missing_deps.append(dep)
        
        if missing_deps:
            print(f"\n⚠️  Missing {len(missing_deps)} dependencies")
            return False
        else:
            print("\n🎉 All required dependencies listed!")
            return True
            
    except Exception as e:
        print(f"❌ Error reading requirements.txt: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 Borgmatic Web UI - Backend Validation Test")
    print("=" * 50)
    
    # Test file structure
    structure_ok = test_file_structure()
    
    # Test dependencies
    deps_ok = test_dependencies()
    
    # Test imports (only if dependencies are available)
    if deps_ok:
        imports_ok = test_imports()
    else:
        print("\n⚠️  Skipping import tests due to missing dependencies")
        imports_ok = False
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 Test Summary:")
    print(f"   File Structure: {'✅ PASS' if structure_ok else '❌ FAIL'}")
    print(f"   Dependencies:   {'✅ PASS' if deps_ok else '❌ FAIL'}")
    print(f"   Imports:        {'✅ PASS' if imports_ok else '❌ FAIL'}")
    
    if structure_ok and deps_ok:
        print("\n🎉 Backend structure is valid!")
        print("\n📋 Next steps:")
        print("   1. Install dependencies: pip install -r requirements.txt")
        print("   2. Run with Docker: docker-compose up --build")
        print("   3. Or run directly: uvicorn app.main:app --reload")
    else:
        print("\n⚠️  Some tests failed. Please fix the issues above.")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main()) 