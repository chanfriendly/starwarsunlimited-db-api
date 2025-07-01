# Backend Dockerfile - Production ready with database initialization

FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    curl \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY src ./src
COPY scripts ./scripts

# Make the database initialization script executable
RUN chmod +x scripts/init_databases_docker.py

# Set environment variables
ENV PYTHONPATH=/app
ENV PATH=/usr/local/bin:$PATH

# Create startup script
RUN echo '#!/bin/bash\n\
set -e\n\
echo "🚀 Starting Star Wars Unlimited Backend Container"\n\
echo "📁 Current directory: $(pwd)"\n\
echo "🗂️ Directory contents:"\n\
ls -la\n\
echo "🌐 Environment variables:"\n\
echo "  DB_DIR: $DB_DIR"\n\
echo "  DATABASE_URL: $DATABASE_URL"\n\
echo "  CARD_DATABASE_URL: $CARD_DATABASE_URL"\n\
echo ""\n\
echo "🔧 Initializing databases..."\n\
python3 scripts/init_databases_docker.py\n\
if [ $? -eq 0 ]; then\n\
    echo "✅ Database initialization completed successfully"\n\
else\n\
    echo "❌ Database initialization failed"\n\
    exit 1\n\
fi\n\
echo ""\n\
echo "🚀 Starting FastAPI application..."\n\
exec uvicorn src.api.main:app --host 0.0.0.0 --port 8000\n\
' > /app/startup.sh && chmod +x /app/startup.sh

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Use the startup script
CMD ["/app/startup.sh"]