-- Database delle conferme per l'invito.
-- Da incollare in Supabase → SQL Editor → New query → Run.

-- 1. Una riga per ogni conferma (famiglia o persona)
create table if not exists public.prenotazioni (
  id          uuid primary key default gen_random_uuid(),
  creata_il   timestamptz not null default now(),
  nome        text not null check (char_length(trim(nome)) between 1 and 120),
  contatto    text check (contatto is null or char_length(contatto) <= 120),
  note        text check (note is null or char_length(note) <= 600),
  persone     int  not null,
  posti       text[] not null,
  supplementi text[] not null default '{}',
  totale      int  not null default 0,
  codice      text not null
);

-- 2. Un posto può appartenere a una sola prenotazione (la chiave primaria lo garantisce)
create table if not exists public.posti_occupati (
  posto           text primary key,
  prenotazione_id uuid not null references public.prenotazioni(id) on delete cascade,
  nome            text not null
);

-- 3. Sicurezza: nessuno può leggere o scrivere le prenotazioni dal sito.
--    Il sito può solo leggere quali posti sono presi (e da chi) e prenotare tramite la funzione qui sotto.
alter table public.prenotazioni   enable row level security;
alter table public.posti_occupati enable row level security;

drop policy if exists "posti visibili a tutti" on public.posti_occupati;
create policy "posti visibili a tutti" on public.posti_occupati for select using (true);

-- 4. Prenotazione atomica: o si salvano tutti i posti, o nessuno.
create or replace function public.prenota(
  p_nome text,
  p_contatto text,
  p_note text,
  p_posti text[],
  p_supplementi text[],
  p_totale int,
  p_codice text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid;
  v_presi text[];
  v_n     int := coalesce(array_length(p_posti, 1), 0);
begin
  if v_n = 0 or v_n > 12 then
    raise exception 'numero_posti_non_valido';
  end if;
  if (select count(distinct x) from unnest(p_posti) x) <> v_n then
    raise exception 'posti_duplicati';
  end if;
  -- solo posti che esistono davvero in sala (S-1 e S-8 sono degli sposi)
  if exists (
    select 1 from unnest(p_posti) s
    where s !~ '^(S|A[1-3]|B[1-5]|C[1-4])-[1-8]$' or s in ('S-1', 'S-8')
  ) then
    raise exception 'posto_non_valido';
  end if;

  select array_agg(posto) into v_presi from posti_occupati where posto = any(p_posti);
  if v_presi is not null then
    raise exception 'posti_occupati:%', array_to_string(v_presi, ',');
  end if;

  insert into prenotazioni (nome, contatto, note, persone, posti, supplementi, totale, codice)
  values (trim(p_nome), nullif(trim(p_contatto), ''), nullif(trim(p_note), ''), v_n, p_posti,
          coalesce(p_supplementi, '{}'), greatest(coalesce(p_totale, 0), 0), left(p_codice, 60))
  returning id into v_id;

  insert into posti_occupati (posto, prenotazione_id, nome)
  select unnest(p_posti), v_id, trim(p_nome);

  return v_id;
exception
  when unique_violation then
    -- due invitati hanno confermato lo stesso posto nello stesso istante
    raise exception 'posti_occupati';
end;
$$;

revoke all on function public.prenota(text, text, text, text[], text[], int, text) from public;
grant execute on function public.prenota(text, text, text, text[], text[], int, text) to anon, authenticated;

-- 5. Aggiornamento in tempo reale dei posti liberi sul sito
do $$
begin
  alter publication supabase_realtime add table public.posti_occupati;
exception when duplicate_object then null;
end $$;

-- 6. Vista comoda per voi: chi viene, quanti sono, dove siedono
create or replace view public.riepilogo
with (security_invoker = true) as
select
  creata_il::date               as data,
  nome,
  persone,
  array_to_string(posti, ', ')  as posti,
  contatto,
  note,
  array_to_string(supplementi, ', ') as supplementi,
  totale
from public.prenotazioni
order by creata_il desc;

revoke all on public.riepilogo from anon, authenticated;

-- Per liberare i posti di una prenotazione basta cancellarla da "prenotazioni":
-- i posti in "posti_occupati" si cancellano da soli.
