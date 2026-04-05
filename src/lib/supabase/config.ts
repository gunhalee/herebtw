export type SupabaseRuntimeConfig = {
  url: string | null;
  anonKey: string | null;
  serviceRoleKey: string | null;
};

/** Publishable (sb_publishable_…), legacy anon JWT, or shadcn env name. */
export function getSupabaseBrowserKey(): string | null {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    null
  );
}

/** Secret (sb_secret_...), legacy service_role JWT, or env fallback. */
export function getSupabaseServerKey(): string | null {
  return (
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    null
  );
}

export function getSupabaseConfig(): SupabaseRuntimeConfig {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
    anonKey: getSupabaseBrowserKey(),
    serviceRoleKey: getSupabaseServerKey(),
  };
}

export function hasSupabaseServerConfig() {
  const config = getSupabaseConfig();

  return Boolean(config.url && config.serviceRoleKey);
}
