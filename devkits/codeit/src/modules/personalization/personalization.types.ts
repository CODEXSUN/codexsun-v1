export type FactScope = "user" | "project" | "conversation";

export type ConfirmationState = "unconfirmed" | "confirmed" | "rejected" | "stale";

export interface PersonalFact {
  id?: number | undefined;
  uuid: string;
  scope: FactScope;
  owner_id: string;
  fact_key: string;
  fact_value: string;
  source: string;
  confirmation_state: ConfirmationState;
  verified_at?: string | null | undefined;
  created_at: string;
  updated_at: string;
}

export interface CreateFactPayload {
  scope: FactScope;
  owner_id: string;
  fact_key: string;
  fact_value: string;
  source?: string | undefined;
  confirmation_state?: ConfirmationState | undefined;
}

export interface ExcludedFactReason {
  fact: PersonalFact;
  reason: string;
}

export interface ContextPreview {
  project_uuid?: string | undefined;
  conversation_uuid?: string | undefined;
  assembled_prompt: string;
  included_facts: PersonalFact[];
  excluded_facts: ExcludedFactReason[];
  token_estimate: number;
  token_budget: number;
  truncated: boolean;
}

export interface PersonalizationPanelProps {
  currentProjectUuid?: string | undefined;
  currentConversationUuid?: string | undefined;
  currentUserId?: string | undefined;
  className?: string | undefined;
}
