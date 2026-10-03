-- Migrazione 02 — da eseguire UNA volta su un database creato con la prima versione di schema.sql.
-- (Su un progetto nuovo basta schema.sql, che contiene già tutto.)
--
-- Cosa cambia:
--   * i posti sono scenografici: più prenotazioni possono avere la stessa sedia
--   * ogni prenotazione riceve un codice casuale (es. AR-7KQ2MX) generato dal database
--   * con il codice l'invitato ritrova la sua prenotazione: funzione cerca_prenotazione

-- 1. posti_occupati: non più un posto = una prenotazione
alter table public.posti_occupati drop constraint if exists posti_occupati_pkey;
alter table public.posti_occupati add column if not exists creata_il timestamptz not null default now();
alter table public.posti_occupati add primary key (posto, prenotazione_id);

-- 2. codice unico per prenotazione
alter table public.prenotazioni drop constraint if exists prenotazioni_codice_key;
alter table public.prenotazioni add constraint prenotazioni_codice_key unique (codice);

-- 3. nuove funzioni (stesse di schema.sql)
drop function if exists public.prenota(text, text, text, text[], text[], int, text);

create or replace function public.genera_codice() returns text
language plpgsql
as $$
declare
  alfabeto text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  c text;
begin
  loop
    c := 'AR-';
    for i in 1..6 loop
      c := c || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    end loop;
    exit when not exists (select 1 from public.prenotazioni where codice = c);
  end loop;
  return c;
end;
$$;

create or replace function public.prenota(
  p_nome text,
  p_contatto text,
  p_note text,
  p_posti text[],
  p_supplementi text[],
  p_totale int
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id     uuid;
  v_codice text;
  v_n      int := coalesce(array_length(p_posti, 1), 0);
begin
  if v_n = 0 or v_n > 12 then
    raise exception 'numero_posti_non_valido';
  end if;
  if (select count(distinct x) from unnest(p_posti) x) <> v_n then
    raise exception 'posti_duplicati';
  end if;
  if exists (
    select 1 from unnest(p_posti) s
    where s !~ '^(S|A[1-3]|B[1-5]|C[1-4])-[1-8]$' or s in ('S-1', 'S-8')
  ) then
    raise exception 'posto_non_valido';
  end if;

  v_codice := genera_codice();

  insert into prenotazioni (nome, contatto, note, persone, posti, supplementi, totale, codice)
  values (trim(p_nome), nullif(trim(p_contatto), ''), nullif(trim(p_note), ''), v_n, p_posti,
          coalesce(p_supplementi, '{}'), greatest(coalesce(p_totale, 0), 0), v_codice)
  returning id into v_id;

  insert into posti_occupati (posto, prenotazione_id, nome)
  select unnest(p_posti), v_id, trim(p_nome);

  return json_build_object('id', v_id, 'codice', v_codice);
end;
$$;

create or replace function public.cerca_prenotazione(p_codice text) returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'id', id, 'codice', codice, 'nome', nome, 'contatto', coalesce(contatto, ''),
    'note', coalesce(note, ''), 'posti', posti, 'supplementi', supplementi,
    'totale', totale, 'creataIl', creata_il
  )
  from prenotazioni
  where codice = upper(regexp_replace(p_codice, '\s', '', 'g'))
  limit 1;
$$;

revoke all on function public.genera_codice() from public, anon, authenticated;
revoke all on function public.prenota(text, text, text, text[], text[], int) from public;
grant execute on function public.prenota(text, text, text, text[], text[], int) to anon, authenticated;
revoke all on function public.cerca_prenotazione(text) from public;
grant execute on function public.cerca_prenotazione(text) to anon, authenticated;

-- 4. riepilogo con il codice
drop view if exists public.riepilogo;
create or replace view public.riepilogo
with (security_invoker = true) as
select
  creata_il::date               as data,
  codice,
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
