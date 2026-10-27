#!/usr/bin/env bash
# Run only against disposable containers: no real database or credentials used.
set -euo pipefail
cd "$(dirname "$0")/.."
runtime_env="$(mktemp)"
export API_ENV_FILE="$runtime_env"
export HTTP_PORT="${HTTP_PORT:-18080}"
export BIND_ADDRESS=127.0.0.1
compose=(docker compose --project-name hablar-smoke -f compose.yaml -f docker/compose.smoke.yaml)
cleanup() {
  status=$?
  if [ "$status" -ne 0 ]; then "${compose[@]}" logs --no-color; fi
  "${compose[@]}" down --volumes --remove-orphans
  rm -f "$runtime_env"
  exit "$status"
}
trap cleanup EXIT
printf '%s\n' \
  'DATABASE_URL=postgresql://smoke:smoke-only-not-production@smoke-db:5432/smoke?sslmode=disable' \
  'SESSION_SECRET=disposable-ci-only-key-not-for-real-data-0123456789' > "$runtime_env"
"${compose[@]}" config --quiet
"${compose[@]}" up --build --detach --wait --wait-timeout 180
base="http://127.0.0.1:$HTTP_PORT"
curl -fsS "$base/healthz" | grep -qx ok
curl -fsS "$base/api/healthz" | grep -q '"status":"ok"'
home="$(curl -fsS "$base/")"
for route in privacy terms; do
  test "$(curl -fsS "$base/$route")" = "$home"
done
curl -fsS "$base/brand/hablar-logo-transparent.png" -o /dev/null
asset="$(printf '%s' "$home" | grep -oE '/assets/[^"]+\.js' | head -1)"
test -n "$asset"
curl -fsS "$base$asset" -o /dev/null
test "$(curl -s -o /dev/null -w '%{http_code}' "$base/assets/not-found.js")" = 404
test "$(curl -s -o /dev/null -w '%{http_code}' "$base/api/not-found")" = 404
# Confirm POST forwarding without inserting any contact data.
test "$(curl -s -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' \
  -d '{}' "$base/api/waitlist")" = 422
for service in website api; do
  test "$("${compose[@]}" exec -T "$service" id -u)" != 0
done
echo "Container smoke checks passed."
