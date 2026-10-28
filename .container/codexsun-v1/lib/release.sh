#!/usr/bin/env bash
. "$DEPLOY_DIR/lib/rollback.sh"
. "$DEPLOY_DIR/lib/quiesce.sh"

runtime_compose() {
  docker compose -p codexsun -f "${CANDIDATE_FILE:-$BACKUP_DIR/candidate.json}" "$@"
}

database_command() {
  runtime_compose run --rm --no-deps -e "CODEXSUN_VERIFIED_BACKUP_ID=$(basename "$BACKUP_DIR")" \
    -e "ENABLE_DEFAULT_TENANT_SEED=${2:-0}" --entrypoint node codexsun-api \
    --import ./tools/register-production-package-resolution.mjs \
    dist/apps/platform/api/database/db-cli.js "$1"
}

verify_release() {
  for name in "${SERVICES[@]}"; do require_healthy "$name"; done
  docker exec codexsun-api node -e \
    "fetch('http://127.0.0.1:'+process.env.PLATFORM_API_PORT+'/ready',{signal:AbortSignal.timeout(10000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
  docker exec codexsun-web wget -qO /dev/null http://127.0.0.1/health
  docker exec codexsun-web wget -qO /dev/null http://127.0.0.1/api/app/ready
  docker exec codexsun-shop wget -qO /dev/null http://127.0.0.1/health
}

on_release_exit() {
  result=$?
  trap - EXIT
  if [ "$result" -ne 0 ] && [ -n "${BACKUP_DIR:-}" ]; then
    status=failed-before-replacement
    if [ "${DATABASE_CHANGES_POSSIBLE:-false}" = true ]; then
      status=database-review-required
      for name in "${SERVICES[@]}"; do
        if container_exists "$name" && [ "$(docker inspect -f '{{.State.Running}}' "$name")" = true ]; then
          if ! graceful_stop "$name"; then status=database-review-runtime-stop-failed; fi
        fi
      done
    elif [ "${REPLACEMENT_STARTED:-false}" = true ]; then
      status=rollback-failed
      if [ -s "$BACKUP_DIR/rollback.json" ] && rollback_release; then
        status=application-rolled-back
      elif [ ! -s "$BACKUP_DIR/rollback.json" ] && runtime_compose stop "${SERVICES[@]}"; then
        status=fresh-install-stopped
      fi
    elif [ "${QUIESCED:-false}" = true ]; then
      if restore_quiesced; then status=previous-runtime-resumed; else status=runtime-recovery-required; fi
    fi
    python3 "$CONFIG" metadata "$BACKUP_DIR" "$status" "$CODEXSUN_VERSION" "$CODEXSUN_REVISION" || true
    echo "Deployment failed: $status. Backup retained at $BACKUP_DIR. Database changes are not automatically reversed." >&2
  fi
  exit "$result"
}

install_release() {
  trap on_release_exit EXIT
  python3 - "$PROJECT_ROOT" <<'PY'
import json, pathlib, re, sys
root = pathlib.Path(sys.argv[1])
dockerfile = (root / '.container/codexsun-v1/Dockerfile').read_text(encoding='utf-8')
lock = json.loads((root / 'package-lock.json').read_text(encoding='utf-8'))
workspaces = {entry.get('name') for entry in lock['packages'].values()}
required = set(re.findall(r'npm run build -w\s+(@[^\s\\]+)', dockerfile))
missing = sorted(required - workspaces)
if missing:
    sys.exit('Dockerfile requires workspaces missing from package-lock.json: ' + ', '.join(missing))
PY
  docker_root="$(docker info --format '{{.DockerRootDir}}')"
  required="$(env_value CODEXSUN_UPDATE_MIN_DOCKER_FREE_MB)"
  [[ "$required" =~ ^[1-9][0-9]*$ ]] || fail "Configure a positive Docker free-space threshold."
  free="$(df -Pm "$docker_root" | awk 'NR==2 {print $4}')"
  [ "$free" -ge "$required" ] || fail "Insufficient Docker build space."
  compose build --pull "${SERVICES[@]}"
  git -C "$PROJECT_ROOT" archive "$CODEXSUN_REVISION" | sha256sum >"$BACKUP_DIR/source.sha256"
  compose images --format json >"$BACKUP_DIR/images.json"
  # Keep immutable IDs even if a version tag is rebuilt or moved later.
  image_ids=()
  pinned_images=()
  for name in "${SERVICES[@]}"; do
    image="$(env_value CODEXSUN_IMAGE_REGISTRY)/${name#codexsun-}:$CODEXSUN_VERSION"
    image_ids+=("$(docker image inspect -f '{{.Id}}' "$image")")
    pinned_images+=("$name=${image_ids[-1]}")
    actual="$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.version"}}' "$image")"
    revision="$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image")"
    [ "$actual" = "$CODEXSUN_VERSION" ] && [ "$revision" = "$CODEXSUN_REVISION" ] || fail "Built image identity does not match the source release."
  done
  docker image inspect "${image_ids[@]}" >"$BACKUP_DIR/image-identities.json"
  compose config --format json | python3 "$CONFIG" pin "${pinned_images[@]}" >"$BACKUP_DIR/candidate.json"
  CANDIDATE_FILE="$BACKUP_DIR/candidate.json"
  (cd "$BACKUP_DIR"; sha256sum candidate.json images.json image-identities.json source.sha256 >>SHA256SUMS)
  verify_backup
  if [ "${FRESH_INSTALL:-false}" != true ] && [ -s "$BACKUP_DIR/rollback.json" ]; then
    local prepared_backup="$BACKUP_DIR" name
    containers=()
    for name in "${SERVICES[@]}"; do
      if container_exists "$name"; then containers+=("$name"); fi
    done
    quiesce_writers
    create_backup
    for name in candidate.json images.json image-identities.json source.sha256; do
      cp "$prepared_backup/$name" "$BACKUP_DIR/$name"
    done
    CANDIDATE_FILE="$BACKUP_DIR/candidate.json"
    (cd "$BACKUP_DIR"; sha256sum candidate.json images.json image-identities.json source.sha256 >>SHA256SUMS)
    verify_backup
  fi
  guard_inventory update
  if ! volume_exists "$DATA_VOLUME"; then
    docker volume create --label com.codexsun.deployment=codexsun-v1 "$DATA_VOLUME" >/dev/null
  fi
  api_image="${image_ids[0]}"
  docker run --rm --network none --user 0:0 --entrypoint sh \
    --mount "type=volume,source=$DATA_VOLUME,target=/storage" "$api_image" -ec \
    'mkdir -p /storage/app/public /storage/public /storage/tenants /storage/backups/database; chown 1000:1000 /storage /storage/app /storage/app/public /storage/public /storage/tenants /storage/backups /storage/backups/database'
  verify_backup
  if [ "${FRESH_INSTALL:-false}" = true ]; then
    # Preflight reads the tenant registry, which does not exist in an empty installation.
    DATABASE_CHANGES_POSSIBLE=true
    database_command migrations:run
    database_command migrations:preflight
    if [ "${SEED_FRESH_INSTALL:-false}" = true ]; then database_command seed 1; fi
  else
    database_command migrations:preflight
    DATABASE_CHANGES_POSSIBLE=true
    database_command migrations:run
  fi
  python3 "$CONFIG" metadata "$BACKUP_DIR" migrated "$CODEXSUN_VERSION" "$CODEXSUN_REVISION"
  REPLACEMENT_STARTED=true
  runtime_compose up -d --no-deps --no-build --wait --wait-timeout 180 "${SERVICES[@]}"
  verify_release
  python3 "$CONFIG" metadata "$BACKUP_DIR" healthy "$CODEXSUN_VERSION" "$CODEXSUN_REVISION"
  verify_backup
  REPLACEMENT_STARTED=false
  QUIESCED=false
  echo "CODEXSUN $CODEXSUN_VERSION is healthy. Release evidence: $BACKUP_DIR"
}
