# Invito Antonio & Rosa

Web app dell'invito: busta con sigillo che si apre, sala 3D in cui scegliere i posti (o elenco),
nome e note, biglietto finale con conferma salvata online, mappa con globo e percorso fino al luogo.

Stack: **Vite + React + TypeScript**, **three.js** per la sala, **MapLibre** per la mappa,
**Supabase** per salvare le conferme, **Resend** per l'email di notifica. È tutto gratuito per i numeri di un matrimonio.

## Provarla sul computer

```bash
npm install
npm run dev
```

Si apre su http://localhost:5173. Per provarla dal telefono sulla stessa rete Wi-Fi usate l'indirizzo
"Network" che Vite stampa nel terminale.

Senza Supabase configurato gira in **modalità demo**: alcuni posti risultano già presi da parenti
immaginari e le conferme restano solo nel browser.

## Cosa cambiare

Tutto in [src/config.ts](src/config.ts): nomi, data, **luogo (nome, indirizzo, coordinate)**, IBAN.
Settori, prezzi, tavoli e supplementi in [src/data/sala.ts](src/data/sala.ts).
Quando l'IBAN è quello vero mettete `IBAN_DI_ESEMPIO = false`.

## Salvare le conferme (Supabase) — 10 minuti

1. Create un account su https://supabase.com e un nuovo progetto (regione: Frankfurt/EU).
2. **SQL Editor → New query**: incollate tutto [supabase/schema.sql](supabase/schema.sql) e premete **Run**.
3. **Project Settings → API**: copiate *Project URL* e la chiave *anon public*.
4. Copiate `.env.example` in `.env` e incollate i due valori. Riavviate `npm run dev`.

Da quel momento:
- ogni conferma finisce nella tabella `prenotazioni` (Table Editor) e la vista `riepilogo` mostra chi viene e dove siede;
- un posto non può essere preso due volte, nemmeno se due invitati confermano nello stesso secondo;
- i posti liberi si aggiornano in tempo reale su tutti i telefoni aperti;
- per liberare dei posti cancellate la riga in `prenotazioni`.

La chiave *anon* è fatta per stare nel sito: con le regole dello schema, dal sito si può solo leggere
quali posti sono occupati (con il nome scelto da chi li ha presi) e creare una prenotazione. Contatti e note
li vedete solo voi dalla dashboard.

## Ricevere un'email a ogni conferma

1. Account su https://resend.com → **API Keys** → create una chiave.
   Senza dominio vostro il mittente è `onboarding@resend.dev` e si può scrivere **solo all'email dell'account Resend**: per voi va benissimo.
2. Installate la CLI di Supabase e pubblicate la funzione:
   ```bash
   npx supabase login
   npx supabase link --project-ref IL_VOSTRO_PROJECT_REF
   npx supabase functions deploy notifica-prenotazione --no-verify-jwt
   npx supabase secrets set RESEND_API_KEY=re_xxx EMAIL_SPOSI=voi@esempio.it WEBHOOK_SECRET=una-parola-segreta
   ```
3. Supabase → **Database → Webhooks → Create a new hook**:
   tabella `prenotazioni`, evento **Insert**, tipo **Supabase Edge Functions**, funzione `notifica-prenotazione`,
   e negli *HTTP Headers* aggiungete `x-webhook-secret` = la stessa parola segreta.

## Pubblicare online (GitHub Pages)

Il workflow [.github/workflows/deploy.yml](.github/workflows/deploy.yml) compila e pubblica a ogni push su `main`.

1. Su GitHub: **Settings → Pages → Source: GitHub Actions**.
2. **Settings → Secrets and variables → Actions → Variables**: aggiungete `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
3. Fate push. Il sito sarà su `https://TUONOME.github.io/NOME-REPO/`.

Vanno bene anche Netlify o Vercel: comando di build `npm run build`, cartella `dist`, stesse due variabili.

## Mappa "Come arrivare"

Usa servizi gratuiti senza chiave: OpenFreeMap (mappa e globo), Photon (ricerca indirizzi), OSRM (percorso in auto).
Gli invitati possono scrivere da dove partono o usare la posizione del telefono; i pulsanti aprono
Google Maps, Apple Mappe o Waze con la destinazione già impostata. La posizione richiede HTTPS (GitHub Pages lo è).

## Prima di mandare il link

- Un'immagine di anteprima per WhatsApp: salvate `public/anteprima.jpg` (1200×630) e aggiungete in `index.html`
  `<meta property="og:image" content="https://TUONOME.github.io/NOME-REPO/anteprima.jpg">`.
- Una prova completa dal telefono: busta → posti → nome → conferma → email ricevuta.
