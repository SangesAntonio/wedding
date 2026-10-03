-- Migrazione 06 — il nome di ogni ospite. Da eseguire UNA volta dopo la 05.
--
--   prenotazioni.ospiti   [{ "nome": "Mario Esposito", "bambino": false }, …] — uno per posto, nello stesso ordine
--   prenota(…, p_ospiti)  l'invito manda i nomi; devono essere tanti quanti i posti
--   cerca_prenotazione / apri_invito restituiscono anche gli ospiti
-- Le prenotazioni già fatte restano valide con l'elenco vuoto (gli sposi possono completarlo).

begin;

alter table public.prenotazioni add column if not exists ospiti jsonb not null default '[]';
alter table public.prenotazioni drop constraint if exists prenotazioni_ospiti_check;
alter table public.prenotazioni add constraint prenotazioni_ospiti_check
  check (jsonb_typeof(ospiti) = 'array' and jsonb_array_length(ospiti) <= 30);

-- normalizza e controlla un elenco di ospiti: nomi non vuoti (max 80), bambino vero/falso
create or replace function public.pulisci_ospiti(p jsonb, p_quanti int) returns jsonb
language plpgsql
immutable
as $$
declare
  v_out jsonb := '[]';
  v_el  jsonb;
  v_nome text;
begin
  if p is null then
    return '[]';
  end if;
  if jsonb_typeof(p) <> 'array' then
    raise exception 'ospiti_non_validi';
  end if;
  if p_quanti is not null and jsonb_array_length(p) <> p_quanti then
    raise exception 'ospiti_numero_diverso';
  end if;
  for v_el in select * from jsonb_array_elements(p) loop
    v_nome := trim(coalesce(v_el->>'nome', ''));
    if v_nome = '' or char_length(v_nome) > 80 then
      raise exception 'ospite_senza_nome';
    end if;
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'nome', v_nome,
      'bambino', coalesce((v_el->>'bambino')::boolean, false)
    ));
  end loop;
  return v_out;
end;
$$;

drop function if exists public.prenota(text, text, text, text[], text[], int, text, text);

create or replace function public.prenota(
  p_nome text,
  p_contatto text,
  p_note text,
  p_posti text[],
  p_supplementi text[],
  p_totale int,
  p_matrimonio text default 'antonio-e-rosa',
  p_invito text default null,
  p_ospiti jsonb default null
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id     uuid;
  v_codice text;
  v_m      uuid;
  v_invito uuid;
  v_stato  text;
  v_ospiti jsonb;
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
  v_ospiti := pulisci_ospiti(p_ospiti, v_n);

  if nullif(trim(p_invito), '') is not null then
    select id into v_invito from inviti
    where token = lower(trim(p_invito)) and matrimonio_id = v_m and not revocato;
  end if;
  if v_invito is not null and exists (
    select 1 from prenotazioni where invito_id = v_invito and stato <> 'annullata'
  ) then
    raise exception 'invito_gia_confermato';
  end if;
  v_stato := case when v_invito is null then 'da_verificare' else 'confermata' end;

  v_codice := genera_codice();

  insert into prenotazioni (matrimonio_id, invito_id, stato, nome, contatto, note, persone, posti, ospiti, supplementi, totale, codice)
  values (v_m, v_invito, v_stato, trim(p_nome), nullif(trim(p_contatto), ''), nullif(trim(p_note), ''), v_n, p_posti,
          v_ospiti, coalesce(p_supplementi, '{}'), greatest(coalesce(p_totale, 0), 0), v_codice)
  returning id into v_id;

  return json_build_object('id', v_id, 'codice', v_codice, 'stato', v_stato);
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
    'note', coalesce(note, ''), 'posti', posti, 'ospiti', ospiti, 'supplementi', supplementi,
    'totale', totale, 'creataIl', creata_il, 'stato', stato
  )
  from prenotazioni
  where codice = upper(regexp_replace(p_codice, '\s', '', 'g'))
  limit 1;
$$;

create or replace function public.apri_invito(p_token text) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v   inviti;
  v_p prenotazioni;
begin
  select * into v from inviti where token = lower(trim(p_token));
  if not found then
    return null;
  end if;
  if v.revocato then
    return json_build_object('revocato', true);
  end if;
  if v.aperto_il is null then
    update inviti set aperto_il = now() where id = v.id;
  end if;

  select * into v_p from prenotazioni
  where invito_id = v.id and stato <> 'annullata'
  order by creata_il desc
  limit 1;

  return json_build_object(
    'nome', v.nome,
    'persone_previste', v.persone_previste,
    'prenotazione', case when v_p.id is null then null else json_build_object(
      'id', v_p.id, 'codice', v_p.codice, 'nome', v_p.nome, 'contatto', coalesce(v_p.contatto, ''),
      'note', coalesce(v_p.note, ''), 'posti', v_p.posti, 'ospiti', v_p.ospiti, 'supplementi', v_p.supplementi,
      'totale', v_p.totale, 'creataIl', v_p.creata_il, 'stato', v_p.stato
    ) end
  );
end;
$$;

revoke all on function public.prenota(text, text, text, text[], text[], int, text, text, jsonb) from public;
grant execute on function public.prenota(text, text, text, text[], text[], int, text, text, jsonb) to anon, authenticated;
grant execute on function public.pulisci_ospiti(jsonb, int) to anon, authenticated;

-- gli sposi che modificano a mano: stessi controlli sui nomi (l'elenco può restare vuoto o essere completo)
create or replace function public.controlla_ospiti() returns trigger
language plpgsql
as $$
begin
  if jsonb_array_length(new.ospiti) > 0 then
    new.ospiti := pulisci_ospiti(new.ospiti, null);
    if jsonb_array_length(new.ospiti) <> coalesce(array_length(new.posti, 1), 0) then
      raise exception 'ospiti_numero_diverso';
    end if;
  end if;
  new.persone := coalesce(array_length(new.posti, 1), 0);
  return new;
end;
$$;

drop trigger if exists prenotazioni_ospiti on public.prenotazioni;
create trigger prenotazioni_ospiti
  before insert or update of ospiti, posti on public.prenotazioni
  for each row execute function public.controlla_ospiti();

-- vista riepilogo con i nomi
drop view if exists public.riepilogo;
create view public.riepilogo
with (security_invoker = true) as
select
  creata_il::date               as data,
  codice,
  nome,
  persone,
  (select string_agg(o->>'nome', ', ') from jsonb_array_elements(ospiti) o) as ospiti,
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
