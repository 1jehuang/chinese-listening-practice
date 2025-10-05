#!/bin/bash

# Chinese listening practice workspace setup script
CHINESE_DIR="$HOME/chinese-listening-practice"
PORT=8001

cd "$CHINESE_DIR" || exit 1

# Start HTTP server in background
echo "Starting web server on port $PORT..."
python -m http.server $PORT > /dev/null 2>&1 &
SERVER_PID=$!

# Give server a moment to start
sleep 1

# Open browser in new window
echo "Opening Chinese learning app in browser..."
nohup google-chrome --new-window "http://localhost:$PORT" > /dev/null 2>&1 &

# Spawn Claude Code and Codex terminals in the project directory
echo "Spawning Claude Code terminal..."
niri msg action spawn -- alacritty --working-directory "$CHINESE_DIR" -e bash -c "/home/jeremy/.local/bin/claude --dangerously-skip-permissions; exec bash"

echo "Spawning Codex terminal..."
niri msg action spawn -- alacritty --working-directory "$CHINESE_DIR" -e bash -c "codex --dangerously-bypass-approvals-and-sandbox; exec bash"

echo "Workspace setup complete!"
echo "Server PID: $SERVER_PID (kill with: kill $SERVER_PID)"
