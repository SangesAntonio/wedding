-- Migrazione 03 — fondamenta per l'area sposi (Fase 1 del piano).
-- Da eseguire UNA volta in Supabase → SQL Editor, dopo schema.sql (+ migrazione-02 se il database è vecchio).
-- Il sito attuale continua a funzionare: la funzione `prenota` accetta gli stessi parametri.
--
-- Cosa aggiunge:
--   matrimoni   un matrimonio con le sue impostazioni (per ora uno solo: antonio-e-rosa)
--   membri      chi amministra quale matrimonio (gli account degli sposi)
--   inviti      la lista invitati con il link personale (usata dalla Fase 2b)
--   storico     ogni creazione/modifica di una prenotazione, con chi l'ha fatta
--   prenotazioni: stato, seconda conferma (richiamo), nota degli sposi, data di modifica
--   posti_occupati: tenuti allineati da un trigger (annullata = sedie libere)
--   regole di accesso: gli sposi leggono e modificano solo il proprio matrimonio

begin;

-- ------------------------------------------------------------------ matrimoni
create table if not exists public.matrimoni (
  id        uuid primary key default gen_random_uuid(),
  slug      text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  config    jsonb not null default '{}',
  creato_il timestamptz not null default now()
);

insert into public.matrimoni (slug, config)
values ('antonio-e-rosa', jsonb_build_object(
  'data_evento', '2027-07-03T17:00:00+02:00',
  'giorni_blocco_modifiche', 10,
  'posti_sempre_liberi', 12
))
on conflict (slug) do nothing;

-- ------------------------------------------------------------------ membri (account sposi)
create table if not exists public.membri (
  matrimonio_id uuid not null references public.matrimoni(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  ruolo         text not null default 'sposi' check (ruolo in ('sposi')),
  creato_il     timestamptz not null default now(),
  primary key (matrimonio_id, user_id)
);

create or replace function public.e_sposo(m uuid) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from membri where matrimonio_id = m and user_id = auth.uid());
$$;

-- ------------------------------------------------------------------ inviti (lista invitati)
create or replace function public.genera_token() returns text
language plpgsql
as $$
declare
  alfabeto text := '23456789abcdefghjkmnpqrstuvwxyz';
  t text;
begin
  loop
    t := '';
    for i in 1..8 loop
      t := t || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    end loop;
    exit when not exists (select 1 from public.inviti where token = t);
  end loop;
  return t;
end;
$$;

create table if not exists public.inviti (
  id               uuid primary key default gen_random_uuid(),
  matrimonio_id    uuid not null references public.matrimoni(id) on delete cascade,
  token            text not null unique default public.genera_token(),
  nome             text not null check (char_length(trim(nome)) between 1 and 120),
  telefono         text check (telefono is null or char_length(telefono) <= 30),
  email            text check (email is null or char_length(email) <= 120),
  persone_previste int  check (persone_previste is null or persone_previste between 1 and 30),
  nota_sposi       text check (nota_sposi is null or char_length(nota_sposi) <= 600),
  inviato_il       timestamptz,
  aperto_il        timestamptz,
  revocato         boolean not null default false,
  creato_il        timestamptz not null default now()
);
create index if not exists inviti_matrimonio on public.inviti (matrimonio_id);

-- ------------------------------------------------------------------ prenotazioni: nuove colonne
alter table public.prenotazioni
  add column if not exists matrimonio_id uuid references public.matrimoni(id) on delete cascade,
  add column if not exists invito_id     uuid references public.inviti(id) on delete set null,
  add column if not exists stato         text not null default 'confermata',
  add column if not exists richiamo      text not null default 'da_sentire',
  add column if not exists richiamo_il   timestamptz,
  add column if not exists nota_sposi    text,
  add column if not exists modificata_il timestamptz;

update public.prenotazioni
set matrimonio_id = (select id from public.matrimoni where slug = 'antonio-e-rosa')
where matrimonio_id is null;

alter table public.prenotazioni alter column matrimonio_id set not null;

alter table public.prenotazioni drop constraint if exists prenotazioni_stato_check;
alter table public.prenotazioni add constraint prenotazioni_stato_check
  check (stato in ('confermata', 'da_verificare', 'annullata'));
alter table public.prenotazioni drop constraint if exists prenotazioni_richiamo_check;
alter table public.prenotazioni add constraint prenotazioni_richiamo_check
  check (richiamo in ('da_sentire', 'confermato', 'non_viene', 'non_risponde'));
alter table public.prenotazioni drop constraint if exists prenotazioni_nota_sposi_check;
alter table public.prenotazioni add constraint prenotazioni_nota_sposi_check
  check (nota_sposi is null or char_length(nota_sposi) <= 600);

-- gli sposi possono inserire prenotazioni a mano: il codice si genera da solo.
-- security definer: il controllo dei doppioni deve vedere tutti i codici, non solo quelli permessi dalle regole
alter function public.genera_codice() security definer set search_path = public;
alter function public.genera_token() security definer set search_path = public;
grant execute on function public.genera_codice() to authenticated;
alter table public.prenotazioni alter column codice set default public.genera_codice();

create index if not exists prenotazioni_matrimonio on public.prenotazioni (matrimonio_id);

-- ------------------------------------------------------------------ posti_occupati allineati da trigger
alter table public.posti_occupati
  add column if not exists matrimonio_id uuid references public.matrimoni(id) on delete cascade;

update public.posti_occupati po
set matrimonio_id = p.matrimonio_id
from public.prenotazioni p
where p.id = po.prenotazione_id and po.matrimonio_id is null;

create or replace function public.sincronizza_posti() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from posti_occupati where prenotazione_id = new.id;
  if new.stato <> 'annullata' then
    -- creata_il della prenotazione: l'ordine "chi ha scelto prima" non cambia con le modifiche
    insert into posti_occupati (posto, prenotazione_id, matrimonio_id, nome, creata_il)
    select distinct unnest(new.posti), new.id, new.matrimonio_id, new.nome, new.creata_il;
  end if;
  return new;
end;
$$;

drop trigger if exists prenotazioni_posti on public.prenotazioni;
create trigger prenotazioni_posti
  after insert or update of posti, stato, nome on public.prenotazioni
  for each row execute function public.sincronizza_posti();

-- ------------------------------------------------------------------ storico e data di modifica
create table if not exists public.storico (
  id              bigint generated always as identity primary key,
  prenotazione_id uuid not null references public.prenotazioni(id) on delete cascade,
  matrimonio_id   uuid not null references public.matrimoni(id) on delete cascade,
  chi             text not null check (chi in ('invitato', 'sposi')),
  utente          uuid,
  azione          text not null,
  prima           jsonb,
  dopo            jsonb,
  quando          timestamptz not null default now()
);
create index if not exists storico_prenotazione on public.storico (prenotazione_id, quando desc);

create or replace function public.segna_modifica() returns trigger
language plpgsql
as $$
begin
  if new.richiamo is distinct from old.richiamo then
    new.richiamo_il := now();
  end if;
  new.modificata_il := now();
  return new;
end;
$$;

drop trigger if exists prenotazioni_modificata on public.prenotazioni;
create trigger prenotazioni_modificata
  before update on public.prenotazioni
  for each row execute function public.segna_modifica();

create or replace function public.registra_storico() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chi    text := case when auth.uid() is null then 'invitato' else 'sposi' end;
  v_azione text;
begin
  if tg_op = 'INSERT' then
    insert into storico (prenotazione_id, matrimonio_id, chi, utente, azione, dopo)
    values (new.id, new.matrimonio_id, v_chi, auth.uid(), 'creata', to_jsonb(new));
    return new;
  end if;

  if (to_jsonb(old) - 'modificata_il' - 'richiamo_il') = (to_jsonb(new) - 'modificata_il' - 'richiamo_il') then
    return new;
  end if;
  v_azione := case
    when new.stato is distinct from old.stato then new.stato
    when new.richiamo is distinct from old.richiamo then 'richiamo:' || new.richiamo
    else 'modificata'
  end;
  insert into storico (prenotazione_id, matrimonio_id, chi, utente, azione, prima, dopo)
  values (new.id, new.matrimonio_id, v_chi, auth.uid(), v_azione, to_jsonb(old), to_jsonb(new));
  return new;
end;
$$;

drop trigger if exists prenotazioni_storico on public.prenotazioni;
create trigger prenotazioni_storico
  after insert or update on public.prenotazioni
  for each row execute function public.registra_storico();

-- ------------------------------------------------------------------ funzioni per l'invito (stessi parametri di prima)
drop function if exists public.prenota(text, text, text, text[], text[], int);

create or replace function public.prenota(
  p_nome text,
  p_contatto text,
  p_note text,
  p_posti text[],
  p_supplementi text[],
  p_totale int,
  p_matrimonio text default 'antonio-e-rosa'
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id     uuid;
  v_codice text;
  v_m      uuid;
  v_n      int := coalesce(array_length(p_posti, 1), 0);
begin
  select id into v_m from matrimoni where slug = p_matrimonio;
  if v_m is null then
    raise exception 'matrimonio_sconosciuto';
  end if;
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

  -- le sedie in posti_occupati le scrive il trigger
  insert into prenotazioni (matrimonio_id, nome, contatto, note, persone, posti, supplementi, totale, codice)
  values (v_m, trim(p_nome), nullif(trim(p_contatto), ''), nullif(trim(p_note), ''), v_n, p_posti,
          coalesce(p_supplementi, '{}'), greatest(coalesce(p_totale, 0), 0), v_codice)
  returning id into v_id;

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
    'totale', totale, 'creataIl', creata_il, 'stato', stato
  )
  from prenotazioni
  where codice = upper(regexp_replace(p_codice, '\s', '', 'g'))
  limit 1;
$$;

revoke all on function public.prenota(text, text, text, text[], text[], int, text) from public;
grant execute on function public.prenota(text, text, text, text[], text[], int, text) to anon, authenticated;
revoke all on function public.genera_token() from public, anon;
grant execute on function public.genera_token() to authenticated;
revoke all on function public.e_sposo(uuid) from public, anon;
grant execute on function public.e_sposo(uuid) to authenticated;
revoke all on function public.sincronizza_posti() from public, anon, authenticated;
revoke all on function public.registra_storico() from public, anon, authenticated;

-- ------------------------------------------------------------------ regole di accesso (RLS)
alter table public.matrimoni enable row level security;
alter table public.membri    enable row level security;
alter table public.inviti    enable row level security;
alter table public.storico   enable row level security;
-- prenotazioni e posti_occupati hanno già RLS attivo

drop policy if exists "sposi leggono il proprio matrimonio" on public.matrimoni;
create policy "sposi leggono il proprio matrimonio" on public.matrimoni
  for select to authenticated using (public.e_sposo(id));
drop policy if exists "sposi modificano il proprio matrimonio" on public.matrimoni;
create policy "sposi modificano il proprio matrimonio" on public.matrimoni
  for update to authenticated using (public.e_sposo(id)) with check (public.e_sposo(id));

drop policy if exists "ognuno vede le proprie appartenenze" on public.membri;
create policy "ognuno vede le proprie appartenenze" on public.membri
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "sposi gestiscono gli inviti" on public.inviti;
create policy "sposi gestiscono gli inviti" on public.inviti
  for all to authenticated
  using (public.e_sposo(matrimonio_id)) with check (public.e_sposo(matrimonio_id));

drop policy if exists "sposi gestiscono le prenotazioni" on public.prenotazioni;
create policy "sposi gestiscono le prenotazioni" on public.prenotazioni
  for all to authenticated
  using (public.e_sposo(matrimonio_id)) with check (public.e_sposo(matrimonio_id));

drop policy if exists "sposi leggono lo storico" on public.storico;
create policy "sposi leggono lo storico" on public.storico
  for select to authenticated using (public.e_sposo(matrimonio_id));

-- ------------------------------------------------------------------ vista riepilogo (dashboard Supabase)
drop view if exists public.riepilogo;
create view public.riepilogo
with (security_invoker = true) as
select
  creata_il::date               as data,
  codice,
  nome,
  persone,
  stato,
  richiamo,
  array_to_string(posti, ', ')  as posti,
  contatto,
  note,
  nota_sposi,
  array_to_string(supplementi, ', ') as supplementi,
  totale
from public.prenotazioni
order by creata_il desc;
revoke all on public.riepilogo from anon, authenticated;

commit;
