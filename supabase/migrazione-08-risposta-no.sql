-- Migrazione 08 — "Purtroppo non possiamo venire" direttamente dal link personale.
-- Chi declina lascia una prenotazione già annullata, senza posti: gli sposi la vedono tra
-- "Non vengono" e, se l'invitato ci ripensa, la stessa prenotazione torna confermata.
-- Da eseguire UNA volta dopo la 07.

begin;

create or replace function public.declina_invito(
  p_token text,
  p_nota text default null,
  p_matrimonio text default 'antonio-e-rosa'
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_m   uuid;
  v_inv inviti;
  v_p   prenotazioni;
begin
  select id into v_m from matrimoni where slug = p_matrimonio;
  if v_m is null then
    raise exception 'matrimonio_sconosciuto';
  end if;
  select * into v_inv from inviti
  where token = lower(trim(p_token)) and matrimonio_id = v_m and not revocato;
  if not found then
    raise exception 'invito_sconosciuto';
  end if;

  select * into v_p from prenotazioni
  where invito_id = v_inv.id
  order by (stato <> 'annullata') desc, creata_il desc
  limit 1;

  if found and v_p.stato <> 'annullata' then
    raise exception 'invito_gia_confermato';
  end if;

  if found then
    -- aveva già detto di no: aggiorniamo solo il messaggio
    update prenotazioni set note = coalesce(nullif(trim(p_nota), ''), note) where id = v_p.id;
    return json_build_object('id', v_p.id, 'codice', v_p.codice);
  end if;

  insert into prenotazioni (matrimonio_id, invito_id, stato, nome, note, persone, posti, ospiti, supplementi, totale, codice, modificata_da)
  values (v_m, v_inv.id, 'annullata', v_inv.nome, nullif(left(trim(p_nota), 600), ''), 0, '{}', '[]'::jsonb, '{}', 0, genera_codice(), 'invitato')
  returning * into v_p;

  return json_build_object('id', v_p.id, 'codice', v_p.codice);
end;
$$;

-- l'invito restituisce anche la risposta "no", così chi riapre il link la ritrova
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
  where invito_id = v.id
  order by (stato <> 'annullata') desc, creata_il desc
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

revoke all on function public.declina_invito(text, text, text) from public;
grant execute on function public.declina_invito(text, text, text) to anon, authenticated;

commit;
