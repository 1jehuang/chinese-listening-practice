#!/bin/bash

# Chinese listening practice workspace setup script
CHINESE_DIR="$HOME/chinese-listening-practice"
PORT=8001

# Spawn HTTP server in a persistent terminal
echo "Starting web server on port $PORT..."
niri msg action spawn -- alacritty --working-directory "$CHINESE_DIR" -e bash -c "python -m http.server $PORT; exec bash"

# Give server a moment to start
sleep 2

# Open browser in new window
echo "Opening Chinese learning app in browser..."
nohup google-chrome --new-window "http://localhost:$PORT" > /dev/null 2>&1 &

# Spawn Claude Code and Codex terminals in the project directory
echo "Spawning Claude Code terminal..."
niri msg action spawn -- alacritty --working-directory "$CHINESE_DIR" -e bash -c "/home/jeremy/.local/bin/claude --dangerously-skip-permissions; exec bash"

echo "Spawning Codex terminal..."
niri msg action spawn -- alacritty --working-directory "$CHINESE_DIR" -e bash -c "codex --dangerously-bypass-approvals-and-sandbox; exec bash"

echo "Workspace setup complete!"
