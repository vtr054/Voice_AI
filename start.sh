#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "🚀 Starting Outbound Mass Caller..."

if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

echo "📋 Configuration:"
echo "   LiveKit: ${LIVEKIT_URL}"
echo "   Gemini: ${GEMINI_MODEL:-gemini-3.1-flash-live-preview}"
echo "   Supabase: ${SUPABASE_URL}"

BACKEND_PORT=${BACKEND_PORT:-8000}
echo "🌐 Starting FastAPI server on port ${BACKEND_PORT}..."
python3 -m uvicorn server:app --host 0.0.0.0 --port ${BACKEND_PORT} &
SERVER_PID=$!

sleep 2

echo "🤖 Starting LiveKit agent worker..."
python3 agent.py start

kill $SERVER_PID 2>/dev/null || true
