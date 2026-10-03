// Tutti i dati "da cambiare" dell'invito stanno qui.

export const SPOSI = {
  lui: "Antonio",
  lei: "Rosa",
  cognomi: "Sanges · Martinelli",
  iniziali: "A&R",
  intestatario: "Antonio Sanges e Rosa Martinelli",
};

// Mese 0-based: 6 = luglio
export const DATA_EVENTO = new Date(2027, 6, 20, 17, 0, 0);
export const DATA_ESTESA = "Martedì 20 luglio 2027";
export const DATA_ROMANA = "20 · VII · MMXXVII";
export const DATA_BREVE = "20.07.27";
export const ORARIO = "Ore 17:00 · cerimonia, cena e balli fino a tardi";
export const DURATA_ORE = 9;

// Le coordinate servono per il segnaposto sulla mappa; i navigatori (Google Maps,
// Apple Mappe, Waze) ricevono nome e indirizzo scritti, così trovano l'ingresso giusto.
export const LUOGO = {
  nome: "Scrajo Terme Hotel & Spa",
  indirizzo: "Via Luigi Serio, 10, 80069 Vico Equense NA",
  citta: "Vico Equense",
  lat: 40.67193,
  lng: 14.43507,
};

export const IBAN = "IT60 X054 2811 1010 0000 0123 456";
export const IBAN_DI_ESEMPIO = true;

export const SCONTO_FAMIGLIA = 0.35;
export const MAX_POSTI_PER_PRENOTAZIONE = 12;

// I posti sono scenografici: in sala restano sempre almeno queste sedie libere,
// qualunque sia il numero di conferme.
export const POSTI_SEMPRE_LIBERI = 12;
