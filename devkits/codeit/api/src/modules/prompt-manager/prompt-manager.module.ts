import type { FastifyInstance } from "fastify";
import type { DatabaseSync } from "node:sqlite";
import { defineModule } from "../../../../../../packages/framework/src/modules/composition.js";
import { migratePromptManager } from "./prompt-manager.migration.js";
import { PromptManagerRepository } from "./prompt-manager.repository.js";
import { registerPromptManagerRoutes } from "./prompt-manager.routes.js";
import { PromptManagerService } from "./prompt-manager.service.js";
import type { CodexGateway } from "./prompt-manager.types.js";

// Local single-user aggregate: runs and activity belong to their saved prompt.
// No tenant sync, seed records, queue worker or business events are required.
// Prompts with run history are suspended rather than deleted to retain evidence.
export const promptManagerModule = defineModule<{
  app: FastifyInstance;
  db: DatabaseSync;
  codex: CodexGateway;
}>({
  key: "codeit.prompt-manager",
  label: "Prompt Manager",
  register({ app, db, codex }) {
    migratePromptManager(db);
    const repository = new PromptManagerRepository(db);
    repository.recoverInterrupted();
    registerPromptManagerRoutes(app, new PromptManagerService(repository, codex));
  }
});
