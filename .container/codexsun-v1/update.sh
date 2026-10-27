#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib/common.sh"
. "$SCRIPT_DIR/lib/backup.sh"
. "$SCRIPT_DIR/lib/release.sh"

ASSUME_YES=false
CHECK_ONLY=false
EXPECTED_REVISION="${CODEXSUN_EXPECTED_REVISION:-}"
for option in "$@"; do
  case "$option" in
    --yes) ASSUME_YES=true ;;
    --check) CHECK_ONLY=true ;;
    --expected-revision=*) EXPECTED_REVISION="${option#*=}" ;;
    --help|-h)
      echo 'Usage: bash update.sh [--check | --yes --expected-revision=<full-reviewed-SHA>]'
      echo 'Linux VPS only. Back up, fast-forward GitHub source, build, migrate, verify, and roll back failed application replacement.'
      echo '--check validates local source and deployment without fetching or changing anything.'
      exit 0 ;;
    *) fail "Unknown update option: $option" ;;
  esac
done
if [ "$CHECK_ONLY" = false ] || [ -n "$EXPECTED_REVISION" ]; then
  [[ "$EXPECTED_REVISION" =~ ^[a-f0-9]{40}$ ]] || fail 'Supply the full reviewed SHA with --expected-revision=<SHA> or CODEXSUN_EXPECTED_REVISION. No update started.'
fi
load_config
validate_source inspect
check_ownership
guard_inventory update
require_healthy "$DB_CONTAINER"
require_healthy "$REDIS_CONTAINER"
for name in codexsun-worker codexsun-chatb; do
  if container_exists "$name" && [[ ! " ${SERVICES[*]} " =~ " $name " ]]; then
    fail "Existing $name is not enabled in deployment configuration. Preserve its realtime settings before update."
  fi
done
for name in codexsun-api codexsun-web codexsun-shop; do
  docker container inspect "$name" >/dev/null || fail "Missing application container: $name. Use setup.sh for a fresh installation."
done
docker inspect codexsun-api | python3 "$CONFIG" adoption "$DATA_VOLUME" "${MEDIA_VOLUME:-}" "${BRIDGE_VOLUME:-}"
[ "$CHECK_ONLY" = false ] || { echo 'VPS update preflight passed. No changes made.'; exit 0; }
lock_deployment
branch="$(env_value CODEXSUN_GIT_BRANCH)"
[[ "$branch" =~ ^[a-zA-Z0-9][a-zA-Z0-9._/-]*$ ]] || fail 'Invalid deployment branch.'
[ "$(git -C "$PROJECT_ROOT" branch --show-current)" = "$branch" ] || fail 'Check out the configured deployment branch first.'
origin="$(git -C "$PROJECT_ROOT" remote get-url origin)"
case "$origin" in
  https://github.com/*|git@github.com:*|ssh://git@github.com/*) ;;
  *) fail 'origin must be a GitHub repository without embedded credentials.' ;;
esac
confirm_operation 'Back up and update this VPS from GitHub?'
create_backup
trap on_release_exit EXIT
git -C "$PROJECT_ROOT" fetch --prune origin "$branch"
target="$(git -C "$PROJECT_ROOT" rev-parse FETCH_HEAD)"
[ "$target" = "$EXPECTED_REVISION" ] || fail 'Fetched source differs from the reviewed SHA. No merge, build, migration, or replacement allowed.'
git -C "$PROJECT_ROOT" merge-base --is-ancestor HEAD "$target" || fail 'GitHub update is not a fast-forward.'
if [ "$target" = "$CODEXSUN_REVISION" ]; then
  validate_source
  echo 'Source is current. Rebuild and verify the versioned runtime to complete or retry deployment.'
  install_release
  exit 0
fi
candidate_version="$(git -C "$PROJECT_ROOT" show "$target:package.json" | python3 -c 'import json,sys; print(json.load(sys.stdin)["version"])')"
python3 - "$CODEXSUN_VERSION" "$candidate_version" <<'PY'
import re, sys
def version(value):
    if not re.fullmatch(r"\d+\.\d+\.\d+", value):
        sys.exit("Invalid release version")
    return tuple(map(int, value.split(".")))
if version(sys.argv[2]) <= version(sys.argv[1]):
    sys.exit("A changed deployment commit requires a newer application version")
PY
[ "$(env_value CODEXSUN_MIGRATION_COMPATIBLE_VERSION)" = "$candidate_version" ] || fail 'Approve the candidate version after migration review, then rerun update.'
# Merge the fetched SHA so a moving remote cannot change the reviewed target.
git -C "$PROJECT_ROOT" merge --ff-only "$target"
. "$SCRIPT_DIR/lib/common.sh"
. "$SCRIPT_DIR/lib/release.sh"
load_config
validate_source
check_ownership
guard_inventory update
install_release
