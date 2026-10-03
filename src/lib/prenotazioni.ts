import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { occupatiDemo, type Occupati } from "../data/sala";

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null = SUPA_URL && SUPA_KEY ? createClient(SUPA_URL, SUPA_KEY) : null;
export const MODALITA_DEMO = !supabase;

export interface NuovaPrenotazione {
  nome: string;
  contatto: string;
  note: string;
  posti: string[];
  supplementi: string[];
  totale: number;
  codice: string;
}

export interface PrenotazioneSalvata extends NuovaPrenotazione {
  id: string;
  creataIl: string;
}

export class PostiGiaPresi extends Error {
  constructor(public posti: string[]) {
    super("posti_occupati");
  }
}

const CHIAVE_DEMO = "invito-ar:demo-occupati";
const CHIAVE_MIA = "invito-ar:mia-prenotazione";

function leggiDemo(): Occupati {
  const m = occupatiDemo();
  try {
    const extra = JSON.parse(localStorage.getItem(CHIAVE_DEMO) || "{}") as Record<string, string>;
    Object.entries(extra).forEach(([k, v]) => m.set(k, v));
  } catch {
    /* storage non disponibile */
  }
  return m;
}

export async function caricaOccupati(): Promise<Occupati> {
  if (!supabase) return leggiDemo();
  const { data, error } = await supabase.from("posti_occupati").select("posto, nome");
  if (error) throw error;
  return new Map((data ?? []).map((r) => [r.posto as string, r.nome as string]));
}

/** Aggiornamenti in tempo reale quando qualcun altro prenota. Restituisce la funzione per smettere. */
export function ascoltaOccupati(onCambio: () => void): () => void {
  if (!supabase) return () => {};
  const client = supabase;
  const canale = client
    .channel("posti_occupati")
    .on("postgres_changes", { event: "*", schema: "public", table: "posti_occupati" }, onCambio)
    .subscribe();
  return () => {
    client.removeChannel(canale);
  };
}

export async function salvaPrenotazione(p: NuovaPrenotazione): Promise<PrenotazioneSalvata> {
  const creataIl = new Date().toISOString();
  if (!supabase) {
    const occ = leggiDemo();
    const presi = p.posti.filter((id) => occ.has(id));
    if (presi.length) throw new PostiGiaPresi(presi);
    try {
      const extra = JSON.parse(localStorage.getItem(CHIAVE_DEMO) || "{}");
      p.posti.forEach((id) => (extra[id] = p.nome));
      localStorage.setItem(CHIAVE_DEMO, JSON.stringify(extra));
    } catch {
      /* ignora */
    }
    await new Promise((r) => setTimeout(r, 600));
    return { ...p, id: "demo-" + Date.now(), creataIl };
  }

  const { data, error } = await supabase.rpc("prenota", {
    p_nome: p.nome,
    p_contatto: p.contatto || null,
    p_note: p.note || null,
    p_posti: p.posti,
    p_supplementi: p.supplementi,
    p_totale: p.totale,
    p_codice: p.codice,
  });
  if (error) {
    const m = /posti_occupati:?([\w,-]*)/.exec(error.message);
    if (m) throw new PostiGiaPresi(m[1] ? m[1].split(",") : p.posti);
    throw error;
  }
  return { ...p, id: data as string, creataIl };
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
    return raw ? (JSON.parse(raw) as PrenotazioneSalvata) : null;
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
