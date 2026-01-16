#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASEX_CMD="$REPO_ROOT/basex/bin/basexhttp"
PROXY_CMD="$REPO_ROOT/simple_proxy.py"
DB_NAME="${BASEX_DB:-gesnmr}"
ALLOW_MULTI="${ALLOW_MULTI:-0}"
STOP_OLD="${STOP_OLD:-1}"
BASEX_USER="${BASEX_USER:-admin}"
BASEX_PASSWORD="${BASEX_PASSWORD:-admin}"

if [[ ! -x "$BASEX_CMD" ]]; then
  echo "ERROR: BaseX HTTP launcher not found or not executable at $BASEX_CMD"
  exit 1
fi

if [[ ! -f "$PROXY_CMD" ]]; then
  echo "ERROR: Proxy script not found at $PROXY_CMD"
  exit 1
fi

report_running() {
  echo "Поиск уже запущенных экземпляров..."
  pgrep -af basexhttp || true
  pgrep -af 'org\.basex\.BaseXHTTP' || true
  pgrep -af simple_proxy.py || true
  echo "Порты с LISTEN:"
  ss -ltnp 2>/dev/null | grep -E '(:80(80|81)|:88(8[0-9])|:89(8[0-9])|:909[0-9])' || true
}

stop_existing() {
  local killed=0
  local pid args
  while read -r pid; do
    args="$(ps -p "$pid" -o args= 2>/dev/null || true)"
    if grep -q "$REPO_ROOT/basex" <<<"$args"; then
      echo "Останавливаю старый BaseXHTTP (PID $pid)..."
      kill "$pid" >/dev/null 2>&1 || true
      killed=1
    fi
  done < <(pgrep -f 'org\.basex\.BaseXHTTP' || true)

  if pgrep -f "$PROXY_CMD" >/dev/null; then
    echo "Останавливаю старый simple_proxy.py..."
    pgrep -f "$PROXY_CMD" | xargs -r kill
    killed=1
  fi
  if [[ "$killed" -eq 1 ]]; then
    sleep 1
  fi
}

choose_port() {
  local preferred="$1"
  shift || true
  python3 - "$preferred" "$@" <<'PY'
import socket, sys
preferred = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1] != "" else 0
others = [int(x) for x in sys.argv[2:] if x]
for cand in ([preferred] if preferred else []) + others + [0]:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind(("127.0.0.1", cand))
        except OSError:
            continue
        print(sock.getsockname()[1])
        sys.exit(0)
sys.exit(1)
PY
}

ensure_db_exists() {
  local exists
  exists="$("$REPO_ROOT/basex/bin/basex" -Vc "XQUERY db:exists('$DB_NAME')" 2>/dev/null || true)"
  if ! grep -q "true" <<<"$exists"; then
    echo "WARNING: Database '$DB_NAME' не найдена. Импортируйте XML (см. README.md) перед запуском UI."
  fi
}

wait_for_port() {
  local port="$1"
  local retries=10
  while (( retries > 0 )); do
    if ss -ltn 2>/dev/null | awk '{print $4}' | grep -q ":$port$"; then
      return 0
    fi
    sleep 0.5
    ((retries--))
  done
  return 1
}

cleanup() {
  if [[ -n "${basex_pid-}" ]]; then
    echo "Stopping BaseX (PID $basex_pid)..."
    kill "$basex_pid" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

echo "Проверяю наличие БД '$DB_NAME'..."
ensure_db_exists

echo "Если BaseX требует Basic Auth, передайте BASEX_USER/BASEX_PASSWORD (или BASEX_AUTH) перед запуском."

report_running
if [[ "$ALLOW_MULTI" != "1" ]]; then
  if pgrep -f basexhttp >/dev/null || pgrep -f 'org\.basex\.BaseXHTTP' >/dev/null || pgrep -f simple_proxy.py >/dev/null; then
    if [[ "$STOP_OLD" == "1" ]]; then
      stop_existing
    else
      echo "Найдены уже запущенные BaseXHTTP/simple_proxy. Остановите их вручную, или запустите с STOP_OLD=1 (автоостановка) или ALLOW_MULTI=1 (не останавливать)."
      exit 1
    fi
  fi
fi

BASEX_HTTP_PORT="$(choose_port "${BASEX_PORT-8080}" 8984 9090)"
BASEX_STOP_PORT="$(choose_port $((BASEX_HTTP_PORT + 1)) $((BASEX_HTTP_PORT + 100)) 9091)"
DEFAULT_PROXY_PORT=8888
PROXY_PORT="$(choose_port "${PROXY_PORT-$DEFAULT_PROXY_PORT}" 8889 8890)"

echo "Запускаю BaseX HTTP на :$BASEX_HTTP_PORT (stop-port :$BASEX_STOP_PORT)..."
"$BASEX_CMD" -h "$BASEX_HTTP_PORT" -s "$BASEX_STOP_PORT" >/tmp/basex-http.log 2>&1 &
basex_pid=$!

if ! wait_for_port "$BASEX_HTTP_PORT"; then
  echo "ERROR: BaseX не открыл порт $BASEX_HTTP_PORT. См. /tmp/basex-http.log"
  exit 1
fi

echo "BaseX готов (PID=$basex_pid). Logs: /tmp/basex-http.log"

if [[ "$PROXY_PORT" -ne "$DEFAULT_PROXY_PORT" ]]; then
  echo "NOTICE: Порт $DEFAULT_PROXY_PORT занят, прокси поднят на :$PROXY_PORT. При необходимости обновите CONFIG.baseURL/baseURLFallbacks в app/js/config.js."
fi

echo "Запускаю CORS proxy на :$PROXY_PORT (проксирует на BaseX :$BASEX_HTTP_PORT)..."
BASEX_HOST=127.0.0.1 BASEX_PORT="$BASEX_HTTP_PORT" PROXY_PORT="$PROXY_PORT" BASEX_USER="$BASEX_USER" BASEX_PASSWORD="$BASEX_PASSWORD" BASEX_AUTH="${BASEX_AUTH-}" python3 "$PROXY_CMD"
