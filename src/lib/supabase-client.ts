import { createClient } from '@supabase/supabase-js';

// Lazy-initialized Supabase Client
let supabaseInstance: ReturnType<typeof createClient> | null = null;

export function isSupabaseConfigured(): boolean {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  const service = typeof process !== 'undefined' ? process.env.SUPABASE_SERVICE_ROLE_KEY : undefined;
  return !!(url && (service || anon));
}

export function getSupabaseClient() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase environment variables (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY) are not set.');
  }

  if (!supabaseInstance) {
    const rawUrl = process.env.SUPABASE_URL!;
    const url = rawUrl ? rawUrl.trim() : '';

    const serviceKey = typeof process !== 'undefined' ? process.env.SUPABASE_SERVICE_ROLE_KEY : undefined;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    const key = (serviceKey || anonKey || '').trim();

    console.log(`[Supabase] Initializing client for ${url}`);
    const isBrowser = typeof window !== 'undefined';
    supabaseInstance = createClient(url, key, {
      auth: {
        persistSession: isBrowser,
        autoRefreshToken: isBrowser,
        detectSessionInUrl: isBrowser,
      }
    });
  }
  return supabaseInstance;
}

export let supportedSupabaseColumns: Set<string> | null = null;
export let isTicketsIssueTypesArray = false; // default matching tickets table schema
export let isHardwareIssueTypesArray = true; // default matching hardware table schema

export async function detectSupabaseColumns(): Promise<Set<string>> {
  if (supportedSupabaseColumns) return supportedSupabaseColumns;

  const cols = new Set<string>();
  if (!isSupabaseConfigured()) {
    supportedSupabaseColumns = cols;
    return cols;
  }

  try {
    const rawUrl = typeof process !== 'undefined' ? process.env.SUPABASE_URL : undefined;
    const url = rawUrl ? rawUrl.trim() : '';
    const serviceKey = typeof process !== 'undefined' ? process.env.SUPABASE_SERVICE_ROLE_KEY : undefined;
    const anonKey = typeof process !== 'undefined' ? process.env.SUPABASE_ANON_KEY : undefined;
    const key = (serviceKey || anonKey || '').trim();

    if (url && key) {
      const specUrl = `${url}/rest/v1/`;
      console.log(`[Supabase] Fetching OpenAPI schema to discover supported columns: ${specUrl}`);
      const res = await fetch(specUrl, {
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`
        }
      });
      if (res.ok) {
        const openapi = await res.json();
        const properties = openapi.definitions?.tickets?.properties;
        if (properties) {
          Object.keys(properties).forEach(k => cols.add(k));
          supportedSupabaseColumns = cols;
          console.log("[Supabase] Auto-detected supported columns from OpenAPI spec:", Array.from(cols));
        }

        // Auto-detect if tickets.issue_types is an array or a standard string
        const ticketsIssueTypesProp = openapi.definitions?.tickets?.properties?.issue_types;
        if (ticketsIssueTypesProp) {
          isTicketsIssueTypesArray = (ticketsIssueTypesProp.type === 'array');
          console.log(`[Supabase] Auto-detected tickets.issue_types type: ${ticketsIssueTypesProp.type} (isArray: ${isTicketsIssueTypesArray})`);
        }

        // Auto-detect if hardware.issue_types is an array or a standard string
        const hardwareIssueTypesProp = openapi.definitions?.hardware?.properties?.issue_types;
        if (hardwareIssueTypesProp) {
          isHardwareIssueTypesArray = (hardwareIssueTypesProp.type === 'array');
          console.log(`[Supabase] Auto-detected hardware.issue_types type: ${hardwareIssueTypesProp.type} (isArray: ${isHardwareIssueTypesArray})`);
        }

        if (properties) {
          return cols;
        }
      } else {
        console.warn(`[Supabase] OpenAPI fetch returned status ${res.status}`);
      }
    }
  } catch (err) {
    console.warn("[Supabase] Failed to auto-detect columns via OpenAPI:", err);
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('tickets').select('*').limit(1);
    if (!error && data && data.length > 0) {
      Object.keys(data[0]).forEach(k => cols.add(k));
      supportedSupabaseColumns = cols;
      console.log("[Supabase] Auto-detected supported columns from row fallback:", Array.from(cols));
      return cols;
    }
  } catch (err) {
    console.warn("[Supabase] Fallback 1-row query failed:", err);
  }

  console.log("[Supabase] Using default safe columns list (excluding optional columns)");
  supportedSupabaseColumns = cols;
  return cols;
}

export function filterPayloadForSupabase(payload: any): any {
  if (!payload) return payload;
  const filtered: any = {};

  const coreColumns = [
    'id', 'date', 'officer_name', 'phone', 'partner', 'region',
    'anydesk_address', 'device_type', 'kit_number', 'issue_description',
    'status', 'response_text', 'responder_name', 'created_at', 'updated_at'
  ];

  coreColumns.forEach(col => {
    if (payload[col] !== undefined) {
      filtered[col] = payload[col];
    }
  });

  const extendedColumns = [
    'assigned_to', 'issue_types', 'hw_issue_status', 'hw_resolution_method', 'hw_replacement_source'
  ];

  extendedColumns.forEach(col => {
    if (payload[col] !== undefined) {
      if (supportedSupabaseColumns && supportedSupabaseColumns.size > 0) {
        if (supportedSupabaseColumns.has(col)) {
          filtered[col] = payload[col];
        }
      } else {
        // Safe fallback: exclude if schema not fetched yet
      }
    }
  });

  return filtered;
}

// --- Transformers to bridge CamelCase (Application/Drizzle) and SnakeCase (Supabase Database) ---

export interface TicketCamelCase {
  id: string;
  date: string;
  officerName: string;
  phone: string;
  partner: string;
  region: string;
  anydeskAddress: string;
  deviceType: string;
  kitNumber: string;
  issueDescription: string;
  status: string;
  responseText?: string | null;
  responderName?: string | null;
  assignedTo?: string | null;
  issueTypes?: string[] | null;
  hwIssueStatus?: string | null;
  hwResolutionMethod?: string | null;
  hwReplacementSource?: string | null;
  regCenterName?: string | null;
  verifiedBy?: string | null;
  dateVerified?: string | null;
  kitType?: string | null;
  createdAt: string;
  updatedAt: string;
}

export function mapTicketToCamelCase(row: any): TicketCamelCase {
  let parsedIssueTypes: string[] = [];
  let assignedTo: string | null = row.assigned_to !== undefined && row.assigned_to !== null ? row.assigned_to : null;
  let issueDescription = row.issue_description || '';

  // Extract metadata if present for legacy compatibility
  const delimiter = '\n\n---METADATA---\n';
  let legacyIssueTypes: string[] | null = null;
  let legacyAssignedTo: string | null = null;

  if (issueDescription.includes(delimiter)) {
    const parts = issueDescription.split(delimiter);
    issueDescription = parts[0];
    try {
      const meta = JSON.parse(parts[1]);
      if (meta.issueTypes) legacyIssueTypes = meta.issueTypes;
      if (meta.assignedTo) legacyAssignedTo = meta.assignedTo;
    } catch (e) {
      console.warn("[Supabase] Failed to parse metadata block", e);
    }
  }

  // Parse issue_types column if it exists and has content
  if (row.issue_types) {
    if (Array.isArray(row.issue_types)) {
      parsedIssueTypes = row.issue_types;
    } else if (typeof row.issue_types === 'string') {
      try {
        if (row.issue_types.startsWith('[')) {
          parsedIssueTypes = JSON.parse(row.issue_types);
        } else {
          parsedIssueTypes = row.issue_types.split(',').map((s: string) => s.trim()).filter(Boolean);
        }
      } catch (e) {
        parsedIssueTypes = row.issue_types.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
    }
  } else if (legacyIssueTypes) {
    parsedIssueTypes = legacyIssueTypes;
  }

  // Use assigned_to column or legacy fallback
  if (assignedTo === null && legacyAssignedTo !== null) {
    assignedTo = legacyAssignedTo;
  }

  return {
    id: row.id,
    date: row.date,
    officerName: row.officer_name,
    phone: row.phone,
    partner: row.partner,
    region: row.region,
    anydeskAddress: row.anydesk_address || '',
    deviceType: row.device_type || '',
    kitNumber: row.kit_number,
    issueDescription: issueDescription,
    status: row.status || 'Open',
    responseText: row.response_text,
    responderName: row.responder_name,
    assignedTo: assignedTo,
    issueTypes: parsedIssueTypes,
    hwIssueStatus: row.hw_issue_status,
    hwResolutionMethod: row.hw_resolution_method,
    hwReplacementSource: row.hw_replacement_source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapTicketToSnakeCase(t: Partial<TicketCamelCase>): any {
  const row: any = {};
  if (t.id !== undefined) row.id = t.id;
  if (t.date !== undefined) row.date = t.date;
  if (t.officerName !== undefined) row.officer_name = t.officerName;
  if (t.phone !== undefined) row.phone = t.phone;
  if (t.partner !== undefined) row.partner = t.partner;
  if (t.region !== undefined) row.region = t.region;
  if (t.anydeskAddress !== undefined) row.anydesk_address = t.anydeskAddress;
  if (t.deviceType !== undefined) row.device_type = t.deviceType;
  if (t.kitNumber !== undefined) row.kit_number = t.kitNumber;
  if (t.status !== undefined) row.status = t.status;
  if (t.responseText !== undefined) row.response_text = t.responseText;
  if (t.responderName !== undefined) row.responder_name = t.responderName;
  if (t.createdAt !== undefined) row.created_at = t.createdAt;
  if (t.updatedAt !== undefined) row.updated_at = t.updatedAt;

  if (t.hwIssueStatus !== undefined) row.hw_issue_status = t.hwIssueStatus;
  if (t.hwResolutionMethod !== undefined) row.hw_resolution_method = t.hwResolutionMethod;
  if (t.hwReplacementSource !== undefined) row.hw_replacement_source = t.hwReplacementSource;

  // Store separately as direct columns in Supabase
  if (t.issueTypes !== undefined) {
    if (isTicketsIssueTypesArray) {
      row.issue_types = t.issueTypes ? (Array.isArray(t.issueTypes) ? t.issueTypes : (typeof t.issueTypes === 'string' ? (t.issueTypes as string).split(',').map((s: string) => s.trim()).filter(Boolean) : [])) : [];
    } else {
      row.issue_types = t.issueTypes ? (Array.isArray(t.issueTypes) ? t.issueTypes.join(', ') : t.issueTypes) : null;
    }
  }
  if (t.assignedTo !== undefined) {
    row.assigned_to = t.assignedTo;
  }

  if (t.issueDescription !== undefined) {
    let baseDescription = t.issueDescription || '';
    // Strip existing metadata if present to avoid duplicating/nesting
    const delimiter = '\n\n---METADATA---\n';
    if (baseDescription.includes(delimiter)) {
      baseDescription = baseDescription.split(delimiter)[0];
    }
    // We do NOT append metadata anymore; we use clean separate columns as requested.
    row.issue_description = baseDescription;
  }

  return filterPayloadForSupabase(row);
}

export interface UserCamelCase {
  id?: number;
  uid: string;
  email: string;
  username: string;
  role: string;
  partner?: string | null;
  createdAt?: string;
  status?: string;
}

export function mapUserToCamelCase(row: any): UserCamelCase {
  return {
    id: row.id,
    uid: row.uid,
    email: row.email,
    username: row.username,
    role: row.role || 'user',
    partner: row.partner,
    createdAt: row.created_at,
    status: row.status || 'approved',
  };
}

export function mapUserToSnakeCase(u: Partial<UserCamelCase>): any {
  const row: any = {};
  if (u.id !== undefined) row.id = u.id;
  if (u.uid !== undefined) row.uid = u.uid;
  if (u.email !== undefined) row.email = u.email;
  if (u.username !== undefined) row.username = u.username;
  if (u.role !== undefined) row.role = u.role;
  if (u.partner !== undefined) row.partner = u.partner;
  if (u.createdAt !== undefined) row.created_at = u.createdAt;
  if (u.status !== undefined) row.status = u.status;
  return row;
}
