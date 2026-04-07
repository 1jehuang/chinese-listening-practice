#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/home/jeremy/chinese-listening-practice"
HTTP_PORT="8010"
BRIDGE_PORT="8876"
DEFAULT_PAGE='lesson-15-part-1.html?mode=trackpad-draw'
TARGET_PAGE="${1:-$DEFAULT_PAGE}"
TARGET_URL="http://127.0.0.1:${HTTP_PORT}/${TARGET_PAGE}"

mkdir -p /tmp/chinese-listening-practice
HTTP_LOG="/tmp/chinese-listening-practice/http-server.log"
BRIDGE_LOG="/tmp/chinese-listening-practice/trackpad-bridge.log"

start_http_server() {
  if ss -ltn | grep -q ":${HTTP_PORT}\\b"; then
    return
  fi
  (
    cd "$REPO_DIR"
    nohup python3 -m http.server "$HTTP_PORT" >"$HTTP_LOG" 2>&1 &
  )
}

start_bridge() {
  if pgrep -f "python3 .*scripts/trackpad_bridge.py" >/dev/null 2>&1; then
    return
  fi
  (
    cd "$REPO_DIR"
    nohup python3 scripts/trackpad_bridge.py --port "$BRIDGE_PORT" >"$BRIDGE_LOG" 2>&1 &
  )
}

start_http_server
start_bridge

sleep 0.5
xdg-open "$TARGET_URL" >/dev/null 2>&1 || true
