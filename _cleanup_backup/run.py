# run.py
import os
import sys

# Add the current directory to the path so Python can find the modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.src.api.main import app

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.src.api.main:app", host="0.0.0.0", port=8000, reload=True)