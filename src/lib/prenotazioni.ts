import { POSTI_SEMPRE_LIBERI } from "../config";
import { POSTI_PRENOTABILI, occupatiDemo, type Occupati } from "../data/sala";
import { MODALITA_DEMO, supabase } from "./supabase";

export { MODALITA_DEMO };

export interface Ospite {
  nome: string;
  bambino: boolean;
}

export interface NuovaPrenotazione {
  nome: string;
  /** uno per posto, nello stesso ordine di `posti` */
  ospiti: Ospite[];
  contatto: string;
  note: string;
  posti: string[];
  supplementi: string[];
  totale: number;
  /** token del link personale (?i=…), se l'invitato è arrivato da lì */
  invito?: string | null;
}

export interface PrenotazioneSalvata extends NuovaPrenotazione {
  id: string;
  codice: string;
  creataIl: string;
  stato?: "confermata" | "da_verificare" | "annullata";
}

const CHIAVE_DEMO = "invito-ar:demo-prenotazioni";
const CHIAVE_MIA = "invito-ar:mia-prenotazione";
export const CHIAVE_DEMO_INVITI = "invito-ar:demo-inviti";

/**
 * Le sedie sono scenografiche: mostriamo come occupate quelle scelte per prime,
 * lasciando sempre almeno POSTI_SEMPRE_LIBERI sedie libere in sala.
 */
function limita(righe: { posto: string; nome: string }[]): Occupati {
  const max = POSTI_PRENOTABILI - POSTI_SEMPRE_LIBERI;
  const m: Occupati = new Map();
  for (const r of righe) {
    if (m.size >= max) break;
    if (!m.has(r.posto)) m.set(r.posto, r.nome);
  }
  return m;
}

function leggiDemo(): PrenotazioneSalvata[] {
  try {
    return JSON.parse(localStorage.getItem(CHIAVE_DEMO) || "[]");
  } catch {
    return [];
  }
}

export async function caricaOccupati(): Promise<Occupati> {
  if (!supabase) {
    const finti = [...occupatiDemo()].map(([posto, nome]) => ({ posto, nome }));
    const veri = leggiDemo().flatMap((p) => p.posti.map((posto) => ({ posto, nome: p.nome })));
    return limita([...finti, ...veri]);
  }
  const { data, error } = await supabase.from("posti_occupati").select("posto, nome").order("creata_il", { ascending: true });
  if (error) throw error;
  return limita((data ?? []) as { posto: string; nome: string }[]);
}

/** Aggiornamenti in tempo reale quando qualcun altro conferma. Restituisce la funzione per smettere. */
export function ascoltaOccupati(onCambio: () => void): () => void {
  if (!supabase) return () => {};
  const client = supabase;
  const canale = client
    .channel("posti-occupati-" + Math.random().toString(36).slice(2))
    .on("postgres_changes", { event: "*", schema: "public", table: "posti_occupati" }, onCambio)
    .subscribe();
  return () => {
    client.removeChannel(canale);
  };
}

function codiceDemo() {
  const a = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  return "AR-" + Array.from({ length: 6 }, () => a[Math.floor(Math.random() * a.length)]).join("");
}

export async function salvaPrenotazione(p: NuovaPrenotazione): Promise<PrenotazioneSalvata> {
  if (!supabase) {
    await new Promise((r) => setTimeout(r, 600));
    if (p.invito && leggiDemo().some((x) => x.invito === p.invito)) throw new InvitoGiaConfermato();
    const salvata = { ...p, id: "demo-" + Date.now(), codice: codiceDemo(), creataIl: new Date().toISOString() };
    try {
      localStorage.setItem(CHIAVE_DEMO, JSON.stringify([...leggiDemo(), salvata]));
    } catch {
      /* ignora */
    }
    return salvata;
  }

  const { data, error } = await supabase.rpc("prenota", {
    p_nome: p.nome,
    p_contatto: p.contatto || null,
    p_note: p.note || null,
    p_posti: p.posti,
    p_supplementi: p.supplementi,
    p_totale: p.totale,
    p_invito: p.invito || null,
    p_ospiti: p.ospiti,
  });
  if (error) {
    if (error.message.includes("invito_gia_confermato")) throw new InvitoGiaConfermato();
    throw error;
  }
  const r = data as { id: string; codice: string };
  return { ...p, id: r.id, codice: r.codice, creataIl: new Date().toISOString() };
}

export class InvitoGiaConfermato extends Error {
  constructor() {
    super("invito_gia_confermato");
  }
}

export interface InvitoAperto {
  nome: string;
  persone_previste: number | null;
  prenotazione: PrenotazioneSalvata | null;
}

/** Legge il token dall'indirizzo (?i=…). */
export function tokenDallUrl(): string | null {
  const t = new URLSearchParams(window.location.search).get("i");
  return t && /^[0-9a-z]{6,12}$/i.test(t.trim()) ? t.trim().toLowerCase() : null;
}

/** null = link sconosciuto; "revocato" = invito ritirato dagli sposi. */
export async function apriInvito(token: string): Promise<InvitoAperto | "revocato" | null> {
  if (!supabase) {
    try {
      const inviti = JSON.parse(localStorage.getItem(CHIAVE_DEMO_INVITI) || "[]") as { token: string; nome: string; persone_previste: number | null; revocato: boolean }[];
      const i = inviti.find((x) => x.token === token);
      if (!i) return null;
      if (i.revocato) return "revocato";
      localStorage.setItem(CHIAVE_DEMO_INVITI, JSON.stringify(inviti.map((x) => (x === i ? { ...x, aperto_il: (x as { aperto_il?: string }).aperto_il ?? new Date().toISOString() } : x))));
      const p = leggiDemo().find((x) => x.invito === token) ?? null;
      return { nome: i.nome, persone_previste: i.persone_previste, prenotazione: p };
    } catch {
      return null;
    }
  }
  const { data, error } = await supabase.rpc("apri_invito", { p_token: token });
  if (error) throw error;
  if (!data) return null;
  if ((data as { revocato?: boolean }).revocato) return "revocato";
  return data as InvitoAperto;
}

/** Accetta "ar 7kq2mx", "AR7KQ2MX", "7KQ2MX"… e restituisce "AR-7KQ2MX". */
export function normalizzaCodice(s: string) {
  const c = s.toUpperCase().replace(/[^0-9A-Z]/g, "");
  const corpo = c.startsWith("AR") && c.length === 8 ? c.slice(2) : c;
  return "AR-" + corpo;
}

export async function cercaPrenotazione(codice: string): Promise<PrenotazioneSalvata | null> {
  const c = normalizzaCodice(codice);
  if (!/^AR-[0-9A-Z]{6}$/.test(c)) return null;
  if (!supabase) return leggiDemo().find((p) => p.codice === c) ?? null;
  const { data, error } = await supabase.rpc("cerca_prenotazione", { p_codice: c });
  if (error) throw error;
  return (data as PrenotazioneSalvata | null) ?? null;
}

export function ricordaMiaPrenotazione(p: PrenotazioneSalvata) {
  try {
    localStorage.setItem(CHIAVE_MIA, JSON.stringify(p));
  } catch {
    /* ignora */
  }
}

export function leggiMiaPrenotazione(): PrenotazioneSalvata | null {
  try {
    const raw = localStorage.getItem(CHIAVE_MIA);
    const p = raw ? (JSON.parse(raw) as PrenotazioneSalvata) : null;
    // le prenotazioni salvate con la prima versione non hanno il codice nuovo
    return p && /^AR-[0-9A-Z]{6}$/.test(p.codice) ? p : null;
  } catch {
    return null;
  }
}

export function dimenticaMiaPrenotazione() {
  try {
    localStorage.removeItem(CHIAVE_MIA);
  } catch {
    /* ignora */
  }
}
