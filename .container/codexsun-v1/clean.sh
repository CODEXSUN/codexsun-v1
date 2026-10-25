#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib/common.sh"
. "$SCRIPT_DIR/lib/backup.sh"
. "$SCRIPT_DIR/lib/quiesce.sh"

ASSUME_YES=false
CHECK_ONLY=false
PRUNE_CACHE=false
for option in "$@"; do
  case "$option" in
    --yes) ASSUME_YES=true ;;
    --check) CHECK_ONLY=true ;;
    --prune-cache) PRUNE_CACHE=true ;;
    --help|-h)
      echo 'Usage: bash .container/codexsun-v1/clean.sh [--check | --yes] [--prune-cache]'
      echo 'Back up, then remove owned application containers, images, data volume, and owned Redis resources.'
      echo 'MariaDB, its volumes, shared Redis, Media, Frappe, networks, and backups are always preserved.'
      echo '--prune-cache explicitly removes all unused host build cache, including other projects.'
      exit 0 ;;
    *) fail "Unknown cleanup option: $option" ;;
  esac
done
load_config
# Clean every known v1 application service, even if realtime was subsequently disabled.
SERVICES=(codexsun-api codexsun-web codexsun-shop codexsun-worker codexsun-chatb)
check_ownership
guard_inventory clean
require_healthy "$DB_CONTAINER"
[[ "$DATA_VOLUME" = codexsun-* ]] || fail 'Refusing to delete a data volume outside the codexsun namespace.'
docker inspect "$DB_CONTAINER" | python3 "$CONFIG" protect "$DATA_VOLUME"
containers=()
images=()
for name in "${SERVICES[@]}"; do
  if container_exists "$name"; then
    containers+=("$name")
    images+=("$(docker inspect -f '{{.Image}}' "$name")")
  fi
done
redis_volume=''
if container_exists "$REDIS_CONTAINER" &&
  [ "$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$REDIS_CONTAINER")" = codexsun-redis ] &&
  [ "$(docker inspect -f '{{index .Config.Labels "com.docker.compose.service"}}' "$REDIS_CONTAINER")" = redis ]; then
  redis_volume="$(env_value REDIS_DATA_VOLUME)"
  [[ "$redis_volume" = codexsun-* ]] || fail 'Refusing to delete a Redis volume outside the codexsun namespace.'
  docker inspect "$DB_CONTAINER" | python3 "$CONFIG" protect "$redis_volume"
  containers+=("$REDIS_CONTAINER")
  images+=("$(docker inspect -f '{{.Image}}' "$REDIS_CONTAINER")")
fi
for volume in "$DATA_VOLUME" "$redis_volume"; do
  [ -n "$volume" ] || continue
  # A mounted volume may be deleted only when every consumer is in the cleanup set.
  consumers="$(docker ps -a --filter "volume=$volume" --format '{{.Names}}')" || fail 'Cannot inspect volume consumers. Cleanup refused.'
  while IFS= read -r consumer; do
    [ -n "$consumer" ] || continue
    found=false
    for name in "${containers[@]}"; do [ "$name" != "$consumer" ] || found=true; done
    [ "$found" = true ] || fail "Volume $volume is used by another container: $consumer"
  done <<<"$consumers"
done
echo "Cleanup scope: ${containers[*]:-no containers}; application volume $DATA_VOLUME; owned Redis volume ${redis_volume:-none}."
echo 'MariaDB server and all its mounts are excluded. Media and shared services are excluded.'
[ "$CHECK_ONLY" = false ] || { echo 'Cleanup plan checked. No changes made.'; exit 0; }
lock_deployment
confirm_operation 'Permanently remove these application and owned Redis resources after backup?'
quiesce_cleanup
create_backup
if ((${#containers[@]})); then
  docker inspect "${containers[@]}" >"$BACKUP_DIR/cleanup-containers.json"
  (cd "$BACKUP_DIR"; sha256sum cleanup-containers.json >>SHA256SUMS)
fi
archive_runtime_images
if [ -n "$redis_volume" ]; then
  backup_image="$(docker inspect -f '{{.Image}}' "$DB_CONTAINER")"
  docker run --rm --network none --user 0:0 --entrypoint tar \
    --mount "type=volume,source=$redis_volume,target=/source,readonly" \
    "$backup_image" -C /source -czf - . >"$BACKUP_DIR/redis.tar.gz"
  gzip -t "$BACKUP_DIR/redis.tar.gz"
  tar -tzf "$BACKUP_DIR/redis.tar.gz" >/dev/null
  (cd "$BACKUP_DIR"; sha256sum redis.tar.gz >>SHA256SUMS; sha256sum --check SHA256SUMS >/dev/null)
fi
verify_backup
if volume_exists "$DATA_VOLUME"; then
  [ -s "$BACKUP_DIR/storage.tar.gz" ] || fail 'Application storage archive is required before deleting its volume.'
fi
guard_inventory clean
assert_quiesced
DELETION_STARTED=true
if ((${#containers[@]})); then docker rm -f "${containers[@]}"; fi
for volume in "$DATA_VOLUME" "$redis_volume"; do
  [ -n "$volume" ] || continue
  if volume_exists "$volume"; then docker volume rm "$volume"; fi
done
for image in "${images[@]}"; do
  # No force: images referenced by another container remain protected.
  docker image rm "$image" || echo "Retained image still referenced or tagged: $image"
done
if [ "$PRUNE_CACHE" = true ]; then docker builder prune --all --force; fi
QUIESCED=false
echo "Cleanup completed. MariaDB preserved. Verified backup: $BACKUP_DIR"
