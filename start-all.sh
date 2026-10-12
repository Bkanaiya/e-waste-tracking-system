#!/usr/bin/env bash
#
# start-all.sh - start the off-chain half of the E-Waste Tracking System.
#
# Brings up:  DynamoDB Local (Docker)  ->  backend REST API (Express)  ->  frontend (Vite)
# It does NOT start the Fabric network. Run ./scripts/setup-network.sh first
# (once, and again after a reboot).
#
# Usage:  ./start-all.sh
#
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
LOGDIR="$ROOT/.logs"
mkdir -p "$LOGDIR"

port_open() {
    (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
}

wait_port() {
    local port="$1" name="$2" tries="${3:-30}"
    for _ in $(seq 1 "$tries"); do
        if port_open "$port"; then
            return 0
        fi
        sleep 1
    done
    echo "  ! timed out waiting for $name on :$port"
    return 1
}

start_backend() {
    (cd "$BACKEND" && setsid nohup npm start >"$LOGDIR/backend.log" 2>&1 </dev/null &)
}

start_frontend() {
    (cd "$FRONTEND" && setsid nohup npm run dev >"$LOGDIR/frontend.log" 2>&1 </dev/null &)
}

echo "==================================================================="
echo " E-Waste Tracking - starting off-chain stack"
echo "==================================================================="

# ---------------------------------------------------------------- DynamoDB
echo
echo ">>> [1/3] DynamoDB Local"
if port_open 8000; then
    echo "    already running on :8000"
else
    (cd "$ROOT" && docker compose up -d)
    wait_port 8000 "DynamoDB" 30 || true
fi

# ---------------------------------------------------------------- backend
echo
echo ">>> [2/3] Backend API"
if [ ! -d "$BACKEND/node_modules" ]; then
    echo "    installing backend dependencies..."
    (cd "$BACKEND" && npm install)
fi
echo "    ensuring DynamoDB tables..."
(cd "$BACKEND" && npm run db:init --silent)
if port_open 4000; then
    echo "    backend already running on :4000"
else
    echo "    starting backend..."
    start_backend
    wait_port 4000 "backend" 30 || true
fi

# ---------------------------------------------------------------- frontend
echo
echo ">>> [3/3] Frontend (Vite dev server)"
if [ ! -d "$FRONTEND/node_modules" ]; then
    echo "    installing frontend dependencies..."
    (cd "$FRONTEND" && npm install)
fi
if port_open 5173; then
    echo "    frontend already running on :5173"
else
    echo "    starting frontend..."
    start_frontend
    wait_port 5173 "frontend" 30 || true
fi

# ---------------------------------------------------------------- summary
echo
echo "==================================================================="
echo " Ready"
echo "   UI      http://localhost:5173"
echo "   API     http://localhost:4000   (health: /health)"
echo "   Dynamo  http://localhost:8000"
echo "   Logs    $LOGDIR/backend.log , $LOGDIR/frontend.log"
echo
echo " Staff demo passwords: collectorpw / transporterpw / recyclerpw / manufacturerpw"
echo "==================================================================="

if ! port_open 7051; then
    echo
    echo "NOTE: Fabric peer :7051 is not reachable."
    echo "      On-chain actions (finalize / scan / trace) require the network:"
    echo "        ./scripts/setup-network.sh"
fi
