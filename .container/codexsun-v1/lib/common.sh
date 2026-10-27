#!/usr/bin/env bash
# Shared only by the v1 VPS deployment commands.
set -euo pipefail
umask 077

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ROOT="$(cd "$DEPLOY_DIR/../.." && pwd)"
DEPLOY_ENV="$PROJECT_ROOT/.container/deploy.env"
CONFIG="$DEPLOY_DIR/lib/config.py"

fail() { echo "$*" >&2; exit 78; }
env_value() { python3 "$CONFIG" env "$DEPLOY_ENV" "$1"; }
container_exists() {
  local names
  names="$(docker ps -a --format '{{.Names}}')" || fail 'Cannot read container inventory.'
  grep -Fxq "$1" <<<"$names"
}
volume_exists() {
  local names
  names="$(docker volume ls --format '{{.Name}}')" || fail 'Cannot read volume inventory.'
  grep -Fxq "$1" <<<"$names"
}
guard_inventory() (
  local ids inventory volume role
  inventory="$(mktemp)"
  trap 'rm -f -- "$inventory"' EXIT
  ids="$(docker ps -aq)" || fail 'Cannot read Docker inventory. No changes allowed.'
  if [ -z "$ids" ]; then
    printf '[]' >"$inventory"
  else
    local -a containers
    mapfile -t containers <<<"$ids"
    docker inspect "${containers[@]}" >"$inventory"
  fi
  python3 -B "$DEPLOY_DIR/lib/safety.py" "$DEPLOY_ENV" "$1" <"$inventory"
  for role in application redis media; do
    volume="$DATA_VOLUME"
    [ "$role" != redis ] || volume="$(env_value REDIS_DATA_VOLUME)"
    if [ "$role" = media ]; then volume="${MEDIA_VOLUME:-}"; fi
    [ -n "$volume" ] || continue
    if volume_exists "$volume"; then
      docker volume inspect "$volume" | python3 -B "$DEPLOY_DIR/lib/safety.py" "$DEPLOY_ENV" "volume-$role" "$inventory"
    fi
  done
)
compose() {
  local -a media_args=()
  if [ -n "${MEDIA_VOLUME:-}" ]; then media_args=(-f "$DEPLOY_DIR/docker-compose.media.yml"); fi
  docker compose --project-name codexsun --env-file "$DEPLOY_ENV" \
    -f "$DEPLOY_DIR/docker-compose.yml" "${media_args[@]}" "${PROFILE_ARGS[@]}" "$@"
}
database_compose() {
  docker compose --env-file "$DEPLOY_ENV" \
    -f "$PROJECT_ROOT/.container/database/$1/docker-compose.yml" "${@:2}"
}

load_config() {
  for tool in python3 git docker sha256sum flock gzip tar mktemp df timeout; do
    command -v "$tool" >/dev/null || fail "Required command is missing: $tool"
  done
  [ "$(uname -s)" = Linux ] || fail "Deployment commands run on a Linux VPS, not a development workstation."
  if [ "${CHECK_ONLY:-false}" = false ]; then lock_deployment; fi
  [ -f "$DEPLOY_ENV" ] || fail "Provision .container/deploy.env from its sample, or run setup.sh --configure."
  python3 "$CONFIG" validate "$DEPLOY_ENV"
  [ "$(env_value CODEXSUN_DEPLOY_TARGET)" = vps ] || fail "Set CODEXSUN_DEPLOY_TARGET=vps in the deployment environment."
  docker info >/dev/null
  case "$(docker info --format '{{.OperatingSystem}}')" in
    *Docker\ Desktop*) fail "Docker Desktop is not a VPS deployment target." ;;
  esac
  docker compose version >/dev/null
  DB_CONTAINER="$(env_value CODEXSUN_MARIADB_CONTAINER)"
  REDIS_CONTAINER="$(env_value CODEXSUN_REDIS_CONTAINER)"
  DATA_VOLUME="$(env_value CODEXSUN_DATA_VOLUME)"
  MEDIA_VOLUME="$(env_value CODEXSUN_MEDIA_DATA_VOLUME)"
  if [ -n "$MEDIA_VOLUME" ]; then
    volume_exists "$MEDIA_VOLUME" || fail 'Configured Media volume must already exist; no Media storage is created automatically.'
  fi
  NETWORK="$(env_value CODEXSUN_DOCKER_NETWORK)"
  SERVICES=(codexsun-api codexsun-web codexsun-shop)
  PROFILE_ARGS=()
  if [ "$(env_value CODEXSUN_REALTIME_ENABLED)" = 1 ]; then
    SERVICES+=(codexsun-worker codexsun-chatb)
    PROFILE_ARGS=(--profile realtime)
  elif [ "$(env_value CODEXSUN_QUEUE_EXECUTION_HOST)" = worker ]; then
    SERVICES+=(codexsun-worker)
    PROFILE_ARGS=(--profile realtime)
  fi
}

lock_deployment() {
  [ "${DEPLOYMENT_LOCKED:-false}" != true ] || return 0
  exec 9>"${TMPDIR:-/tmp}/codexsun-v1-deployment.lock"
  flock -n 9 || fail "Another CODEXSUN deployment operation is running."
  DEPLOYMENT_LOCKED=true
}

validate_source() {
  [ -z "$(git -C "$PROJECT_ROOT" status --porcelain --untracked-files=normal)" ] || fail "Deployment requires committed, clean source."
  CODEXSUN_REVISION="$(git -C "$PROJECT_ROOT" rev-parse HEAD)"
  CODEXSUN_VERSION="$(python3 "$CONFIG" package "$PROJECT_ROOT/package.json" version)"
  NODE_RUNTIME_VERSION="$(python3 "$CONFIG" package "$PROJECT_ROOT/package.json" engines.node)"
  NPM_RUNTIME_VERSION="$(python3 "$CONFIG" package "$PROJECT_ROOT/package.json" engines.npm)"
  export CODEXSUN_REVISION CODEXSUN_VERSION NODE_RUNTIME_VERSION NPM_RUNTIME_VERSION
  if [ "${1:-approve}" = approve ]; then
    [ "$(env_value CODEXSUN_MIGRATION_COMPATIBLE_VERSION)" = "$CODEXSUN_VERSION" ] || fail "Review expand-contract migrations and approve the exact version in CODEXSUN_MIGRATION_COMPATIBLE_VERSION."
  fi
  compose config --quiet
}

check_ownership() {
  for name in "${SERVICES[@]}"; do
    if container_exists "$name"; then
      owner="$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$name")"
      service="$(docker inspect -f '{{index .Config.Labels "com.docker.compose.service"}}' "$name")"
      [ "$owner" = codexsun ] && [ "$service" = "$name" ] || fail "Container $name belongs to another deployment. Refusing takeover."
    fi
  done
}

require_healthy() {
  [ "$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$1")" = healthy ] || fail "Container is not healthy: $1"
  docker network inspect "$NETWORK" >/dev/null
  docker inspect "$1" | python3 "$CONFIG" network "$NETWORK"
}

master_table_count() {
  local count database="${1:-$(env_value DB_MASTER_NAME)}"
  count="$(MYSQL_PWD="$(env_value DB_PASSWORD)" docker exec -e MYSQL_PWD "$DB_CONTAINER" \
    mariadb --no-defaults --user="$(env_value DB_USER)" -N -e \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$database'")" || return 1
  [[ "$count" =~ ^[0-9]+$ ]] || fail 'Invalid master-database inventory result.'
  printf '%s\n' "$count"
}

assert_fresh_tenant_database() {
  local tenant_database="$(env_value DEFAULT_TENANT_DB_NAME)"
  [ -z "$tenant_database" ] || [ "$(master_table_count "$tenant_database")" = 0 ] ||
    fail 'Existing tenant database found. Use retained-data setup without bootstrap seeding.'
}

confirm_operation() {
  [ "${ASSUME_YES:-false}" = true ] && return
  read -r -p "$1 Type YES to continue: " answer
  [ "$answer" = YES ] || fail "Cancelled before changes."
}
