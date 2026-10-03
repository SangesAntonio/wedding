import { SCONTO_FAMIGLIA } from "../config";

export const COLORI = {
  avorio: "#F7F3E8",
  carta: "#FFFDF7",
  linea: "#E4DCC8",
  lineaForte: "#CFC5A9",
  inchiostro: "#2B3A31",
  soft: "#79877C",
  salvia: "#8FA58C",
  bosco: "#5E7A63",
  oro: "#B7994F",
  oroChiaro: "#E0CB92",
};

export type SettoreId = "palco" | "vicino" | "centro" | "fondo";

export interface Settore {
  nome: string;
  tag: string;
  prezzo: number;
  col: string;
  soft: string;
  /** colore delle sedie nella sala 3D */
  hex: number;
  desc: string;
}

export const SETTORI: Record<SettoreId, Settore> = {
  palco: {
    nome: "Tavolo degli sposi",
    tag: "La corte",
    prezzo: 500,
    col: "#3E9AC4",
    soft: "#E6F2F8",
    hex: 0x6fb3d2,
    desc: "Sarete in ogni fotografia della serata, che lo vogliate o no.",
  },
  vicino: {
    nome: "Prima fila",
    tag: "Le lanterne",
    prezzo: 300,
    col: "#C07226",
    soft: "#FAEEDF",
    hex: 0xc97b33,
    desc: "Ogni discorso commovente arriva forte e chiaro. Fazzoletto incluso.",
  },
  centro: {
    nome: "Centro sala",
    tag: "La radura",
    prezzo: 200,
    col: "#4F7549",
    soft: "#E9F1E8",
    hex: 0x5c8055,
    desc: "Vedete tutto, mangiate caldo e nessuno vi chiede un discorso.",
  },
  fondo: {
    nome: "Fondo sala",
    tag: "Acque profonde",
    prezzo: 140,
    col: "#2E4272",
    soft: "#E8EBF3",
    hex: 0x2e4272,
    desc: "Vicino ai bagni e all'uscita. Il tiramisù arriva quattro minuti dopo.",
  },
};

export const ORDINE_SETTORI: SettoreId[] = ["palco", "vicino", "centro", "fondo"];

export interface Tavolo {
  cod: string;
  set: SettoreId;
  x: number;
  z: number;
  r: number;
  sposi?: boolean;
}

export const TAVOLI: Tavolo[] = [
  { cod: "S", set: "palco", x: 0, z: -8, r: 1.45, sposi: true },
  { cod: "A1", set: "vicino", x: -6, z: -3.4, r: 1.05 },
  { cod: "A2", set: "vicino", x: 0, z: -3.4, r: 1.05 },
  { cod: "A3", set: "vicino", x: 6, z: -3.4, r: 1.05 },
  { cod: "B1", set: "centro", x: -6, z: 0.8, r: 1.05 },
  { cod: "B2", set: "centro", x: 0, z: 0.8, r: 1.05 },
  { cod: "B3", set: "centro", x: 6, z: 0.8, r: 1.05 },
  { cod: "B4", set: "centro", x: -3, z: 4.7, r: 1.05 },
  { cod: "B5", set: "centro", x: 3, z: 4.7, r: 1.05 },
  { cod: "C1", set: "fondo", x: -7.5, z: 8.9, r: 1.05 },
  { cod: "C2", set: "fondo", x: -2.5, z: 8.9, r: 1.05 },
  { cod: "C3", set: "fondo", x: 2.5, z: 8.9, r: 1.05 },
  { cod: "C4", set: "fondo", x: 7.5, z: 8.9, r: 1.05 },
];

export const SEDIE_PER_TAVOLO = 8;

/** Nomi scherzosi usati solo in modalità demo per riempire qualche sedia. */
const OCCUPANTI_FINTI = [
  "Zia Concetta",
  "Cugino Mimmo",
  "Nonna Rosaria",
  "Compare Ciro",
  "Zio Peppe",
  "I colleghi di Antonio",
  "Le amiche di Rosa",
  "Il testimone",
  "Famiglia Esposito",
  "Il fotografo (mangia)",
  "Cugina Assunta",
  "Il vicino di casa",
  "Amici del liceo",
  "Zia Filomena",
  "Il socio di papà",
  "Comare Anna",
];

export interface Supplemento {
  id: string;
  n: string;
  d: string;
  p: number;
}

export const SUPPLEMENTI: Supplemento[] = [
  { id: "papa", n: "Una foto con il papà della sposa", d: "Lui poserà serissimo. È il suo momento.", p: 50 },
  { id: "bis", n: "Bis di primi assicurato", d: "Il cameriere passa una seconda volta.", p: 20 },
  { id: "dj", n: "Una canzone a scelta dal DJ", d: "Una sola. Non insistete alla terza.", p: 30 },
  { id: "bouquet", n: "Esonero dal lancio del bouquet", d: "Nessuno vi spinge in mezzo alla pista.", p: 15 },
  { id: "foto", n: "Nessuna foto di gruppo", d: "Restate seduti mentre gli altri posano.", p: 25 },
];

export interface Posto {
  id: string;
  tav: string;
  num: number;
  set: SettoreId;
  sposo: boolean;
  ang: number;
  x: number;
  z: number;
  iniziale: string | null;
}

/** Chi occupa un posto: id posto → nome */
export type Occupati = Map<string, string>;

export const hash = (s: string) => {
  let e = 7;
  for (let t = 0; t < s.length; t++) e = (e * 31 + s.charCodeAt(t)) % 9973;
  return e;
};

export function generaPosti(): Posto[] {
  const posti: Posto[] = [];
  TAVOLI.forEach((t) => {
    for (let a = 0; a < SEDIE_PER_TAVOLO; a++) {
      const ang = ((Math.PI * 2) / SEDIE_PER_TAVOLO) * a + Math.PI / 2;
      const raggio = t.r + 0.72;
      const sposo = !!t.sposi && (a === 0 || a === 7);
      posti.push({
        id: `${t.cod}-${a + 1}`,
        tav: t.cod,
        num: a + 1,
        set: t.set,
        sposo,
        ang,
        x: t.x + Math.cos(ang) * raggio,
        z: t.z + Math.sin(ang) * raggio,
        iniziale: sposo ? (a === 0 ? "A" : "R") : null,
      });
    }
  });
  return posti;
}

export const POSTI = generaPosti();
export const POSTI_PER_ID = new Map(POSTI.map((p) => [p.id, p]));
export const POSTI_PRENOTABILI = POSTI.filter((p) => !p.sposo).length;

export function occupatiDemo(): Occupati {
  const m: Occupati = new Map();
  let k = 0;
  POSTI.forEach((p) => {
    if (!p.sposo && hash(p.id) % 100 < 22) m.set(p.id, OCCUPANTI_FINTI[k++ % OCCUPANTI_FINTI.length]);
  });
  return m;
}

export interface PostoPrezzato extends Posto {
  pieno: number;
  scontato: number;
  sconto: boolean;
}

/** Il posto più caro a prezzo pieno, gli altri con lo sconto famiglia. */
export function prezza(sel: Posto[]): PostoPrezzato[] {
  return [...sel]
    .sort((a, b) => SETTORI[b.set].prezzo - SETTORI[a.set].prezzo)
    .map((p, i) => {
      const pieno = SETTORI[p.set].prezzo;
      return {
        ...p,
        pieno,
        scontato: i === 0 ? pieno : Math.round(pieno * (1 - SCONTO_FAMIGLIA)),
        sconto: i > 0,
      };
    });
}

/** Cerca il tavolo migliore con `quanti` posti liberi, possibilmente vicini. */
export function trovaPostiVicini(occupati: Occupati, quanti: number) {
  const preferenza: SettoreId[] = ["centro", "fondo", "vicino", "palco"];
  let migliore: { tavolo: Tavolo; punteggio: number; posti: Posto[] } | null = null;
  TAVOLI.forEach((t) => {
    const liberi = POSTI.filter((p) => p.tav === t.cod && !p.sposo && !occupati.has(p.id));
    if (liberi.length < quanti) return;
    const nums = liberi.map((p) => p.num);
    let scelta: number[] | null = null;
    for (let inizio = 1; inizio <= SEDIE_PER_TAVOLO && !scelta; inizio++) {
      const fila: number[] = [];
      for (let d = 0; d < quanti; d++) {
        const n = ((inizio - 1 + d) % SEDIE_PER_TAVOLO) + 1;
        if (nums.includes(n)) fila.push(n);
        else break;
      }
      if (fila.length === quanti) scelta = fila;
    }
    if (!scelta) scelta = nums.slice(0, quanti);
    const punteggio = preferenza.indexOf(t.set) * 10 + (liberi.length - quanti);
    if (!migliore || punteggio < migliore.punteggio) {
      migliore = { tavolo: t, punteggio, posti: scelta.map((n) => liberi.find((p) => p.num === n)!) };
    }
  });
  return migliore as { tavolo: Tavolo; punteggio: number; posti: Posto[] } | null;
}

export const liberiAlTavolo = (cod: string, occupati: Occupati) =>
  POSTI.filter((p) => p.tav === cod && !p.sposo && !occupati.has(p.id)).length;
