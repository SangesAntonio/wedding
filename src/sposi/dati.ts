import { supabase } from "../lib/supabase";
import { POSTI_PER_ID, SETTORI, SUPPLEMENTI } from "../data/sala";
import type { Ospite } from "../lib/prenotazioni";
import { demo } from "./demo";
import { CHIAVE_DEMO_CONFIG, unisci, type ConfigMatrimonio } from "../lib/configMatrimonio";

export type { Ospite };
export type Stato = "confermata" | "da_verificare" | "annullata";
export type Richiamo = "da_sentire" | "confermato" | "non_viene" | "non_risponde";

export interface Prenotazione {
  id: string;
  creata_il: string;
  modificata_il: string | null;
  nome: string;
  contatto: string | null;
  note: string | null;
  persone: number;
  posti: string[];
  ospiti: Ospite[];
  supplementi: string[];
  totale: number;
  codice: string;
  stato: Stato;
  richiamo: Richiamo;
  richiamo_il: string | null;
  nota_sposi: string | null;
  invito_id: string | null;
}

export type NuovaPrenotazioneSposi = Pick<Prenotazione, "nome" | "contatto" | "note" | "posti" | "ospiti" | "totale" | "invito_id"> & {
  stato?: Stato;
};

export interface VoceStorico {
  id: number;
  chi: "invitato" | "sposi";
  azione: string;
  prima: Partial<Prenotazione> | null;
  dopo: Partial<Prenotazione> | null;
  quando: string;
}

export const ETICHETTE_STATO: Record<Stato, string> = {
  confermata: "Confermata",
  da_verificare: "Da verificare",
  annullata: "Annullata",
};

export const ETICHETTE_RICHIAMO: Record<Richiamo, string> = {
  da_sentire: "Da risentire",
  confermato: "Riconfermato",
  non_viene: "Non viene",
  non_risponde: "Non risponde",
};

const CAMPI =
  "id, creata_il, modificata_il, nome, contatto, note, persone, posti, ospiti, supplementi, totale, codice, stato, richiamo, richiamo_il, nota_sposi, invito_id";

/** Il matrimonio amministrato da chi ha fatto login (null = account non abilitato). */
export async function caricaMatrimonio(): Promise<{ id: string; slug: string } | null> {
  if (!supabase) return { id: "demo", slug: "demo" };
  const { data: m, error } = await supabase.from("membri").select("matrimonio_id").limit(1).maybeSingle();
  if (error) throw error;
  if (!m) return null;
  const { data, error: e2 } = await supabase.from("matrimoni").select("id, slug").eq("id", m.matrimonio_id).single();
  if (e2) throw e2;
  return data;
}

export async function caricaPrenotazioni(matrimonioId: string): Promise<Prenotazione[]> {
  if (!supabase) return demo.prenotazioni();
  const { data, error } = await supabase.from("prenotazioni").select(CAMPI).eq("matrimonio_id", matrimonioId).order("creata_il", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Prenotazione[]).map((p) => ({ ...p, ospiti: p.ospiti ?? [] }));
}

export async function aggiornaPrenotazione(id: string, modifiche: Partial<Prenotazione>): Promise<void> {
  if (!supabase) return demo.aggiornaPrenotazione(id, modifiche);
  const { error } = await supabase.from("prenotazioni").update(modifiche).eq("id", id);
  if (error) throw error;
}

export async function creaPrenotazione(matrimonioId: string, p: NuovaPrenotazioneSposi): Promise<void> {
  if (!supabase) return demo.creaPrenotazione(p);
  const { error } = await supabase.from("prenotazioni").insert({
    ...p,
    matrimonio_id: matrimonioId,
    stato: p.stato ?? "confermata",
    persone: p.posti.length,
  });
  if (error) throw error;
}

export async function caricaStorico(prenotazioneId: string): Promise<VoceStorico[]> {
  if (!supabase) return demo.storico(prenotazioneId);
  const { data, error } = await supabase
    .from("storico")
    .select("id, chi, azione, prima, dopo, quando")
    .eq("prenotazione_id", prenotazioneId)
    .order("quando", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as VoceStorico[];
}

/** Le impostazioni del matrimonio (complete, con i valori predefiniti dove mancano). */
export async function leggiConfig(matrimonioId: string): Promise<ConfigMatrimonio> {
  if (!supabase) {
    try {
      return unisci(JSON.parse(localStorage.getItem(CHIAVE_DEMO_CONFIG) || "null"));
    } catch {
      return unisci(null);
    }
  }
  const { data, error } = await supabase.from("matrimoni").select("config").eq("id", matrimonioId).single();
  if (error) throw error;
  return unisci(data?.config);
}

/** Salva le impostazioni senza toccare le altre chiavi già presenti (es. il messaggio WhatsApp). */
export async function salvaConfig(matrimonioId: string, c: ConfigMatrimonio): Promise<void> {
  const { messaggio_invito: _m, ...nuova } = c;
  if (!supabase) {
    const prima = JSON.parse(localStorage.getItem(CHIAVE_DEMO_CONFIG) || "{}");
    localStorage.setItem(CHIAVE_DEMO_CONFIG, JSON.stringify({ ...prima, ...nuova }));
    return;
  }
  const { data, error } = await supabase.from("matrimoni").select("config").eq("id", matrimonioId).single();
  if (error) throw error;
  const { error: e2 } = await supabase.from("matrimoni").update({ config: { ...(data?.config ?? {}), ...nuova } }).eq("id", matrimonioId);
  if (e2) throw e2;
}

/** Richiama `onCambio` quando cambia qualcosa (nuove conferme, annullamenti). */
export function ascoltaCambi(onCambio: () => void): () => void {
  if (!supabase) return () => {};
  const client = supabase;
  let t: ReturnType<typeof setTimeout> | undefined;
  const canale = client
    .channel("area-sposi-" + Math.random().toString(36).slice(2))
    .on("postgres_changes", { event: "*", schema: "public", table: "posti_occupati" }, () => {
      clearTimeout(t);
      t = setTimeout(onCambio, 600);
    })
    .subscribe();
  return () => {
    clearTimeout(t);
    client.removeChannel(canale);
  };
}

/** Messaggi comprensibili per gli errori che arrivano dal database. */
export function messaggioErrore(e: unknown): string {
  const m = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
  if (m.includes("ospiti_numero_diverso")) return "Serve un nome per ogni persona.";
  if (m.includes("ospite_senza_nome")) return "C'è un ospite senza nome.";
  if (m.includes("row-level security") || m.includes("permission")) return "Non avete i permessi per questa operazione.";
  if (m.includes("Failed to fetch") || m.includes("NetworkError")) return "Connessione assente. Riprovate tra poco.";
  return "Operazione non riuscita. Riprovate.";
}

// ------------------------------------------------------------ formattazione
export const descriviPosti = (posti: string[]) => {
  const settori = [...new Set(posti.map((id) => POSTI_PER_ID.get(id)?.set).filter(Boolean))] as (keyof typeof SETTORI)[];
  return { elenco: posti.join(", "), settori: settori.map((s) => SETTORI[s].nome).join(" · ") };
};

export const nomeSupplemento = (id: string) => SUPPLEMENTI.find((s) => s.id === id)?.n ?? id;

const fmtData = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const fmtGiorno = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" });
export const dataBreve = (iso: string) => fmtData.format(new Date(iso));
export const giornoBreve = (iso: string) => fmtGiorno.format(new Date(iso));

const rtf = new Intl.RelativeTimeFormat("it-IT", { numeric: "auto" });
export function dataRelativa(iso: string) {
  const s = (new Date(iso).getTime() - Date.now()) / 1000;
  const a = Math.abs(s);
  if (a < 60) return "adesso";
  if (a < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (a < 86400) return rtf.format(Math.round(s / 3600), "hour");
  if (a < 86400 * 7) return rtf.format(Math.round(s / 86400), "day");
  return giornoBreve(iso);
}
