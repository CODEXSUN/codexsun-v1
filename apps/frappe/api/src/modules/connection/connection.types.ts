import type { EnquiryDatabase } from "@codexsun/crm-api/enquiry-sync";
import type { ColumnType, Generated } from "kysely";

export type FrappeSettings = {
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
  enabled: boolean;
};

export type FrappeConnectionInput = {
  connectionName: string;
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
  enabled: boolean;
};

export type FrappeConnectionRow = {
  id: number;
  connection_name: string;
  base_url: string;
  api_key_ciphertext: string | null;
  api_secret_ciphertext: string | null;
  enabled: number | boolean;
  verification_status: "unverified" | "verified" | "failed";
  last_checked_at: string | Date | null;
  last_verified_at: string | Date | null;
  updated_at: ColumnType<string | Date, string | undefined, string>;
};

export type FrappeSyncRow = {
  enquiry_id: number;
  remote_name: string;
  source_site_key: ColumnType<string | null, string | null | undefined, string | null>;
  synced_at: ColumnType<string, string | undefined, string>;
  source_modified_at: ColumnType<string | Date | null, string | undefined, string>;
};

export type FrappeDataSourceRow = {
  module_key: string;
  provider: "local" | "frappe";
  updated_by: string;
  updated_at: ColumnType<string | Date, string | undefined, string>;
};

export type FrappeDatabase = EnquiryDatabase & {
  frappe_contact_imports: {
    id: number;
    remote_name: string;
    local_contact_id: number;
    created_at: string;
    updated_at: string;
  };
  frappe_contact_exports: {
    id: number;
    remote_name: string;
    local_contact_id: number;
    created_at: string;
    updated_at: string;
  };
  frappe_contact_customer_identity: {
    id: number;
    source_key: string;
    remote_name: string;
    local_contact_id: number;
    created_at: string;
    updated_at: string;
  };
  frappe_activity_imports: {
    id: number;
    remote_name: string;
    local_activity_id: number;
    created_at: string;
    updated_at: string;
  };
  frappe_import_state: {
    id: number;
    completed_at: string | Date | null;
    completed_by: string | null;
    updated_at: string | Date;
  };
  frappe_connection_settings: FrappeConnectionRow;
  frappe_data_sources: FrappeDataSourceRow;
  frappe_enquiry_sync: FrappeSyncRow;
  frappe_availability_settings: {
    id: number;
    schedule_enabled: number | boolean;
    timezone: string;
    opens_at: string;
    closes_at: string;
    connection_status: "unknown" | "online" | "offline";
    checked_base_url: string | null;
    last_checked_at: Date | string | null;
    next_check_at: Date | string | null;
    last_error: string | null;
    updated_by: string;
    updated_at: Date | string;
  };
  frappe_live_sync_settings: {
    id: number;
    enabled: number | boolean;
    paused: number | boolean;
    schedule_minutes: number;
    contacts_enabled: number | boolean;
    enquiries_enabled: number | boolean;
    activities_enabled: number | boolean;
    call_logs_enabled: number | boolean;
    last_scheduled_at: string | Date | null;
    direction: "inbound" | "bidirectional";
    inbound_base_url: string | null;
    inbound_checkpoint_at: string | Date | null;
    contact_export_started_at: string | Date | null;
    updated_by: string;
    updated_at: string | Date;
  };
  frappe_enquiry_snapshots: {
    id: Generated<number>;
    source_key: string;
    base_url: string;
    remote_name: string;
    enquiry_id: number | null;
    document_json: string;
    created_at: ColumnType<string | Date, string | undefined, never>;
  };
};
