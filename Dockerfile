FROM node:20-bookworm-slim

WORKDIR /app

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

RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir -r requirements.txt

COPY dashboard/package*.json ./dashboard/
RUN cd dashboard && npm ci

COPY . .
RUN cd dashboard && npm run build

RUN sed -i 's/\r$//' start.sh && chmod +x start.sh

EXPOSE 3000 8000

CMD ["./start.sh"]
