# Invito Antonio & Rosa — pubblicazione su GitHub Pages

Questa cartella è già un sito pronto. Non serve installare nulla né compilare:
`index.html` carica `app.js`, che contiene React, three.js e tutto il codice dell'invito.

## Pubblicare in 5 minuti (dal browser, senza terminale)

1. Vai su https://github.com/new e crea un repository **pubblico**, per esempio `invito-antonio-rosa`.
   Non spuntare "Add a README file".
2. Nella pagina del repository appena creato, clicca **uploading an existing file**.
3. Trascina dentro i tre file di questa cartella: `index.html`, `app.js` e `.nojekyll`.
   (Se il browser non ti fa trascinare `.nojekyll` perché è nascosto, puoi saltarlo: serve solo
   come precauzione perché GitHub non ignori eventuali file futuri che iniziano con underscore.)
4. Clicca **Commit changes**.
5. Vai su **Settings → Pages**. In "Build and deployment" scegli:
   - Source: **Deploy from a branch**
   - Branch: **main** e cartella **/ (root)**
   Salva.
6. Dopo 1–2 minuti il sito è online a questo indirizzo:
   `https://TUONOME.github.io/invito-antonio-rosa/`

Se la pagina resta bianca al primo tentativo, aspetta un minuto e ricarica: la prima
pubblicazione a volte è lenta.

## Da terminale, se preferisci

```bash
cd sito-invito
git init -b main
git add .
git commit -m "Invito Antonio e Rosa"
git remote add origin https://github.com/TUONOME/invito-antonio-rosa.git
git push -u origin main
```
Poi attiva Pages come al punto 5.

## Cosa controllare online

- La sala 3D su telefono: rotazione, pizzico per lo zoom, tocco su una sedia.
- Il caricamento dei caratteri (Cormorant Garamond e Inter arrivano da Google Fonts).
- Il percorso completo: invito → posti → nome → biglietti, con lo sconto famiglia.

## Se vuoi modificare qualcosa

Il file sorgente leggibile è `InvitoAntonioRosa.jsx`, fuori da questa cartella.
Dopo una modifica il bundle `app.js` va rigenerato:

```bash
npm install esbuild react react-dom three@0.128.0 lucide-react
npx esbuild main.jsx --bundle --minify --format=iife --loader:.jsx=jsx \
  --define:process.env.NODE_ENV='"production"' --outfile=app.js
```

## Nota

È ancora un mockup: le prenotazioni non vengono salvate da nessuna parte e l'IBAN è di esempio.
Chi apre la pagina vede sempre gli stessi posti liberi, e ricaricando si riparte da zero.
Per raccogliere davvero le conferme serve un salvataggio dei dati: la via più semplice è un
Google Form nascosto o un piccolo servizio tipo Supabase o Formspree.
