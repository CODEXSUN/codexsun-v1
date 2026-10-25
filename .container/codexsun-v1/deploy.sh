#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib/common.sh"
. "$SCRIPT_DIR/lib/backup.sh"
. "$SCRIPT_DIR/lib/release.sh"

ASSUME_YES=false
CHECK_ONLY=false
REUSE_DATABASE=false
CONFIGURE=false
for option in "$@"; do
  case "$option" in
    --yes) ASSUME_YES=true ;;
    --check) CHECK_ONLY=true ;;
    --reuse-database) REUSE_DATABASE=true ;;
    --configure) CONFIGURE=true ;;
    --help|-h)
      echo 'Usage: bash setup.sh [--configure | --check | --yes] [--reuse-database]'
      echo 'Fresh VPS containers. --reuse-database preserves a populated master database without bootstrap seeding.'
      exit 0 ;;
    *) fail "Unknown setup option: $option" ;;
  esac
done
if [ "$CONFIGURE" = true ]; then
  [ "$#" = 1 ] || fail '--configure must be used alone. It cannot be combined with --check.'
  [ "$(uname -s)" = Linux ] || fail "Configure deployment on the Linux VPS."
  command -v flock >/dev/null || fail "flock is required to configure a deployment."
  lock_deployment
  cd "$PROJECT_ROOT"
  if command -v node >/dev/null; then exec node tools/configure-env.mjs --deployment; fi
  runtime="$(python3 "$CONFIG" package "$PROJECT_ROOT/package.json" engines.node)"
  exec docker run --rm -it --user "$(id -u):$(id -g)" \
    -v "$PROJECT_ROOT:/workspace" -w /workspace "node:$runtime-bookworm-slim" \
    node tools/configure-env.mjs --deployment
fi
load_config
validate_source
check_ownership
guard_inventory setup
for name in "${SERVICES[@]}"; do
  if container_exists "$name"; then fail "Existing application found. Use update.sh."; fi
done
table_count=0
if container_exists "$DB_CONTAINER"; then
  require_healthy "$DB_CONTAINER"
  table_count="$(master_table_count)"
  if [ "$table_count" = 0 ] && [ "$REUSE_DATABASE" = false ]; then assert_fresh_tenant_database; fi
elif volume_exists "$(env_value MARIADB_DATA_VOLUME)"; then
  [ "$REUSE_DATABASE" = true ] || fail 'Retained MariaDB volume found. Explicit --reuse-database is required.'
  table_count=unknown
fi
[ "$table_count" = 0 ] || [ "$REUSE_DATABASE" = true ] || fail "The master database has data. Use --reuse-database to retain it without bootstrap seeding."
if [ "$table_count" = 0 ] && [ "$REUSE_DATABASE" = false ]; then python3 "$CONFIG" validate "$DEPLOY_ENV" fresh; fi
[ "$CHECK_ONLY" = false ] || { echo 'Fresh-install configuration and retained database checked. No changes made.'; exit 0; }
lock_deployment
confirm_operation 'Install CODEXSUN on this VPS?'
if ! docker network inspect "$NETWORK" >/dev/null 2>&1; then docker network create "$NETWORK" >/dev/null; fi
for kind in mariadb redis; do
  container="$DB_CONTAINER"
  [ "$kind" != redis ] || container="$REDIS_CONTAINER"
  if ! container_exists "$container"; then
    [ "$container" = "codexsun-$kind" ] || fail "Provision the configured external $kind server before setup."
    database_compose "$kind" build --pull
    database_compose "$kind" up -d --no-build --wait --wait-timeout 180
  fi
  require_healthy "$container"
done
table_count="$(master_table_count)"
if [ "$table_count" = 0 ] && [ "$REUSE_DATABASE" = false ]; then assert_fresh_tenant_database; fi
[ "$table_count" = 0 ] || [ "$REUSE_DATABASE" = true ] || fail 'Existing master database requires --reuse-database.'
if [ "$table_count" = 0 ] && [ "$REUSE_DATABASE" = false ]; then python3 "$CONFIG" validate "$DEPLOY_ENV" fresh; fi
create_backup
FRESH_INSTALL=false
SEED_FRESH_INSTALL=false
[ "$table_count" != 0 ] || FRESH_INSTALL=true
if [ "$FRESH_INSTALL" = true ] && [ "$REUSE_DATABASE" = false ]; then SEED_FRESH_INSTALL=true; fi
install_release
