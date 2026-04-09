/** Standard Fivetran API response envelope. */
export interface FivetranResponse<T = unknown> {
  code: string;
  message: string;
  data: T;
}

/** Paginated list response data shape. */
export interface PaginatedData<T> {
  items: T[];
  next_cursor?: string;
}

export interface Connection {
  id: string;
  service: string;
  schema: string;
  paused: boolean;
  group_id: string;
  sync_frequency: number;
  schedule_type: string;
  created_at: string;
  succeeded_at: string | null;
  failed_at: string | null;
  status: ConnectionStatus;
  config: Record<string, unknown>;
}

export interface ConnectionStatus {
  setup_state: "incomplete" | "connected" | "broken";
  sync_state: "scheduled" | "syncing" | "paused" | "rescheduled";
  update_state: "on_schedule" | "delayed";
  is_historical_sync: boolean;
  tasks: Array<{ code: string; message: string }>;
  warnings: Array<{ code: string; message: string }>;
}

export interface Group {
  id: string;
  name: string;
  created_at: string;
}

export interface Destination {
  id: string;
  group_id: string;
  service: string;
  region: string;
  time_zone_offset: string;
  created_at: string;
  setup_status: string;
  config: Record<string, unknown>;
}

export interface User {
  id: string;
  email: string;
  given_name: string;
  family_name: string;
  role: string;
  active: boolean;
  verified: boolean;
  created_at: string;
  logged_in_at: string | null;
}

export interface Transformation {
  id: string;
  dbt_project_id: string;
  paused: boolean;
  group_id: string;
  created_at: string;
  trigger?: {
    trigger_type: "ON_DEMAND" | "SCHEDULED" | "ON_CONNECTOR_SUCCESS";
    trigger_connector_ids?: string[];
    trigger_schedule?: string;
  };
  connector_ids?: string[];
}

export interface SchemaConfig {
  schema_change_handling: "ALLOW_ALL" | "ALLOW_COLUMNS" | "BLOCK_ALL";
  schemas: Record<
    string,
    {
      name_in_destination: string;
      enabled: boolean;
      tables: Record<
        string,
        {
          name_in_destination: string;
          enabled: boolean;
          sync_mode: "SOFT_DELETE" | "HISTORY" | "LIVE";
          columns: Record<
            string,
            {
              name_in_destination: string;
              enabled: boolean;
              hashed: boolean;
              is_primary_key: boolean;
            }
          >;
        }
      >;
    }
  >;
}
