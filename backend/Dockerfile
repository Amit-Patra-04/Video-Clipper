FROM python:3.11-slim

# Install system dependencies including FFmpeg and libass
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libass-dev \
    fonts-liberation \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application source
COPY . .

# Create storage directories
RUN mkdir -p storage/uploads storage/audio storage/clips storage/exports

ENV PYTHONUNBUFFERED=1
ENV PORT=8000

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
