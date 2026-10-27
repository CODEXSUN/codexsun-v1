import type { FastifyInstance } from "fastify";

export type BackgroundRuntime = {
  isReady: () => boolean;
  executionHost: "platform" | "worker";
};

export declare function startBackgroundRuntime(app: FastifyInstance): Promise<BackgroundRuntime>;
