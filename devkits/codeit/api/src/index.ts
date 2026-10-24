import {
  ArtifactSchema,
  ArtifactTypeSchema,
  StoreArtifactInputSchema
} from "./modules/artifact/artifact.types.js";
import {
  CreateProjectInputSchema,
  HexUuidSchema,
  ProjectSchema,
  TrustStateSchema
} from "./modules/project/project.types.js";

export const codeitContracts = {
  HexUuidSchema,
  TrustStateSchema,
  ProjectSchema,
  CreateProjectInputSchema,
  ArtifactTypeSchema,
  ArtifactSchema,
  StoreArtifactInputSchema
};

export * from "./errors.js";
export * from "./host/index.js";
export * from "./storage/index.js";
export * from "./modules/project/index.js";
export * from "./modules/artifact/index.js";
export * from "./modules/provider/index.js";

// Tool module exports (resolving duplicate HexUuidSchema and RouteDefinition)
export {
  ToolCategorySchema,
  ToolDefinitionSchema,
  PolicyDecisionSchema,
  ToolInvocationRecordSchema,
  ApprovalDecisionSchema,
  ApprovalRecordSchema,
  ToolPolicy,
  ToolService,
  createToolRoutes,
  ToolModule
} from "./modules/tool/index.js";
export type {
  ToolCategory,
  ToolDefinition,
  PolicyDecision,
  ToolInvocationRecord,
  ApprovalDecision,
  ApprovalRecord
} from "./modules/tool/index.js";

// Conversation module exports (resolving duplicate HexUuidSchema and RouteDefinition)
export {
  ConversationModeSchema,
  MessageRoleSchema,
  MessageCompletionStateSchema,
  ConversationSchema,
  CreateConversationInputSchema,
  MessageSchema,
  AppendMessageInputSchema,
  ConversationRepository,
  ConversationService,
  createConversationRoutes,
  ConversationModule
} from "./modules/conversation/index.js";
export type {
  ConversationMode,
  MessageRole,
  MessageCompletionState,
  ConversationRecord,
  CreateConversationInput,
  MessageRecord,
  AppendMessageInput,
  ListMessagesOptions,
  ListMessagesResult
} from "./modules/conversation/index.js";

// Run module exports (resolving duplicate RouteDefinition)
export {
  RUN_STATES,
  RunStateSchema,
  TERMINAL_STATES,
  VALID_RUN_TRANSITIONS,
  BudgetSchema,
  DEFAULT_BUDGET,
  RunSchema,
  RunEventSchema,
  CreateRunInputSchema,
  RunRepository,
  RunService,
  CodingLoopService,
  createRunRoutes,
  RunModule
} from "./modules/run/index.js";
export type {
  RunState,
  Budget,
  RunRecord,
  RunEvent,
  CreateRunInput,
  CodingLoopOptions,
  CodingLoopResult
} from "./modules/run/index.js";

// Workspace module exports (resolving duplicate RouteDefinition)
export {
  WorkspaceReader,
  WorkspaceSearcher,
  WorkspaceGit,
  WorkspacePatcher,
  PatchConflictError,
  computeUnifiedDiff,
  applyUnifiedDiff,
  CommandRunner,
  killProcessTree,
  scrubEnvironment,
  DEFAULT_COMMAND_TIMEOUT_MS,
  DEFAULT_MAX_OUTPUT_BYTES,
  PERMITTED_EXECUTABLES,
  createWorkspaceRoutes,
  WorkspaceModule,
  WorkspaceReadFileOptionsSchema,
  WorkspaceReadFileResultSchema,
  WorkspaceDirectoryEntrySchema,
  WorkspaceListDirectoryResultSchema,
  WorkspaceSearchOptionsSchema,
  WorkspaceSearchMatchSchema,
  WorkspaceSearchResultSchema,
  GitStatusFileSchema,
  GitStatusResultSchema,
  GitDiffResultSchema,
  DiffHunkSchema,
  FileDiffSchema,
  PatchProposalSchema,
  ApplyPatchInputSchema,
  PatchResultSchema,
  PermittedExecutableSchema,
  ExecuteCommandInputSchema,
  CommandResultSchema,
  CommandOutputChunkSchema
} from "./modules/workspace/index.js";
export type {
  WorkspaceReadFileOptions,
  WorkspaceReadFileResult,
  WorkspaceDirectoryEntry,
  WorkspaceListDirectoryResult,
  WorkspaceSearchOptions,
  WorkspaceSearchMatch,
  WorkspaceSearchResult,
  GitStatusFile,
  GitStatusResult,
  GitDiffResult,
  DiffHunk,
  FileDiff,
  PatchProposal,
  ApplyPatchInput,
  PatchResult,
  RunStatusLookup,
  ArtifactCreationInput,
  ArtifactCreationCallback,
  WorkspacePatcherOptions,
  PermittedExecutable,
  ExecuteCommandInput,
  CommandResult,
  CommandOutputChunk,
  CommandRunnerOptions,
  ProjectLookupFn
} from "./modules/workspace/index.js";

// Orchestration module exports (resolving duplicate RouteDefinition)
export {
  ASSIGNMENT_STATES,
  AssignmentStateSchema,
  ALL_ASSIGNMENT_STATES,
  normalizeAssignmentState,
  PathLeaseSchema,
  AssignmentSchema,
  WorkerHeartbeatSchema,
  DispatchRequestSchema,
  DispatchResultSchema,
  CompleteAssignmentRequestSchema,
  FailAssignmentRequestSchema,
  IntegrationFilePatchSchema,
  IntegrationGateInputSchema,
  ConcurrencyLimitExceededError,
  DependencyUnsatisfiedError,
  PathLeaseConflictError,
  LeaseExpiredError,
  WorkerIsolationError,
  IntegrationConflictError,
  IntegrationHashMismatchError,
  normalizePathPattern,
  pathsOverlap,
  OrchestrationRepository,
  OrchestrationService,
  createOrchestrationRoutes,
  OrchestrationModule
} from "./modules/orchestration/index.js";
export type {
  AssignmentState,
  PathLease,
  AssignmentRecord,
  WorkerHeartbeat,
  DispatchRequest,
  DispatchResult,
  CompleteAssignmentRequest,
  FailAssignmentRequest,
  IntegrationFilePatch,
  IntegrationGateInput,
  IntegrationGateResult,
  OrchestrationServiceOptions
} from "./modules/orchestration/index.js";

// Personalization module exports (resolving duplicate HexUuidSchema and RouteDefinition)
export {
  FactScopeSchema,
  ConfirmationStateSchema,
  PersonalFactSchema,
  CreateFactInputSchema,
  ConfirmFactInputSchema,
  StoredPreferenceSchema,
  FactFilterSchema,
  ContextPreviewInputSchema,
  ExcludedFactReasonSchema,
  ContextPreviewSchema,
  PersonalizationRepository,
  PersonalizationService,
  createPersonalizationRoutes,
  PersonalizationModule
} from "./modules/personalization/index.js";
export type {
  FactScope,
  ConfirmationState,
  PersonalFact,
  CreateFactInput,
  ConfirmFactInput,
  StoredPreference,
  FactFilter,
  ContextPreviewInput,
  ExcludedFactReason,
  ContextPreview
} from "./modules/personalization/index.js";

// Plugin module exports (resolving duplicate HexUuidSchema and RouteDefinition)
export {
  PluginEnabledStateSchema,
  AdvertisedToolSchema,
  PluginAuthorSchema,
  PluginEntrypointSchema,
  PluginManifestSchema,
  PluginInstallRecordSchema,
  McpMessageSchema,
  McpRequestSchema,
  McpResponseSchema,
  McpNotificationSchema,
  McpToolDefinitionSchema,
  McpCallToolResultContentSchema,
  McpCallToolResultSchema,
  PluginIntegrityError,
  PluginStateError,
  PluginRevokedError,
  McpProtocolError,
  computeManifestDigest,
  PluginRepository,
  McpBroker,
  PluginBroker,
  namespaceToolName,
  unnamespaceToolName,
  PluginService,
  createPluginRoutes,
  PluginModule
} from "./modules/plugin/index.js";
export type {
  PluginEnabledState,
  AdvertisedTool,
  PluginEntrypoint,
  PluginManifest,
  PluginInstallRecord,
  McpMessage,
  McpRequest,
  McpResponse,
  McpNotification,
  McpToolDefinition,
  McpCallToolResult
} from "./modules/plugin/index.js";

export * from "./server.js";
