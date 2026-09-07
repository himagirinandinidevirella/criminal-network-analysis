# ─────────────────────────────────────────────────────────────
# CrimeNet AI — Backend image
# ─────────────────────────────────────────────────────────────
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# System dependencies required by torch / numpy / psycopg2 / tesseract
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        gcc \
        g++ \
        libpq-dev \
        curl \
        tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (better layer caching)
COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

# Download spaCy language model used by the NLP entity extractor
RUN python -m spacy download en_core_web_sm

# Copy application source
COPY . .

EXPOSE 8000

# Single worker to keep in-memory model/WebSocket state consistent;
# scale horizontally behind nginx for multi-instance deployments.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
