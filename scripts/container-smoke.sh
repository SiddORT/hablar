#!/usr/bin/env bash
# Run only against disposable containers: no real database or credentials used.
set -euo pipefail
cd "$(dirname "$0")/.."
runtime_env="$(mktemp)"
export SMOKE_IMAGE_PREFIX="hablar-smoke-$(date +%s)-$$"
export HTTP_PORT="${HTTP_PORT:-18080}"
export BIND_ADDRESS=127.0.0.1
export POSTGRES_DB=hablar_smoke
export POSTGRES_USER=hablar_smoke
export POSTGRES_PASSWORD=smoke_test_password
export DATABASE_URL='postgresql://smoke:smoke-only-not-production@smoke-db:5432/smoke?sslmode=disable'
export SESSION_SECRET="smoke_test_session_secret_only_for_CI_0123456789"
compose=(docker compose --env-file "$runtime_env" --project-name "$SMOKE_IMAGE_PREFIX" -f compose.yaml -f docker/compose.smoke.yaml)
cleanup() {
  status=$?
  if [ "$status" -ne 0 ]; then "${compose[@]}" logs --no-color || true; fi
  "${compose[@]}" down --volumes --remove-orphans || true
  docker image rm "$SMOKE_IMAGE_PREFIX-api:local" "$SMOKE_IMAGE_PREFIX-website:local" >/dev/null 2>&1 || true
  rm -f "$runtime_env"
  exit "$status"
}
trap cleanup EXIT
"${compose[@]}" config --quiet
"${compose[@]}" build api website
# No credentials, network, database, mounts, or user override: check the image itself.
docker run --rm --interactive --network none --read-only --cap-drop ALL \
  "$SMOKE_IMAGE_PREFIX-api:local" python - < docker/check-email-assets.py
"${compose[@]}" up --no-build --detach --wait --wait-timeout 180 website
base="http://127.0.0.1:$HTTP_PORT"
curl -fsS "$base/healthz" | grep -qx ok
curl -fsS "$base/api/healthz" | grep -q '"status":"ok"'
home="$(curl -fsS "$base/")"
policy="$(curl -fsS "$base/privacy")"
printf '%s' "$policy" | grep -q '<title data-hablar-seo>Privacy Notice | HABLAR</title>'

test "$(curl -s -o /dev/null -w '%{http_code}' "$base/terms")" = 404
curl -fsS "$base/robots.txt" | grep -q 'User-agent:'
curl -fsS "$base/sitemap.xml" | grep -q '<urlset'
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
test "$("${compose[@]}" exec -T api id -u)" = 10001
test "$("${compose[@]}" exec -T api id -g)" = 10001
echo "Container smoke checks passed."
