#!/usr/bin/env bash
set -uo pipefail

ROOT="/home/samwel/Music/gitrepoA/API"
LOG_DIR="$ROOT/logs"
mkdir -p "$LOG_DIR"

# --- redis --------------------------------------------------------------------
echo "==> Redis"
if ! redis-cli -h 127.0.0.1 -p 6379 ping >/dev/null 2>&1; then
  echo "Starting Redis..."
  redis-server --daemonize yes
  sleep 1
fi
if ! redis-cli -h 127.0.0.1 -p 6379 ping >/dev/null 2>&1; then
  echo "ERROR: Redis could not be started" >&2
  exit 1
fi
echo "Redis is running"

# --- cleanup ------------------------------------------------------------------
cleanup() {
  echo ""
  echo "==> Stopping services..."
  for pid in "${MAIN_PID:-}" "${CHAT_PID:-}" "${MEETING_PID:-}"; do
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  wait 2>/dev/null || true
  echo "All services stopped."
}
trap cleanup SIGINT SIGTERM EXIT

# --- helper -------------------------------------------------------------------
start_service() {
  local name="$1"
  local dir="$2"
  local run_cmd="$3"
  local wait_secs="$4"
  local log="$LOG_DIR/${name}.log"

  echo "==> Starting ${name} ..."

  # free port if occupied
  local port
  case "$name" in
    main-server)      port=8085 ;;
    chat-service)     port=8084 ;;
    meeting-service)  port=8086 ;;
  esac

  if fuser -n tcp "$port" >/dev/null 2>&1; then
    echo "  killing stale process on :${port}"
    fuser -k -n tcp "$port" 2>/dev/null || true
    sleep 2
  fi

  # start
  (cd "$dir" && eval "$run_cmd") >"$log" 2>&1 &
  local pid=$!

  echo -n "  waiting up to ${wait_secs}s"
  for i in $(seq 1 "$wait_secs"); do
    if ! kill -0 "$pid" 2>/dev/null; then
      echo ""
      echo "  DIED early. Last 40 lines of ${log}:"
      tail -n 40 "$log" >&2
      return 1
    fi
    sleep 1
  done

  # process still alive after wait_secs -> success
  echo " OK (PID $pid)"
  return 0
}

# --- start --------------------------------------------------------------------
FAIL=0

# main-server needs extra time for initial migrations on a fresh DB
start_service "main-server"     "$ROOT/main-server"     "go run ." 180 || FAIL=1
start_service "chat-service"    "$ROOT/chat-service"    "go run ./cmd/server" 60 || FAIL=1
start_service "meeting-service" "$ROOT/meeting-service" "go run ./cmd/server" 60 || FAIL=1

echo ""
if [[ "$FAIL" -ne 0 ]]; then
  echo "========================================"
  echo "ONE OR MORE SERVICES FAILED. Check logs above."
  echo "========================================"
  exit 1
fi

echo "========================================"
echo "All services running."
echo "  main-server     -> http://localhost:8085"
echo "  chat-service    -> http://localhost:8084"
echo "  meeting-service -> http://localhost:8086"
echo "========================================"
echo ""
echo "Logs:"
echo "  tail -f $LOG_DIR/main-server.log"
echo "  tail -f $LOG_DIR/chat-service.log"
echo "  tail -f $LOG_DIR/meeting-service.log"
echo ""
echo "Press Ctrl+C to stop all services."

wait
