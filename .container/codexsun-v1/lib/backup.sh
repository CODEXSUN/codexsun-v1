#!/usr/bin/env bash

verify_backup() {
  local file expected
  [ -s "$BACKUP_DIR/SHA256SUMS" ] && [ -s "$BACKUP_DIR/databases.sql" ] && [ -s "$BACKUP_DIR/deploy.env" ] || return 1
  for file in databases.sql deploy.env rollback.json containers.json cleanup-containers.json storage.tar.gz media.tar.gz runtime-images.tar.gz candidate.json images.json image-identities.json source.sha256 redis.tar.gz; do
    if [ -f "$BACKUP_DIR/$file" ]; then
      expected="$(cd "$BACKUP_DIR" && sha256sum "$file")" || return 1
      expected="${expected%% *}"
      if ! grep -Fxq "$expected  $file" "$BACKUP_DIR/SHA256SUMS" &&
        ! grep -Fxq "$expected *$file" "$BACKUP_DIR/SHA256SUMS"; then return 1; fi
    fi
  done
  (cd "$BACKUP_DIR" && sha256sum --check SHA256SUMS >/dev/null)
}

archive_runtime_images() {
  local backup_image
  ((${#images[@]})) || return 0
  docker image save "${images[@]}" | gzip >"$BACKUP_DIR/runtime-images.tar.gz.partial"
  gzip -t "$BACKUP_DIR/runtime-images.tar.gz.partial"
  mv "$BACKUP_DIR/runtime-images.tar.gz.partial" "$BACKUP_DIR/runtime-images.tar.gz"
  (cd "$BACKUP_DIR"; sha256sum runtime-images.tar.gz >>SHA256SUMS)
  verify_backup
}

create_backup() {
  require_healthy "$DB_CONTAINER"
  if [ "${QUIESCED:-false}" = true ]; then assert_quiesced; fi
  mkdir -p "$PROJECT_ROOT/.container/backups"
  BACKUP_DIR="$(mktemp -d "$PROJECT_ROOT/.container/backups/$(date -u +%Y%m%dT%H%M%SZ)-$$-XXXXXX")"
  chmod 700 "$PROJECT_ROOT/.container/backups" "$BACKUP_DIR"
  minimum="$(env_value CODEXSUN_UPDATE_MIN_BACKUP_FREE_MB)"
  [[ "$minimum" =~ ^[1-9][0-9]*$ ]] || fail "Configure a positive backup free-space threshold."
  available="$(df -Pm "$BACKUP_DIR" | awk 'NR==2 {print $4}')"
  [ "$available" -ge "$minimum" ] || fail "Not enough disk space for a deployment backup."
  echo "Creating database, configuration, and application-storage backups."
  if ! MYSQL_PWD="$(env_value DB_PASSWORD)" docker exec -e MYSQL_PWD "$DB_CONTAINER" \
    mariadb-dump --no-defaults --user="$(env_value DB_USER)" --all-databases \
    --single-transaction --quick --routines --events --triggers --hex-blob \
    >"$BACKUP_DIR/databases.sql.partial"; then
    fail "Database backup failed. Application containers have not been changed."
  fi
  [ -s "$BACKUP_DIR/databases.sql.partial" ] || fail "Database backup is empty."
  grep -Eq '^-- Dump completed' "$BACKUP_DIR/databases.sql.partial" || fail "Database dump is incomplete."
  mv "$BACKUP_DIR/databases.sql.partial" "$BACKUP_DIR/databases.sql"
  cp "$DEPLOY_ENV" "$BACKUP_DIR/deploy.env"
  existing=()
  for name in "${SERVICES[@]}"; do
    if container_exists "$name"; then existing+=("$name"); fi
  done
  if ((${#existing[@]})); then
    snapshot_args=()
    if [ "${QUIESCED:-false}" = true ]; then snapshot_args=(--running "${running_before[@]}"); fi
    docker inspect "${existing[@]}" >"$BACKUP_DIR/containers.json"
    python3 "$CONFIG" snapshot "${snapshot_args[@]}" <"$BACKUP_DIR/containers.json" >"$BACKUP_DIR/rollback.json"
    docker compose -p codexsun -f "$BACKUP_DIR/rollback.json" config --quiet
  fi
  if volume_exists "$DATA_VOLUME"; then
    backup_image="$(docker inspect -f '{{.Image}}' "$DB_CONTAINER")"
    docker run --rm --network none --entrypoint tar --user 0:0 \
      --mount "type=volume,source=$DATA_VOLUME,target=/source,readonly" \
      "$backup_image" -C /source -czf - . >"$BACKUP_DIR/storage.tar.gz.partial"
    gzip -t "$BACKUP_DIR/storage.tar.gz.partial"
    tar -tzf "$BACKUP_DIR/storage.tar.gz.partial" >/dev/null
    mv "$BACKUP_DIR/storage.tar.gz.partial" "$BACKUP_DIR/storage.tar.gz"
  fi
  if [ -n "${MEDIA_VOLUME:-}" ]; then
    backup_image="$(docker inspect -f '{{.Image}}' "$DB_CONTAINER")"
    docker run --rm --network none --entrypoint tar --user 0:0 \
      --mount "type=volume,source=$MEDIA_VOLUME,target=/source,readonly" \
      "$backup_image" -C /source -czf - . >"$BACKUP_DIR/media.tar.gz.partial"
    gzip -t "$BACKUP_DIR/media.tar.gz.partial"
    tar -tzf "$BACKUP_DIR/media.tar.gz.partial" >/dev/null
    mv "$BACKUP_DIR/media.tar.gz.partial" "$BACKUP_DIR/media.tar.gz"
  fi
  (cd "$BACKUP_DIR"; sha256sum databases.sql deploy.env >SHA256SUMS
    for file in rollback.json containers.json storage.tar.gz media.tar.gz; do
      [ ! -f "$file" ] || sha256sum "$file" >>SHA256SUMS
    done
    sha256sum --check SHA256SUMS >/dev/null)
  python3 "$CONFIG" metadata "$BACKUP_DIR" backup-verified "${CODEXSUN_VERSION:-unknown}" "${CODEXSUN_REVISION:-unknown}"
  if [ "${QUIESCED:-false}" = true ]; then assert_quiesced; fi
  echo "Backup verified: $BACKUP_DIR"
}
