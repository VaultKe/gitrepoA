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

# --- postgres ------------------------------------------------------------------
echo "==> PostgreSQL"
if ! pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then
  echo "Starting PostgreSQL..."
  if command -v pg_ctlcluster >/dev/null 2>&1; then
    pg_ctlcluster --force 16 main start 2>/dev/null || true
  fi
  service postgresql start 2>/dev/null || true
  sleep 2
fi
if ! pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then
  echo "WARNING: PostgreSQL not available on localhost:5432. Ensure DATABASE_URL points to a reachable instance."
else
  echo "PostgreSQL is running"
fi

# --- openwa --------------------------------------------------------------------
echo "==> OpenWA"
OPENWA_PID=""
if [ "${OPENWA_ENABLED:-false}" = "true" ]; then
  OPENWA_DIR="$ROOT/OpenWA"
  if [ -d "$OPENWA_DIR" ]; then
    if [ ! -d "$OPENWA_DIR/node_modules" ]; then
      echo "  Installing OpenWA dependencies..."
      (cd "$OPENWA_DIR" && npm ci --omit=dev) || echo "  WARNING: npm ci failed, OpenWA may not start"
    fi
    if [ ! -d "$OPENWA_DIR/dist" ]; then
      echo "  Building OpenWA..."
      (cd "$OPENWA_DIR" && npm run build) || echo "  WARNING: build failed"
    fi
    echo "  Starting OpenWA..."
    (cd "$OPENWA_DIR" && node dist/main) >"$LOG_DIR/openwa.log" 2>&1 &
    OPENWA_PID=$!
    echo -n "  waiting up to 60s"
    for i in $(seq 1 60); do
      if ! kill -0 "$OPENWA_PID" 2>/dev/null; then
        echo ""
        echo "  DIED early. Last 40 lines of openwa.log:"
        tail -n 40 "$LOG_DIR/openwa.log" >&2
        break
      fi
      if curl -sf http://localhost:2785/api/health/ready >/dev/null 2>&1; then
        echo " OK (PID $OPENWA_PID)"
        break
      fi
      sleep 1
    done
  else
    echo "  OpenWA directory not found at $OPENWA_DIR, skipping."
  fi
else
  echo "  OpenWA disabled (set OPENWA_ENABLED=true to start)"
fi

# --- cleanup ------------------------------------------------------------------
cleanup() {
  echo ""
  echo "==> Stopping services..."
  for pid in "${MAIN_PID:-}" "${CHAT_PID:-}" "${MEETING_PID:-}" "${OPENWA_PID:-}"; do
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
if [ -n "$OPENWA_PID" ]; then
  echo "  openwa          -> http://localhost:2785"
fi
echo "========================================"
echo ""
echo "Logs:"
echo "  tail -f $LOG_DIR/main-server.log"
echo "  tail -f $LOG_DIR/chat-service.log"
echo "  tail -f $LOG_DIR/meeting-service.log"
if [ -n "$OPENWA_PID" ]; then
  echo "  tail -f $LOG_DIR/openwa.log"
fi
echo ""
echo "Press Ctrl+C to stop all services."

wait
