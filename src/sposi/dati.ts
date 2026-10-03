import { supabase } from "../lib/supabase";
import { POSTI_PER_ID, SETTORI, SUPPLEMENTI } from "../data/sala";
import type { PrenotazioneSalvata } from "../lib/prenotazioni";

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
  supplementi: string[];
  totale: number;
  codice: string;
  stato: Stato;
  richiamo: Richiamo;
  richiamo_il: string | null;
  nota_sposi: string | null;
  invito_id: string | null;
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
  if (!supabase) return [...prenotazioniDalSitoDemo(), ...(demo ??= prenotazioniDemo())].map((p) => ({ ...p }));
  const { data, error } = await supabase
    .from("prenotazioni")
    .select("id, creata_il, modificata_il, nome, contatto, note, persone, posti, supplementi, totale, codice, stato, richiamo, richiamo_il, nota_sposi, invito_id")
    .eq("matrimonio_id", matrimonioId)
    .order("creata_il", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Prenotazione[];
}

export async function aggiornaPrenotazione(id: string, modifiche: Partial<Prenotazione>): Promise<void> {
  if (!supabase) {
    modificheDemo.set(id, { ...modificheDemo.get(id), ...modifiche });
    demo = (demo ??= prenotazioniDemo()).map((p) => (p.id === id ? { ...p, ...modifiche } : p));
    return;
  }
  const { error } = await supabase.from("prenotazioni").update(modifiche).eq("id", id);
  if (error) throw error;
}

/** Richiama `onCambio` quando cambia qualcosa (nuove conferme, annullamenti). */
export function ascoltaCambi(onCambio: () => void): () => void {
  if (!supabase) return () => {};
  const client = supabase;
  let t: ReturnType<typeof setTimeout> | undefined;
  const canale = client
    .channel("area-sposi")
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

export const descriviPosti = (posti: string[]) => {
  const settori = [...new Set(posti.map((id) => POSTI_PER_ID.get(id)?.set).filter(Boolean))] as (keyof typeof SETTORI)[];
  return { elenco: posti.join(", "), settori: settori.map((s) => SETTORI[s].nome).join(" · ") };
};

export const nomeSupplemento = (id: string) => SUPPLEMENTI.find((s) => s.id === id)?.n ?? id;

const fmtData = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export const dataBreve = (iso: string) => fmtData.format(new Date(iso));

/** CSV con separatore ";" e BOM: si apre bene in Excel italiano. */
export function scaricaCsv(righe: Prenotazione[]) {
  const intestazione = ["Data", "Codice", "Nome", "Persone", "Stato", "Seconda conferma", "Posti", "Contatto", "Note", "Nota sposi", "Supplementi", "Totale"];
  const cella = (v: unknown) => {
    const s = String(v ?? "");
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const corpo = righe.map((p) =>
    [
      new Date(p.creata_il).toLocaleString("it-IT"),
      p.codice,
      p.nome,
      p.persone,
      ETICHETTE_STATO[p.stato],
      ETICHETTE_RICHIAMO[p.richiamo],
      p.posti.join(" "),
      p.contatto,
      p.note,
      p.nota_sposi,
      p.supplementi.map(nomeSupplemento).join(", "),
      p.totale,
    ]
      .map(cella)
      .join(";"),
  );
  const csv = "﻿" + [intestazione.join(";"), ...corpo].join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `conferme-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ------------------------------------------------------------ dati finti per "npm run demo"
let demo: Prenotazione[] | undefined;
const modificheDemo = new Map<string, Partial<Prenotazione>>();

/** Le prenotazioni fatte dall'invito in modalità demo (stesso browser), collegate agli inviti demo. */
function prenotazioniDalSitoDemo(): Prenotazione[] {
  try {
    const sito = JSON.parse(localStorage.getItem("invito-ar:demo-prenotazioni") || "[]") as (PrenotazioneSalvata & { invito?: string })[];
    const inviti = JSON.parse(localStorage.getItem("invito-ar:demo-inviti") || "[]") as { id: string; token: string }[];
    return sito
      .map((p): Prenotazione => {
        const invito = p.invito ? inviti.find((i) => i.token === p.invito) : undefined;
        return {
          id: p.id,
          creata_il: p.creataIl,
          modificata_il: null,
          nome: p.nome,
          contatto: p.contatto || null,
          note: p.note || null,
          persone: p.posti.length,
          posti: p.posti,
          supplementi: p.supplementi,
          totale: p.totale,
          codice: p.codice,
          stato: invito ? "confermata" : "da_verificare",
          richiamo: "da_sentire",
          richiamo_il: null,
          nota_sposi: null,
          invito_id: invito?.id ?? null,
          ...modificheDemo.get(p.id),
        };
      })
      .reverse();
  } catch {
    return [];
  }
}
function prenotazioniDemo(): Prenotazione[] {
  const ora = Date.now();
  const p = (i: number, nome: string, posti: string[], extra: Partial<Prenotazione> = {}): Prenotazione => ({
    id: "demo-" + i,
    creata_il: new Date(ora - i * 7.3e6).toISOString(),
    modificata_il: null,
    nome,
    contatto: null,
    note: null,
    persone: posti.length,
    posti,
    supplementi: [],
    totale: 200 + posti.length * 130,
    codice: "AR-DEMO" + String(i).padStart(2, "0"),
    stato: "confermata",
    richiamo: "da_sentire",
    richiamo_il: null,
    nota_sposi: null,
    invito_id: null,
    ...extra,
  });
  return [
    p(1, "Famiglia Esposito", ["B2-1", "B2-2", "B2-3", "B2-4"], { contatto: "333 123 4567", note: "Un bambino di 4 anni, serve il seggiolone", supplementi: ["bis"] }),
    p(2, "Zia Concetta", ["A1-3"], { contatto: "081 8015731", richiamo: "confermato", richiamo_il: new Date(ora - 864e5).toISOString() }),
    p(3, "Cugino Mimmo e Teresa", ["C2-1", "C2-2"], { contatto: "mimmo@esempio.it", note: "Teresa è celiaca" }),
    p(4, "Amici del liceo", ["B4-1", "B4-2", "B4-3", "B4-4", "B4-5"], { stato: "da_verificare" }),
    p(5, "Famiglia Russo", ["C3-5", "C3-6", "C3-7"], { contatto: "+39 340 765 4321", stato: "annullata", nota_sposi: "Hanno un altro matrimonio lo stesso giorno" }),
    p(6, "Il socio di papà", ["A2-6"], { contatto: "347 000 1111", richiamo: "non_risponde" }),
  ];
}
