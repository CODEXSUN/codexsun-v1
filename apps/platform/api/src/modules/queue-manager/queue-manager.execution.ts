export type QueueExecutionHost = "platform" | "worker";

export function queueExecutionAllowed(
  settings: {
    CODEXSUN_QUEUE_WORKER_ENABLED: string;
    CODEXSUN_QUEUE_EXECUTION_HOST: QueueExecutionHost;
  },
  executor: QueueExecutionHost
) {
  return (
    settings.CODEXSUN_QUEUE_WORKER_ENABLED === "1" &&
    settings.CODEXSUN_QUEUE_EXECUTION_HOST === executor
  );
}
