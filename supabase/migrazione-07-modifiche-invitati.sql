-- Migrazione 07 — gli invitati modificano o annullano la propria prenotazione (Fase D),
-- e le impostazioni pubbliche del matrimonio leggibili dall'invito (base della Fase E).
-- Da eseguire UNA volta dopo la 06.

begin;

-- chi ha fatto l'ultima modifica: serve all'email (avvisa solo quando cambia qualcosa l'invitato)
alter table public.prenotazioni add column if not exists modificata_da text;
alter table public.prenotazioni drop constraint if exists prenotazioni_modificata_da_check;
alter table public.prenotazioni add constraint prenotazioni_modificata_da_check
  check (modificata_da is null or modificata_da in ('invitato', 'sposi'));

create or replace function public.segna_modifica() returns trigger
language plpgsql
as $$
begin
  if new.richiamo is distinct from old.richiamo then
    new.richiamo_il := now();
  end if;
  new.modificata_il := now();
  new.modificata_da := case when auth.uid() is null then 'invitato' else 'sposi' end;
  return new;
end;
$$;

-- fino a quando gli invitati possono modificare: data del matrimonio meno N giorni
create or replace function public.modifiche_fino(m uuid) returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select (config->>'data_evento')::timestamptz - make_interval(days => coalesce((config->>'giorni_blocco_modifiche')::int, 10))
  from matrimoni where id = m;
$$;

-- impostazioni pubbliche (sono comunque visibili nell'invito) + scadenza delle modifiche
create or replace function public.config_pubblica(p_matrimonio text default 'antonio-e-rosa') returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select config || jsonb_build_object('modifiche_fino', modifiche_fino(id))
  from matrimoni where slug = p_matrimonio;
$$;

create or replace function public.modifica_prenotazione(
  p_codice text,
  p_nome text,
  p_contatto text,
  p_note text,
  p_posti text[],
  p_ospiti jsonb,
  p_supplementi text[],
  p_totale int
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v   prenotazioni;
  v_n int := coalesce(array_length(p_posti, 1), 0);
begin
  select * into v from prenotazioni where codice = upper(regexp_replace(p_codice, '\s', '', 'g'));
  if not found then
    raise exception 'prenotazione_sconosciuta';
  end if;
  if now() > modifiche_fino(v.matrimonio_id) then
    raise exception 'modifiche_chiuse';
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

  update prenotazioni set
    nome = trim(p_nome),
    contatto = nullif(trim(p_contatto), ''),
    note = nullif(trim(p_note), ''),
    posti = p_posti,
    ospiti = pulisci_ospiti(p_ospiti, v_n),
    supplementi = coalesce(p_supplementi, '{}'),
    totale = greatest(coalesce(p_totale, 0), 0),
    -- chi aveva annullato e ci ripensa torna confermato (o da verificare, se senza invito)
    stato = case when stato = 'annullata' then (case when invito_id is null then 'da_verificare' else 'confermata' end) else stato end
  where id = v.id;

  return json_build_object('id', v.id, 'codice', v.codice);
end;
$$;

create or replace function public.annulla_prenotazione(p_codice text) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v prenotazioni;
begin
  select * into v from prenotazioni where codice = upper(regexp_replace(p_codice, '\s', '', 'g'));
  if not found then
    raise exception 'prenotazione_sconosciuta';
  end if;
  if now() > modifiche_fino(v.matrimonio_id) then
    raise exception 'modifiche_chiuse';
  end if;
  update prenotazioni set stato = 'annullata' where id = v.id and stato <> 'annullata';
  return json_build_object('id', v.id, 'stato', 'annullata');
end;
$$;

revoke all on function public.modifiche_fino(uuid) from public;
grant execute on function public.modifiche_fino(uuid) to anon, authenticated;
revoke all on function public.config_pubblica(text) from public;
grant execute on function public.config_pubblica(text) to anon, authenticated;
revoke all on function public.modifica_prenotazione(text, text, text, text, text[], jsonb, text[], int) from public;
grant execute on function public.modifica_prenotazione(text, text, text, text, text[], jsonb, text[], int) to anon, authenticated;
revoke all on function public.annulla_prenotazione(text) from public;
grant execute on function public.annulla_prenotazione(text) to anon, authenticated;

commit;
