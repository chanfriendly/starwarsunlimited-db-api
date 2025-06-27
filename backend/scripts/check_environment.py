# backend/check_environment.py
# Run this script to check if your backend environment is set up correctly

import sys
import subprocess

def check_package(package_name):
    """Check if a package is installed"""
    try:
        __import__(package_name)
        print(f"✅ {package_name} is installed")
        return True
    except ImportError:
        print(f"❌ {package_name} is missing")
        return False

def install_requirements():
    """Install requirements from requirements.txt"""
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✅ Requirements installed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install requirements: {e}")
        return False

def main():
    print("🔍 Checking Python environment for Star Wars Unlimited backend...")
    print(f"Python version: {sys.version}")
    print()
    
    # Check if we're in a virtual environment
    if hasattr(sys, 'real_prefix') or (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix):
        print("✅ Virtual environment detected")
    else:
        print("⚠️  No virtual environment detected. Consider using: python -m venv venv")
    print()
    
    # Check required packages
    required_packages = [
        'fastapi',
        'uvicorn',
        'sqlalchemy',
        'pydantic',
        'python-jose',
        'passlib',
        'bcrypt',
        'python-multipart'
    ]
    
    print("Checking required packages:")
    missing_packages = []
    for package in required_packages:
        # Handle package name variations
        check_name = package
        if package == 'python-jose':
            check_name = 'jose'
        elif package == 'python-multipart':
            check_name = 'multipart'
        
        if not check_package(check_name):
            missing_packages.append(package)
    
    print()
    
    if missing_packages:
        print("❌ Missing packages detected. Attempting to install...")
        print("Run the following command:")
        print("pip install " + " ".join(missing_packages))
        print()
        print("Or install all requirements:")
        print("pip install -r requirements.txt")
    else:
        print("✅ All required packages are installed!")
        print()
        print("You can start the backend with:")
        print("uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000")

if __name__ == "__main__":
    main()