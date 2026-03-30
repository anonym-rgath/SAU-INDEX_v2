# Backend Dockerfile - Raspberry Pi (ARM64) kompatibel
FROM python:3.11-slim

WORKDIR /app

# System dependencies inkl. curl für healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies (Production-only)
COPY requirements.prod.txt .
RUN pip install --no-cache-dir -r requirements.prod.txt

# Application code (ohne .env - wird über docker-compose gesetzt)
COPY server.py .

# Expose port
EXPOSE 8001

# Start server
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
