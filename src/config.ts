// Dati "da cambiare" dell'invito. Questi sono i valori predefiniti: all'avvio l'invito legge le
// impostazioni salvate dagli sposi nel database (vedi lib/configMatrimonio.ts) e le applica qui.
// Sono `let` esportati: chi li importa vede sempre il valore aggiornato.

export let SPOSI = {
  lui: "Antonio",
  lei: "Rosa",
  cognomi: "Sanges · Martinelli",
  iniziali: "A&R",
  intestatario: "Antonio Sanges e Rosa Martinelli",
};

export let DATA_EVENTO = new Date("2027-07-20T17:00:00+02:00");
export let ORARIO = "Ore 17:00 · cerimonia, cena e balli fino a tardi";
export let DURATA_ORE = 9;

// Le coordinate servono per il segnaposto sulla mappa; i navigatori (Google Maps,
// Apple Mappe, Waze) ricevono nome e indirizzo scritti, così trovano l'ingresso giusto.
export let LUOGO = {
  nome: "Scrajo Terme Hotel & Spa",
  indirizzo: "Via Luigi Serio, 10, 80069 Vico Equense NA",
  citta: "Vico Equense",
  lat: 40.67193,
  lng: 14.43507,
};

export let IBAN = "IT60 X054 2811 1010 0000 0123 456";
export let IBAN_DI_ESEMPIO = true;

export let TESTI = {
  occhiello: "Unica replica",
  claim: "Acquistate il vostro biglietto per l'evento che difficilmente ricorderete.",
  nota_pagamento: "Poi, tra noi: potete pagare quello che volete. Anche zero. Dopotutto vi vogliamo ancora bene.",
  nota_contanti:
    "Se preferite il contante, la busta si consegna all'ingresso come vuole la tradizione. Il biglietto non dà diritto a rimborso, ma dà diritto a due primi, un secondo, il dolce e almeno un ballo lento.",
};

export let SCONTO_FAMIGLIA = 0.35;
export const MAX_POSTI_PER_PRENOTAZIONE = 12;

// I posti sono scenografici: in sala restano sempre almeno queste sedie libere,
// qualunque sia il numero di conferme.
export let POSTI_SEMPRE_LIBERI = 12;

/** Fino a quando gli invitati possono modificare (null = non si sa ancora: si lascia modificare). */
export let MODIFICHE_FINO: Date | null = null;

// ------------------------------------------------------------ date derivate
const ROMANI: [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
  [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];
const romano = (n: number) => ROMANI.reduce((s, [v, r]) => { while (n >= v) { s += r; n -= v; } return s; }, "");
const maiuscola = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Martedì 20 luglio 2027" */
export const dataEstesa = () =>
  maiuscola(DATA_EVENTO.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
/** "20 · VII · MMXXVII" */
export const dataRomana = () => `${DATA_EVENTO.getDate()} · ${romano(DATA_EVENTO.getMonth() + 1)} · ${romano(DATA_EVENTO.getFullYear())}`;
/** "20.07.27" */
export const dataBreve = () =>
  `${String(DATA_EVENTO.getDate()).padStart(2, "0")}.${String(DATA_EVENTO.getMonth() + 1).padStart(2, "0")}.${String(DATA_EVENTO.getFullYear()).slice(2)}`;
/** "17:00" */
export const oraEvento = () => DATA_EVENTO.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

// ------------------------------------------------------------ aggiornamento (usato da lib/configMatrimonio.ts)
export function impostaBase(v: {
  sposi: typeof SPOSI;
  data: Date;
  orario: string;
  durata: number;
  luogo: typeof LUOGO;
  iban: string;
  ibanDiEsempio: boolean;
  testi: typeof TESTI;
  sconto: number;
  postiLiberi: number;
  modificheFino: Date | null;
}) {
  SPOSI = v.sposi;
  DATA_EVENTO = v.data;
  ORARIO = v.orario;
  DURATA_ORE = v.durata;
  LUOGO = v.luogo;
  IBAN = v.iban;
  IBAN_DI_ESEMPIO = v.ibanDiEsempio;
  TESTI = v.testi;
  SCONTO_FAMIGLIA = v.sconto;
  POSTI_SEMPRE_LIBERI = v.postiLiberi;
  MODIFICHE_FINO = v.modificheFino;
}
