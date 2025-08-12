#!/bin/bash

echo "🛑 Stopping Ultimate D-Line Manager servers..."

# Read PIDs from file
if [ -f ".server-pids" ]; then
  while IFS= read -r pid; do
    if [ ! -z "$pid" ]; then
      echo "   Stopping process $pid..."
      kill $pid 2>/dev/null
    fi
  done < .server-pids
  rm .server-pids
fi

# Also kill any lingering processes
pkill -f "tsx.*server" 2>/dev/null
pkill -f "vite" 2>/dev/null

# Kill processes on specific ports
lsof -ti:5001 | xargs kill -9 2>/dev/null
lsof -ti:3000 | xargs kill -9 2>/dev/null

echo "✅ All servers stopped"