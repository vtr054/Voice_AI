FROM node:20-bookworm-slim

# Install Python and build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        python3-venv \
        python3-dev \
        build-essential \
        libgomp1 \
        libglib2.0-0 \
        libsndfile1 \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Setup python virtual environment
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy python dependencies and install
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir -r requirements.txt

# Copy Next.js package files and install dependencies
COPY dashboard/package*.json ./dashboard/
RUN cd dashboard && npm ci

# Copy all source files
COPY . .

# Build Next.js dashboard
RUN cd dashboard && npm run build

# Normalize start.sh line endings and make it executable
RUN sed -i 's/\r$//' start.sh && chmod +x start.sh

# Create persistent data directory for sqlite database
RUN mkdir -p /data
ENV DB_PATH=/data/appointments.db

EXPOSE 3000 8000

CMD ["./start.sh"]
