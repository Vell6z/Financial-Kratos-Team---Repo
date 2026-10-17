-- Esquema de Supabase para La Bodeguita (opción "JSON en una fila", ver src/lib/supabase.ts).
-- Ejecútalo una vez en Supabase → SQL Editor → New query → Run.

-- 1. La base completa de la app en una sola fila, con número de versión para no pisar cambios entre servidores.
create table if not exists public.app_state (
  id text primary key,
  version bigint not null default 1,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- RLS activo y SIN políticas: nadie con la llave pública (anon) puede leer ni escribir.
-- La app usa la llave de servicio desde el servidor, que salta RLS.
alter table public.app_state enable row level security;

-- 2. Bucket PRIVADO para las copias de la cédula y los documentos del estudio (5 MB por archivo).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;
