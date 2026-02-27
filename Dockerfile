FROM python:3.12-slim

# Install ffmpeg (required by yt-dlp for merging formats)
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

# Railway injects PORT at runtime; default to 5000 for local use
ENV PORT=5000

EXPOSE 5000

CMD ["sh", "-c", "python api/app.py"]
