-- Migrazione 05 — nuova data del matrimonio: martedì 20 luglio 2027, ore 17:00.
-- Aggiorna la data usata dalle regole (es. modifiche fino a 10 giorni prima)
-- e la frase nel messaggio WhatsApp, lasciando intatto il resto del testo se l'avete personalizzato.

update public.matrimoni
set config = config
  || jsonb_build_object('data_evento', '2027-07-20T17:00:00+02:00')
  || case when config ? 'messaggio_invito' then jsonb_build_object(
       'messaggio_invito',
       replace(config->>'messaggio_invito', 'sabato 3 luglio 2027', 'martedì 20 luglio 2027')
     ) else '{}'::jsonb end
where slug = 'antonio-e-rosa';

select config->>'data_evento' as data_evento, config->>'messaggio_invito' as messaggio
from public.matrimoni where slug = 'antonio-e-rosa';
