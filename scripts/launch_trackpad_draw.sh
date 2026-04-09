#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/home/jeremy/chinese-listening-practice"
HTTP_PORT="8010"
BRIDGE_PORT="8876"
BRIDGE_SMOOTHING="${TRACKPAD_BRIDGE_SMOOTHING:-0.22}"
BRIDGE_DEBOUNCE_MS="${TRACKPAD_BRIDGE_DEBOUNCE_MS:-35}"
DEFAULT_PAGE='lesson-15-part-1.html?mode=trackpad-draw'
OPEN_BROWSER=1

if [[ "${1:-}" == "--bridge-only" || "${1:-}" == "--no-open" ]]; then
  OPEN_BROWSER=0
  shift
fi

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
  if ss -ltn | grep -q ":${BRIDGE_PORT}\\b"; then
    return
  fi
  (
    cd "$REPO_DIR"
    nohup python3 scripts/trackpad_bridge.py --port "$BRIDGE_PORT" --smoothing "$BRIDGE_SMOOTHING" --debounce-ms "$BRIDGE_DEBOUNCE_MS" >"$BRIDGE_LOG" 2>&1 &
  )
}

wait_for_port() {
  local port="$1"
  local retries="${2:-40}"
  local delay_secs="${3:-0.05}"
  local i
  for ((i=0; i<retries; i++)); do
    if ss -ltn | grep -q ":${port}\\b"; then
      return 0
    fi
    sleep "$delay_secs"
  done
  return 1
}

start_http_server
start_bridge

wait_for_port "$HTTP_PORT" 40 0.05 || true
wait_for_port "$BRIDGE_PORT" 40 0.05 || true

if [[ "$OPEN_BROWSER" == "1" ]]; then
  nohup xdg-open "$TARGET_URL" >/dev/null 2>&1 &
fi

echo "Trackpad draw bridge ready on ws://127.0.0.1:${BRIDGE_PORT}"
echo "Lesson page: ${TARGET_URL}"
