import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function hasSupabaseConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

/** Cliente con la sesión de quien navega (cookies). */
export async function getSessionClient(): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            // En un Server Component no se pueden escribir cookies; el navegador
            // renueva la sesión por su cuenta.
          }
        },
      },
    },
  );
}

/**
 * Cliente con la clave de servicio: salta los permisos de la base.
 * Sólo se usa en el servidor y siempre después de requireAdmin().
 */
export function getServiceClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface AdminSession {
  userId: string;
  email: string;
  db: SupabaseClient;
}

/** Corta el acceso si quien navega no es administrador activo. */
export async function requireAdmin(): Promise<AdminSession> {
  if (!hasSupabaseConfig()) redirect("/sin-configurar");
  const session = await getSessionClient();
  const { data } = await session.auth.getUser();
  if (!data.user) redirect("/ingresar");
  const db = getServiceClient();
  const { data: profile } = await db
    .from("profiles")
    .select("role, status")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!profile || profile.role !== "admin" || profile.status !== "activo") {
    redirect("/ingresar?error=sin-permiso");
  }
  return { userId: data.user.id, email: data.user.email ?? "", db };
}
