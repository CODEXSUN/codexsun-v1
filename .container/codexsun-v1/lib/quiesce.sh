#!/usr/bin/env bash

graceful_stop() {
  local name="$1" elapsed stop_signal
  stop_signal="$(docker inspect -f '{{.Config.StopSignal}}' "$name")"
  case "${stop_signal^^}" in
    SIGKILL|KILL|9) echo 'Unsafe forced-stop signal. Refusing to interrupt writes.' >&2; return 1 ;;
  esac
  docker kill --signal "${stop_signal:-SIGTERM}" "$name" >/dev/null
  for ((elapsed=0; elapsed<60; elapsed++)); do
    if [ "$(docker inspect -f '{{.State.Running}}' "$name")" = false ]; then return 0; fi
    sleep 1
  done
  echo "Service did not stop gracefully: $name. No SIGKILL or data deletion was attempted." >&2
  return 1
}

assert_quiesced() {
  local name
  for name in "${containers[@]}"; do
    [ "$(docker inspect -f '{{.State.Running}}' "$name")" = false ] || {
      echo "Service is still writing or restarted during backup: $name" >&2
      return 1
    }
  done
}

restore_quiesced() {
  local index name result=0
  # Redis is appended last during planning, so restart dependencies first.
  for ((index=${#running_before[@]}-1; index>=0; index--)); do
    name="${running_before[index]}"
    if container_exists "$name"; then
      docker start "$name" >/dev/null || result=1
    fi
  done
  return "$result"
}

on_cleanup_exit() {
  local result=$?
  trap - EXIT
  if [ "$result" -ne 0 ] && [ "${QUIESCED:-false}" = true ]; then
    restore_quiesced || echo 'Some stopped services need operator recovery.' >&2
    echo "Cleanup failed. Surviving services were restarted. Backups retained: ${BACKUP_DIR:-not-created}" >&2
    if [ "${DELETION_STARTED:-false}" = true ]; then
      echo 'Deletion was incomplete. Restore removed resources from the verified backup and saved images.' >&2
    fi
  fi
  exit "$result"
}

quiesce_writers() {
  running_before=()
  local name state
  for name in "${containers[@]}"; do
    state="$(docker inspect -f '{{.State.Running}}' "$name")"
    [ "$state" != true ] || running_before+=("$name")
  done
  QUIESCED=true
  # Drain application writes before stopping Redis and archiving either volume.
  for name in "${running_before[@]}"; do
    [ "$name" = "$REDIS_CONTAINER" ] || graceful_stop "$name"
  done
  for name in "${running_before[@]}"; do
    if [ "$name" = "$REDIS_CONTAINER" ]; then
      docker exec "$name" sh -ec 'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli SAVE >/dev/null'
      graceful_stop "$name"
    fi
  done
  assert_quiesced
}

quiesce_cleanup() {
  trap on_cleanup_exit EXIT
  quiesce_writers
}
