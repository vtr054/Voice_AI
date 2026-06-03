#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "🚀 Starting Outbound Mass Caller..."

if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

BACKEND_PORT=${BACKEND_PORT:-8000}
PORT=${PORT:-3000}

echo "📋 Configuration:"
echo "   LiveKit: ${LIVEKIT_URL}"
echo "   Gemini: ${GEMINI_MODEL:-gemini-3.1-flash-live-preview}"
echo "   MySQL Host: ${MYSQL_HOST:-localhost}"
echo "   Backend Port: ${BACKEND_PORT}"
echo "   Frontend Port: ${PORT}"

if [ -d "/opt/venv" ]; then
    source /opt/venv/bin/activate
fi

echo "🌐 Starting FastAPI server on port ${BACKEND_PORT}..."
python3 -m uvicorn server:app --host 0.0.0.0 --port ${BACKEND_PORT} &
SERVER_PID=$!

echo "💻 Starting Next.js Dashboard on port ${PORT}..."
cd dashboard
npx next start -H 0.0.0.0 -p ${PORT} &
NEXT_PID=$!
cd ..

sleep 3

echo "🤖 Starting LiveKit agent worker..."
python3 agent.py start

kill $SERVER_PID $NEXT_PID 2>/dev/null || true
