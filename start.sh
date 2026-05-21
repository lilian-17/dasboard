#!/usr/bin/env bash
set -e

# Start backend
(cd backend && node server.js) &
BACKEND_PID=$!

# Start frontend
(cd frontend && npm run dev) &
FRONTEND_PID=$!

echo "Backend  → http://localhost:3001"
echo "Frontend → http://localhost:5173"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT INT TERM
wait
