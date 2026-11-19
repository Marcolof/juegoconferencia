export default function SinConfigurarPage() {
  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-2xl font-bold">Falta configurar Supabase</h1>
      <p className="mt-4 text-muted">
        El panel necesita NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY. En
        local van en <code>apps/admin/.env.local</code> (ver <code>.env.example</code>); en Vercel, en las
        variables de entorno del proyecto.
      </p>
    </main>
  );
}
