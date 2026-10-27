export function startQueueRelay(
  dispatch: () => Promise<void>,
  intervalMs: number,
  canExecute: () => boolean
) {
  let closing = false;
  let active: Promise<void> | null = null;
  const tick = () => {
    if (closing || active || !canExecute()) return;
    active = Promise.resolve()
      .then(async () => {
        if (!closing && canExecute()) await dispatch();
      })
      .catch((error) => {
        console.warn("[queue] relay pass deferred", error);
      })
      .finally(() => {
        active = null;
      });
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  tick();
  return async () => {
    closing = true;
    clearInterval(timer);
    await active;
  };
}
