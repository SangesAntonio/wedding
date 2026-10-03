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
immaginari e le conferme restano solo nel browser. Con `npm run demo` si forza la modalità demo anche se
`.env` è presente, utile per provare senza scrivere nel database vero.

## Cosa cambiare

Tutto in [src/config.ts](src/config.ts): nomi, data, **luogo (nome, indirizzo, coordinate)**, IBAN.
Settori, prezzi, tavoli e supplementi in [src/data/sala.ts](src/data/sala.ts).
Quando l'IBAN è quello vero mettete `IBAN_DI_ESEMPIO = false`.

## Salvare le conferme (Supabase) — 10 minuti

1. Create un account su https://supabase.com e un nuovo progetto (regione: Frankfurt/EU).
2. **SQL Editor → New query**: incollate tutto [supabase/schema.sql](supabase/schema.sql) e premete **Run**.
   Se il database era stato creato con la prima versione, eseguite invece [supabase/migrazione-02-codice.sql](supabase/migrazione-02-codice.sql).
3. **Project Settings → API**: copiate *Project URL* e la chiave *anon public*.
4. Copiate `.env.example` in `.env` e incollate i due valori. Riavviate `npm run dev`.

Da quel momento:
- ogni conferma finisce nella tabella `prenotazioni` (Table Editor) e la vista `riepilogo` mostra chi viene e dove siede;
- ogni prenotazione riceve un **codice** casuale (es. `AR-7KQ2MX`): l'invitato lo inserisce nell'invito per
  rivedere posti, luogo, data e IBAN da qualsiasi telefono;
- i posti sono **scenografici**: più invitati possono scegliere la stessa sedia e in sala restano sempre
  almeno `POSTI_SEMPRE_LIBERI` sedie libere (in [src/config.ts](src/config.ts));
- le sedie scelte si aggiornano in tempo reale su tutti i telefoni aperti;
- per cancellare una prenotazione eliminate la riga in `prenotazioni`.

La chiave *anon* è fatta per stare nel sito: con le regole dello schema, dal sito si può solo leggere
quali posti sono occupati (con il nome scelto da chi li ha presi) e creare una prenotazione. Contatti e note
li vedete solo voi dalla dashboard; con il codice l'invitato rivede solo la propria prenotazione.

## Ricevere un'email a ogni conferma

**Via più semplice, con il vostro Gmail:** Google Apps Script. Niente Resend né password: seguite le istruzioni
in cima a [supabase/notifica-google-apps-script.js](supabase/notifica-google-apps-script.js) (5 passi, ~5 minuti).
Nei log del webhook Supabase può comparire un codice 302: è normale, l'email parte lo stesso.

**In alternativa, con Resend:**

Percorso: nuova riga in `prenotazioni` → *Database Webhook* di Supabase → Edge Function
[notifica-prenotazione](supabase/functions/notifica-prenotazione/index.ts) → Resend → la vostra casella.
Tutto dalla dashboard, senza terminale:

1. **Resend**: account su https://resend.com **con l'indirizzo che deve ricevere le notifiche**, poi **API Keys → Create API Key**.
   Senza un dominio vostro il mittente è `onboarding@resend.dev` e si può scrivere solo all'email dell'account: per voi basta.
2. **Funzione**: Supabase → **Edge Functions → Deploy a new function → Via Editor**. Nome `notifica-prenotazione`,
   incollate il contenuto di `supabase/functions/notifica-prenotazione/index.ts` e premete **Deploy**.
   Nelle impostazioni della funzione disattivate **Verify JWT** (la protegge la parola segreta del punto 3).
3. **Segreti**: **Edge Functions → Secrets**, aggiungete
   `RESEND_API_KEY` (la chiave di Resend), `EMAIL_SPOSI` (la vostra email), `WEBHOOK_SECRET` (una parola segreta inventata).
4. **Webhook**: **Database → Webhooks → Create a new hook**: tabella `prenotazioni`, evento **Insert**,
   tipo **Supabase Edge Functions**, funzione `notifica-prenotazione`; negli *HTTP Headers* aggiungete
   `x-webhook-secret` con la stessa parola segreta.

Se le email non arrivano: **Edge Functions → notifica-prenotazione → Logs**.

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
