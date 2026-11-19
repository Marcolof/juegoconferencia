# Juego de la convención

Web responsive para la convención de Vortex. Cada jugador escanea el QR de otra persona y, charlando, descubre una de sus respuestas entre 3 opciones; después la otra persona descubre una suya. Suma 1 punto quien acierta. La administración ve el ranking en vivo y gestiona las cuentas.

## Estructura

```text
apps/
  juego/     web del participante (celular) · Next.js · puerto 3000
  admin/     panel de administración · Next.js · puerto 3001
packages/
  shared/    reglas y tipos comunes (largo de respuestas, iniciales, mensajes de error)
supabase/
  migrations/  esquema, permisos (RLS), funciones del juego, fotos y preguntas por defecto
  config.toml  configuración de Auth (contraseña mínima de 6, sin confirmación de email)
```

**Principio de seguridad:** el navegador nunca recibe la respuesta correcta. Las 3 opciones las arma la función `start_encounter` en la base, y la corrección la hace `answer_turn`. La tabla de turnos no se puede leer desde el navegador.

## Requisitos

- Node 20.9 o superior y npm.
- Un proyecto de Supabase. No hace falta Docker: se desarrolla contra un proyecto remoto.

## Puesta en marcha

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Crear la base en Supabase (una sola vez por proyecto):

   ```bash
   supabase login
   supabase link --project-ref <ref-del-proyecto>
   supabase db push          # aplica supabase/migrations
   supabase config push      # aplica la configuración de Auth de config.toml
   ```

   Si no se usa `config push`, en el panel de Supabase hay que dejar **Authentication → Sign In / Providers → Email**: *Confirm email* apagado y contraseña mínima de 6.

3. Variables de entorno: copiar `apps/juego/.env.example` y `apps/admin/.env.example` como `.env.local` en cada app y completarlas. La clave de servicio (`SUPABASE_SERVICE_ROLE_KEY`) va **sólo** en el panel.

4. Correr en local:

   ```bash
   npm run dev:juego   # http://localhost:3000
   npm run dev:admin   # http://localhost:3001
   ```

## Primer administrador

Las cuentas se crean desde la app del juego. Para dar el rol de administración a la primera persona, en el editor SQL de Supabase:

```sql
insert into public.admin_emails (email) values ('<email>');
update public.profiles set role = 'admin' where email = '<email>';
```

Después, desde el panel (**Configuración → Emails de administración** y **Personas → Rol**) se gestionan los demás.

## Configuración del juego (panel → Configuración)

- **Encuentros abiertos:** apagado, nadie puede empezar un encuentro.
- **Duración del encuentro:** 5 minutos por defecto.
- **Dominio del email:** vacío acepta cualquier email; con un dominio, sólo ese.

## Despliegue en Vercel

Dos proyectos de Vercel sobre este mismo repositorio:

| Proyecto | Root Directory | Variables |
|---|---|---|
| juego | `apps/juego` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| admin | `apps/admin` | las dos anteriores y `SUPABASE_SERVICE_ROLE_KEY` |

La cámara (foto y escaneo de QR) necesita HTTPS: funciona en Vercel y en `localhost`, pero no en una IP de la red local.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev:juego` / `npm run dev:admin` | Servidor de desarrollo |
| `npm run build` | Compila las dos apps |
| `npm run typecheck` | Revisa los tipos de todo el monorepo |
