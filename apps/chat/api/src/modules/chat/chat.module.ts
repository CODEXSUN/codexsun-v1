import type { FastifyInstance } from "fastify";
import { defineModule } from "@codexsun/framework/modules";
import { ChatConnectionManager, ChatRealtimeBus, registerChatRealtime } from "./chat.realtime.js";
import { registerChatRoutes } from "./chat.routes.js";
import type { ChatModuleDependencies } from "./chat.types.js";
import { registerChatTelegramRoutes } from "./chat.telegram.routes.js";
import { ChatTelegramWorker } from "./chat.telegram.worker.js";

export function createChatModule(dependencies: ChatModuleDependencies) {
  return defineModule<{ app: FastifyInstance }>({
    key: "chat",
    label: "Chat",
    register: async ({ app }) => {
      const manager = new ChatConnectionManager();
      const bus = new ChatRealtimeBus(manager);
      registerChatRoutes(app, { ...dependencies, events: bus });
      registerChatTelegramRoutes(app, dependencies);
      if (dependencies.subscribeExternalMessages) {
        const unsubscribe = await dependencies.subscribeExternalMessages((context, message) =>
          bus.messageCreatedInScope(context, message)
        );
        app.addHook("onClose", unsubscribe);
      }
      if (dependencies.telegram && dependencies.telegramExecution !== false) {
        const stop = new ChatTelegramWorker(dependencies.telegram, (context, message) =>
          bus.messageCreatedInScope(context, message)
        ).start();
        app.addHook("onClose", async () => stop());
      }
      await registerChatRealtime(app, { ...dependencies, events: bus, manager });
    }
  });
}
