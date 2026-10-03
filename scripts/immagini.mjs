// Genera le immagini pubblicate a partire da materiale/foto-anteprima.jpg:
//   public/anteprima.jpg   1200×630  anteprima del link (WhatsApp, Telegram, Facebook…)
//   public/icona-180.png   180×180   icona per iPhone (Aggiungi a Home)
//   public/icona-192.png   192×192   icona per Android
//   public/icona-512.png   512×512   icona grande (installazione come app)
// Uso:  node scripts/immagini.mjs
import sharp from "sharp";

const ORIGINALE = "materiale/foto-anteprima.jpg";
const meta = await sharp(ORIGINALE).metadata();
const { width: L, height: A } = meta;

// ---- anteprima orizzontale: illustrazione intera al centro, ai lati la sua carta sfocata
const W = 1200, H = 630;
// sfondo: la striscia di carta pulita in alto, allargata a tutto il riquadro (stessa grana e colore)
const sfondo = await sharp(ORIGINALE)
  .extract({ left: 0, top: 0, width: L, height: Math.round(A * 0.13) })
  .resize(W, H, { fit: "fill" })
  .blur(0.6)
  .toBuffer();
// zona utile: dal cuore alla data (proporzioni dell'illustrazione)
const zona = { left: 0, top: Math.round(A * 0.165), width: L, height: Math.round(A * 0.745) };
const altezza = H - 24;
const centro = await sharp(ORIGINALE).extract(zona).resize({ height: altezza }).toBuffer();
const { width: lc } = await sharp(centro).metadata();
// bordi sfumati dell'illustrazione: maschera con gradiente ai lati
const sfuma = Buffer.from(
  `<svg width="${lc}" height="${altezza}"><defs><linearGradient id="g" x1="0" x2="1">
     <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".08" stop-color="#fff"/>
     <stop offset=".92" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
   <rect width="100%" height="100%" fill="url(#g)"/></svg>`,
);
const centroSfumato = await sharp(centro).composite([{ input: sfuma, blend: "dest-in" }]).png().toBuffer();
await sharp(sfondo)
  .composite([{ input: centroSfumato, left: Math.round((W - lc) / 2), top: 12 }])
  .jpeg({ quality: 84, mozjpeg: true })
  .toFile("public/anteprima.jpg");

// ---- icone: il cuore con la coppia, quadrato
const lato = Math.round(L * 0.94);
const quadrato = { left: Math.round((L - lato) / 2), top: Math.round(A * 0.17), width: lato, height: lato };
for (const s of [180, 192, 512]) {
  await sharp(ORIGINALE).extract(quadrato).resize(s, s).flatten({ background: "#F7F3E8" }).png({ palette: true, quality: 90, compressionLevel: 9 }).toFile(`public/icona-${s}.png`);
}
console.log(`ok: originale ${L}×${A}, anteprima ${W}×${H}, icone 180/192/512`);
