-- Migrazione 04 — link personali (Fase 2b del piano). Da eseguire UNA volta dopo la 03.
--
--   apri_invito(token)  l'invito personale: nome della famiglia, persone previste, prenotazione già fatta.
--                       Segna anche la prima apertura (aperto_il).
--   prenota(…, p_invito) con un token valido la prenotazione è collegata all'invito e "confermata";
--                       senza token (link generico) entra come "da_verificare".
--   messaggio_invito    testo WhatsApp di partenza, modificabile dall'area sposi.

begin;

update public.matrimoni
set config = config || jsonb_build_object(
  'messaggio_invito',
  E'Ciao {nome}! 💍\nAntonio e Rosa si sposano sabato 3 luglio 2027.\nQui trovate il vostro invito, potete scegliere i posti e confermare: {link}'
)
where slug = 'antonio-e-rosa' and not (config ? 'messaggio_invito');

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
      'note', coalesce(v_p.note, ''), 'posti', v_p.posti, 'supplementi', v_p.supplementi,
      'totale', v_p.totale, 'creataIl', v_p.creata_il, 'stato', v_p.stato
    ) end
  );
end;
$$;

drop function if exists public.prenota(text, text, text, text[], text[], int, text);

create or replace function public.prenota(
  p_nome text,
  p_contatto text,
  p_note text,
  p_posti text[],
  p_supplementi text[],
  p_totale int,
  p_matrimonio text default 'antonio-e-rosa',
  p_invito text default null
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

  -- link personale: valido solo se esiste, non è revocato ed è di questo matrimonio
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

  insert into prenotazioni (matrimonio_id, invito_id, stato, nome, contatto, note, persone, posti, supplementi, totale, codice)
  values (v_m, v_invito, v_stato, trim(p_nome), nullif(trim(p_contatto), ''), nullif(trim(p_note), ''), v_n, p_posti,
          coalesce(p_supplementi, '{}'), greatest(coalesce(p_totale, 0), 0), v_codice)
  returning id into v_id;

  return json_build_object('id', v_id, 'codice', v_codice, 'stato', v_stato);
end;
$$;

revoke all on function public.apri_invito(text) from public;
grant execute on function public.apri_invito(text) to anon, authenticated;
revoke all on function public.prenota(text, text, text, text[], text[], int, text, text) from public;
grant execute on function public.prenota(text, text, text, text[], text[], int, text, text) to anon, authenticated;

commit;
