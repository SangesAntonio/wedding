// Le impostazioni del matrimonio salvate dagli sposi (tabella matrimoni.config) e la loro applicazione
// all'invito. Senza database o se qualcosa manca valgono i valori di config.ts e data/sala.ts.
import * as C from "../config";
import { ORDINE_SETTORI, SETTORI, SUPPLEMENTI, type SettoreId } from "../data/sala";
import { supabase } from "./supabase";

export interface ConfigMatrimonio {
  sposi: { lui: string; lei: string; cognomi: string; iniziali: string; intestatario: string };
  data_evento: string; // ISO con fuso, es. 2027-07-20T17:00:00+02:00
  orario: string;
  durata_ore: number;
  luogo: { nome: string; indirizzo: string; citta: string; lat: number; lng: number };
  iban: string;
  iban_di_esempio: boolean;
  testi: { occhiello: string; claim: string; nota_pagamento: string; nota_contanti: string };
  settori: Record<SettoreId, { nome: string; tag: string; prezzo: number; desc: string }>;
  supplementi: { id: string; n: string; d: string; p: number }[];
  sconto_famiglia: number;
  posti_sempre_liberi: number;
  giorni_blocco_modifiche: number;
  messaggio_invito?: string;
}

export const CHIAVE_DEMO_CONFIG = "invito-ar:demo-config";

// valori di partenza, fotografati prima di qualsiasi modifica
const PARTENZA: ConfigMatrimonio = {
  sposi: { ...C.SPOSI },
  data_evento: "2027-07-20T17:00:00+02:00",
  orario: C.ORARIO,
  durata_ore: C.DURATA_ORE,
  luogo: { ...C.LUOGO },
  iban: C.IBAN,
  iban_di_esempio: C.IBAN_DI_ESEMPIO,
  testi: { ...C.TESTI },
  settori: Object.fromEntries(ORDINE_SETTORI.map((k) => [k, { nome: SETTORI[k].nome, tag: SETTORI[k].tag, prezzo: SETTORI[k].prezzo, desc: SETTORI[k].desc }])) as ConfigMatrimonio["settori"],
  supplementi: SUPPLEMENTI.map((s) => ({ ...s })),
  sconto_famiglia: C.SCONTO_FAMIGLIA,
  posti_sempre_liberi: C.POSTI_SEMPRE_LIBERI,
  giorni_blocco_modifiche: 10,
};
export const configPredefinita = (): ConfigMatrimonio => structuredClone(PARTENZA);

const testo = (v: unknown, d: string, max = 600) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : d);
const numero = (v: unknown, d: number, min: number, max: number) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};
const oggetto = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Unisce quello che arriva dal database ai valori predefiniti, scartando ciò che non è valido. */
export function unisci(grezzo: unknown): ConfigMatrimonio {
  const g = oggetto(grezzo);
  const d = configPredefinita();
  const sp = oggetto(g.sposi);
  const lu = oggetto(g.luogo);
  const te = oggetto(g.testi);
  const se = oggetto(g.settori);
  const data = typeof g.data_evento === "string" && !isNaN(Date.parse(g.data_evento)) ? g.data_evento : d.data_evento;
  return {
    sposi: {
      lui: testo(sp.lui, d.sposi.lui, 40),
      lei: testo(sp.lei, d.sposi.lei, 40),
      cognomi: testo(sp.cognomi, d.sposi.cognomi, 80),
      iniziali: testo(sp.iniziali, d.sposi.iniziali, 6),
      intestatario: testo(sp.intestatario, d.sposi.intestatario, 120),
    },
    data_evento: data,
    orario: testo(g.orario, d.orario, 120),
    durata_ore: numero(g.durata_ore, d.durata_ore, 1, 24),
    luogo: {
      nome: testo(lu.nome, d.luogo.nome, 120),
      indirizzo: testo(lu.indirizzo, d.luogo.indirizzo, 200),
      citta: testo(lu.citta, d.luogo.citta, 80),
      lat: numero(lu.lat, d.luogo.lat, -90, 90),
      lng: numero(lu.lng, d.luogo.lng, -180, 180),
    },
    iban: testo(g.iban, d.iban, 40),
    iban_di_esempio: typeof g.iban_di_esempio === "boolean" ? g.iban_di_esempio : d.iban_di_esempio,
    testi: {
      occhiello: testo(te.occhiello, d.testi.occhiello, 60),
      claim: testo(te.claim, d.testi.claim, 200),
      nota_pagamento: testo(te.nota_pagamento, d.testi.nota_pagamento, 400),
      nota_contanti: testo(te.nota_contanti, d.testi.nota_contanti, 600),
    },
    settori: Object.fromEntries(
      ORDINE_SETTORI.map((k) => {
        const s = oggetto(se[k]);
        const ds = d.settori[k];
        return [k, { nome: testo(s.nome, ds.nome, 40), tag: testo(s.tag, ds.tag, 40), prezzo: numero(s.prezzo, ds.prezzo, 0, 100000), desc: testo(s.desc, ds.desc, 200) }];
      }),
    ) as ConfigMatrimonio["settori"],
    supplementi: Array.isArray(g.supplementi)
      ? (g.supplementi as unknown[])
          .map(oggetto)
          .filter((s) => typeof s.n === "string" && s.n.trim())
          .slice(0, 12)
          .map((s, i) => ({ id: testo(s.id, `s${i}`, 30), n: testo(s.n, "", 80), d: testo(s.d, "", 120), p: numero(s.p, 0, 0, 10000) }))
      : d.supplementi,
    sconto_famiglia: numero(g.sconto_famiglia, d.sconto_famiglia, 0, 0.9),
    posti_sempre_liberi: numero(g.posti_sempre_liberi, d.posti_sempre_liberi, 0, 60),
    giorni_blocco_modifiche: numero(g.giorni_blocco_modifiche, d.giorni_blocco_modifiche, 0, 120),
    messaggio_invito: typeof g.messaggio_invito === "string" ? g.messaggio_invito : undefined,
  };
}

/** Applica le impostazioni a tutto l'invito (config.ts e sala). */
export function applica(c: ConfigMatrimonio, modificheFino?: string | null) {
  const data = new Date(c.data_evento);
  C.impostaBase({
    sposi: { ...c.sposi },
    data,
    orario: c.orario,
    durata: c.durata_ore,
    luogo: { ...c.luogo },
    iban: c.iban,
    ibanDiEsempio: c.iban_di_esempio,
    testi: { ...c.testi },
    sconto: c.sconto_famiglia,
    postiLiberi: c.posti_sempre_liberi,
    modificheFino: modificheFino ? new Date(modificheFino) : new Date(data.getTime() - c.giorni_blocco_modifiche * 864e5),
  });
  ORDINE_SETTORI.forEach((k) => Object.assign(SETTORI[k], c.settori[k]));
  SUPPLEMENTI.splice(0, SUPPLEMENTI.length, ...c.supplementi.map((s) => ({ ...s })));
}

/** Legge le impostazioni pubbliche dal database (con un tempo massimo: se tarda, si parte con quelle predefinite). */
export async function caricaEApplica(timeoutMs = 2500): Promise<ConfigMatrimonio> {
  if (!supabase) {
    let grezzo: unknown = null;
    try {
      grezzo = JSON.parse(localStorage.getItem(CHIAVE_DEMO_CONFIG) || "null");
    } catch {
      /* ignora */
    }
    const c = unisci(grezzo);
    applica(c);
    return c;
  }
  const client = supabase;
  try {
    const risposta = await Promise.race([
      client.rpc("config_pubblica"),
      new Promise<null>((ok) => setTimeout(() => ok(null), timeoutMs)),
    ]);
    const grezzo = risposta && !risposta.error ? (risposta.data as Record<string, unknown> | null) : null;
    const c = unisci(grezzo);
    applica(c, (grezzo?.modifiche_fino as string | undefined) ?? null);
    return c;
  } catch {
    const c = configPredefinita();
    applica(c);
    return c;
  }
}
