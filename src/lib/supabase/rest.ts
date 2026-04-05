import { getSupabaseConfig, hasSupabaseServerConfig } from "./config";

type RequestMethod = "GET" | "POST" | "PATCH" | "DELETE";

function buildSupabaseAuthHeaders(
  key: string,
  extraHeaders?: Record<string, string>,
) {
  const isOpaqueKey =
    key.startsWith("sb_publishable_") || key.startsWith("sb_secret_");

  return {
    apikey: key,
    ...(isOpaqueKey ? {} : { Authorization: `Bearer ${key}` }),
    "Content-Type": "application/json",
    ...extraHeaders,
  };
}

async function supabaseRestRequest<T>(
  path: string,
  method: RequestMethod,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T | null> {
  if (!hasSupabaseServerConfig()) {
    return null;
  }

  const config = getSupabaseConfig();
  const headers = buildSupabaseAuthHeaders(
    config.serviceRoleKey!,
    extraHeaders,
  );

  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase REST request failed: ${response.status} ${errorText}`);
  }

  const text = await response.text();
  if (!text) {
    return null;
  }

  return JSON.parse(text) as T;
}

export async function supabaseSelect<T>(path: string) {
  return supabaseRestRequest<T>(path, "GET");
}

export async function supabaseInsert<T>(path: string, body: unknown) {
  return supabaseRestRequest<T>(path, "POST", body, {
    Prefer: "return=representation",
  });
}

export async function supabaseUpsert<T>(path: string, body: unknown) {
  return supabaseRestRequest<T>(path, "POST", body, {
    Prefer: "resolution=merge-duplicates,return=representation",
  });
}

export async function supabaseDelete<T>(path: string) {
  return supabaseRestRequest<T>(path, "DELETE", undefined, {
    Prefer: "return=representation",
  });
}

export async function supabaseRpc<T>(fn: string, body: unknown) {
  if (!hasSupabaseServerConfig()) {
    return null;
  }

  const config = getSupabaseConfig();
  const response = await fetch(`${config.url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: buildSupabaseAuthHeaders(config.serviceRoleKey!),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase RPC failed: ${response.status} ${errorText}`);
  }

  const text = await response.text();
  if (!text) {
    return null;
  }

  return JSON.parse(text) as T;
}
