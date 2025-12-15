#!/bin/bash

# Stop all services script

ROOT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PIDS_FILE="$ROOT_DIR/logs/pids.txt"

echo "Stopping all services..."

if [ -f "$PIDS_FILE" ]; then
    while read pid; do
        if ps -p $pid > /dev/null 2>&1; then
            echo "Stopping process $pid..."
            kill $pid 2>/dev/null
        fi
    done < "$PIDS_FILE"
    rm "$PIDS_FILE"
    echo "✅ All services stopped"
else
    echo "No PID file found. Searching for processes..."
    
    # Try to find and kill processes by port
    AUTH_PID=$(lsof -ti:3001 2>/dev/null)
    EVAL_PID=$(lsof -ti:3003 2>/dev/null)
    FRONTEND_PID=$(lsof -ti:3000 2>/dev/null || lsof -ti:8080 2>/dev/null)
    
    [ ! -z "$AUTH_PID" ] && kill $AUTH_PID 2>/dev/null && echo "Stopped Auth Service (PID: $AUTH_PID)"
    [ ! -z "$EVAL_PID" ] && kill $EVAL_PID 2>/dev/null && echo "Stopped Evaluation Service (PID: $EVAL_PID)"
    [ ! -z "$FRONTEND_PID" ] && kill $FRONTEND_PID 2>/dev/null && echo "Stopped Frontend (PID: $FRONTEND_PID)"
    
    echo "✅ Services stopped"
fi
