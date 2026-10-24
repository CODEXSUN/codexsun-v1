/**
 * Public exports for the Codeit Conversation Module
 * Conforms to CODEXSUN Architecture and CONTRACTS.md
 */

export { ConversationWorkspace } from "./conversation.workspace";
export { ConversationList } from "./conversation.list";
export type { ConversationListProps } from "./conversation.list";
export { ConversationForm } from "./conversation.form";
export type { ConversationFormProps } from "./conversation.form";

export { useConversation } from "./conversation.hooks";
export type { UseConversationOptions } from "./conversation.hooks";

export { ConversationService, conversationService } from "./conversation.services";

export { ToolCard } from "./components/tool-card";
export { ArtifactViewer } from "./components/artifact-viewer";
export { ApprovalCard } from "./components/approval-card";
export { ConversationStatusBar } from "./components/status-bar";
export { PatchReview } from "./components/patch-review";
export type { PatchReviewProps, PatchReviewData } from "./components/patch-review";
export { CommandOutput } from "./components/command-output";
export type { CommandOutputProps } from "./components/command-output";

export * from "./conversation.types";
export * from "./conversation.schema";
