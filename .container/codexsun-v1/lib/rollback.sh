#!/usr/bin/env bash

rollback_release() {
  verify_backup || { echo 'Rollback refused: backup checksum validation failed.' >&2; return 1; }
  local previous_text running_text name found
  local -a previous=() running=() added=()
  previous_text="$(python3 "$CONFIG" services "$BACKUP_DIR/rollback.json")" || return 1
  [ -n "$previous_text" ] || return 1
  mapfile -t previous <<<"$previous_text"
  running_text="$(python3 "$CONFIG" services "$BACKUP_DIR/rollback.json" running)" || return 1
  if [ -n "$running_text" ]; then mapfile -t running <<<"$running_text"; fi
  check_ownership || return 1
  for name in "${SERVICES[@]}"; do
    found=false
    for old in "${previous[@]}"; do [ "$old" != "$name" ] || found=true; done
    [ "$found" = true ] || added+=("$name")
  done
  if ((${#added[@]})); then
    runtime_compose rm --stop --force "${added[@]}" || return 1
  fi
  # Recreate originally stopped services too, without accidentally starting them.
  docker compose -p codexsun -f "$BACKUP_DIR/rollback.json" create --no-build "${previous[@]}" || return 1
  if ((${#running[@]})); then
    docker compose -p codexsun -f "$BACKUP_DIR/rollback.json" up -d --no-build --wait --wait-timeout 180 "${running[@]}" || return 1
  fi
}
