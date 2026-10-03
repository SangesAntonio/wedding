// Una riga per famiglia: l'invito (se c'è) e la sua prenotazione più rilevante, oppure
// una prenotazione arrivata senza invito (link generico o inserita a mano).
import { leggiContatto } from "../lib/contatti";
import { POSTI, POSTI_PER_ID, SETTORI, SUPPLEMENTI, prezza, type Posto } from "../data/sala";
import type { Ospite, Prenotazione, Richiamo } from "./dati";
import type { Invito } from "./inviti";

export type StatoFamiglia = "da_inviare" | "inviato" | "aperto" | "confermato" | "da_verificare" | "annullato" | "revocato";

export const STATI: Record<StatoFamiglia, { etichetta: string; tono: Tono; ordine: number }> = {
  da_verificare: { etichetta: "Da verificare", tono: "warn", ordine: 0 },
  da_inviare: { etichetta: "Da inviare", tono: "neutral", ordine: 1 },
  inviato: { etichetta: "Inviato", tono: "info", ordine: 2 },
  aperto: { etichetta: "Ha aperto", tono: "violet", ordine: 3 },
  confermato: { etichetta: "Confermato", tono: "ok", ordine: 4 },
  annullato: { etichetta: "Non viene", tono: "orange", ordine: 5 },
  revocato: { etichetta: "Revocato", tono: "neutral", ordine: 6 },
};

export const RICHIAMI: Record<Richiamo, { etichetta: string; tono: Tono }> = {
  da_sentire: { etichetta: "Da risentire", tono: "neutral" },
  confermato: { etichetta: "Riconfermato", tono: "ok" },
  non_viene: { etichetta: "Non viene", tono: "orange" },
  non_risponde: { etichetta: "Non risponde", tono: "violet" },
};

export type Tono = "ok" | "info" | "warn" | "orange" | "violet" | "neutral";

export interface Famiglia {
  chiave: string; // "i:<id invito>" oppure "p:<id prenotazione>"
  nome: string;
  stato: StatoFamiglia;
  invito?: Invito;
  prenotazione?: Prenotazione;
  previste: number | null;
  persone: number; // persone confermate (0 se non ha confermato o ha annullato)
  bambini: number;
  ospiti: Ospite[];
  nomiMancanti: boolean;
  telefono: string | null;
  email: string | null;
  richiamo: Richiamo | null;
  note: string | null; // allergie, intolleranze… scritte dall'invitato
  notaSposi: string | null;
  aggiornato: string;
}

const piuRecente = (...d: (string | null | undefined)[]) => (d.filter(Boolean) as string[]).sort().pop() ?? "";

/** La prenotazione che "conta" per un invito: la più recente non annullata, altrimenti l'ultima. */
function prenotazionePrincipale(lista: Prenotazione[]) {
  const ordinate = [...lista].sort((a, b) => b.creata_il.localeCompare(a.creata_il));
  return ordinate.find((p) => p.stato !== "annullata") ?? ordinate[0];
}

export function costruisciFamiglie(inviti: Invito[], prenotazioni: Prenotazione[]): Famiglia[] {
  const perInvito = new Map<string, Prenotazione[]>();
  const senzaInvito: Prenotazione[] = [];
  prenotazioni.forEach((p) => {
    if (p.invito_id && inviti.some((i) => i.id === p.invito_id)) perInvito.set(p.invito_id, [...(perInvito.get(p.invito_id) ?? []), p]);
    else senzaInvito.push(p);
  });

  const riga = (invito: Invito | undefined, p: Prenotazione | undefined): Famiglia => {
    let stato: StatoFamiglia;
    if (invito?.revocato) stato = "revocato";
    else if (p) stato = p.stato === "confermata" ? "confermato" : p.stato === "annullata" ? "annullato" : "da_verificare";
    else if (invito?.aperto_il) stato = "aperto";
    else if (invito?.inviato_il) stato = "inviato";
    else stato = "da_inviare";

    const attiva = p && p.stato !== "annullata" ? p : undefined;
    const c = leggiContatto(p?.contatto);
    const ospiti = attiva?.ospiti ?? [];
    return {
      chiave: invito ? "i:" + invito.id : "p:" + p!.id,
      nome: invito?.nome ?? p!.nome,
      stato,
      invito,
      prenotazione: p,
      previste: invito?.persone_previste ?? null,
      persone: attiva?.persone ?? 0,
      bambini: ospiti.filter((o) => o.bambino).length,
      ospiti,
      nomiMancanti: !!attiva && ospiti.length < attiva.persone,
      telefono: invito?.telefono ?? c.telefono,
      email: invito?.email ?? c.email,
      richiamo: p?.stato === "confermata" ? p.richiamo : null,
      note: attiva?.note ?? null,
      notaSposi: invito ? invito.nota_sposi : p?.nota_sposi ?? null,
      aggiornato: piuRecente(invito?.creato_il, invito?.inviato_il, invito?.aperto_il, p?.creata_il, p?.modificata_il, p?.richiamo_il),
    };
  };

  return [
    ...inviti.map((i) => riga(i, perInvito.has(i.id) ? prenotazionePrincipale(perInvito.get(i.id)!) : undefined)),
    ...senzaInvito.map((p) => riga(undefined, p)),
  ];
}

// ------------------------------------------------------------ filtri rapidi
export type Filtro = "tutti" | "da_inviare" | "in_attesa" | "confermati" | "da_verificare" | "da_risentire" | "nomi_mancanti" | "annullati" | "revocati";

export const FILTRI: { id: Filtro; etichetta: string; test: (f: Famiglia) => boolean }[] = [
  { id: "tutti", etichetta: "Tutti", test: (f) => f.stato !== "revocato" },
  { id: "da_inviare", etichetta: "Da inviare", test: (f) => f.stato === "da_inviare" },
  { id: "in_attesa", etichetta: "In attesa", test: (f) => f.stato === "inviato" || f.stato === "aperto" },
  { id: "confermati", etichetta: "Confermati", test: (f) => f.stato === "confermato" },
  { id: "da_verificare", etichetta: "Da verificare", test: (f) => f.stato === "da_verificare" },
  { id: "da_risentire", etichetta: "Da risentire", test: (f) => f.stato === "confermato" && f.richiamo === "da_sentire" },
  { id: "nomi_mancanti", etichetta: "Nomi da completare", test: (f) => f.nomiMancanti },
  { id: "annullati", etichetta: "Non vengono", test: (f) => f.stato === "annullato" },
  { id: "revocati", etichetta: "Revocati", test: (f) => f.stato === "revocato" },
];

export function cercaFamiglia(f: Famiglia, q: string) {
  if (!q) return true;
  const t = q.toLowerCase();
  return [f.nome, f.telefono, f.email, f.note, f.notaSposi, f.prenotazione?.codice, f.prenotazione?.posti.join(" "), ...f.ospiti.map((o) => o.nome)].some((v) =>
    v?.toLowerCase().includes(t),
  );
}

// ------------------------------------------------------------ totali
export function totali(famiglie: Famiglia[]) {
  const attive = famiglie.filter((f) => f.stato !== "revocato");
  const conf = attive.filter((f) => f.stato === "confermato");
  const persone = conf.reduce((s, f) => s + f.persone, 0);
  const bambini = conf.reduce((s, f) => s + f.bambini, 0);
  return {
    famiglie: attive.length,
    inviti: attive.filter((f) => f.invito).length,
    previste: attive.reduce((s, f) => s + (f.previste ?? 0), 0),
    confermate: conf.length,
    persone,
    bambini,
    adulti: persone - bambini,
    daInviare: attive.filter((f) => f.stato === "da_inviare").length,
    inAttesa: attive.filter((f) => f.stato === "inviato" || f.stato === "aperto").length,
    daVerificare: attive.filter((f) => f.stato === "da_verificare").length,
    daRisentire: conf.filter((f) => f.richiamo === "da_sentire").length,
    riconfermate: conf.filter((f) => f.richiamo === "confermato").length,
    nonVengono: attive.filter((f) => f.stato === "annullato").length,
    nomiMancanti: attive.filter((f) => f.nomiMancanti).length,
    conNote: conf.filter((f) => f.note).length,
  };
}

// ------------------------------------------------------------ sedie per le prenotazioni fatte dagli sposi
/**
 * Le sedie sono scenografiche, ma servono comunque: tiene quelle che ci sono e aggiunge sedie libere
 * tenendo unita la famiglia (stesso tavolo, poi stesso settore). Se parte da zero sceglie un tavolo con
 * posto per tutti, preferendo centro sala → fondo → prima fila → tavolo degli sposi.
 */
const PREFERENZA = ["centro", "fondo", "vicino", "palco"];
export function assegnaPosti(attuali: string[], quante: number, prenotazioni: Prenotazione[], escludi?: string): string[] {
  if (quante <= attuali.length) return attuali.slice(0, quante);
  const prese = new Set(prenotazioni.filter((p) => p.id !== escludi && p.stato !== "annullata").flatMap((p) => p.posti));
  const scelte = [...attuali];
  const ordina = (ps: Posto[]) => [...ps].sort((a, b) => PREFERENZA.indexOf(a.set) - PREFERENZA.indexOf(b.set));

  while (scelte.length < quante) {
    const disponibili = POSTI.filter((p) => !p.sposo && !prese.has(p.id) && !scelte.includes(p.id));
    const giaScelte = scelte.map((id) => POSTI_PER_ID.get(id)).filter(Boolean) as Posto[];
    const tavoli = new Set(giaScelte.map((p) => p.tav));
    const settori = new Set(giaScelte.map((p) => p.set));
    let cand = disponibili.filter((p) => tavoli.has(p.tav));
    if (!cand.length && !giaScelte.length) {
      const perTavolo = new Map<string, Posto[]>();
      disponibili.forEach((p) => perTavolo.set(p.tav, [...(perTavolo.get(p.tav) ?? []), p]));
      const tavolo = ordina([...perTavolo.values()].filter((ps) => ps.length >= quante - scelte.length).map((ps) => ps[0]))[0];
      if (tavolo) cand = perTavolo.get(tavolo.tav)!;
    }
    if (!cand.length) cand = disponibili.filter((p) => settori.has(p.set));
    if (!cand.length) cand = ordina(disponibili);
    // sala "piena" (succede: le sedie sono finte): si riusa una sedia già scelta da altri
    if (!cand.length) cand = ordina(POSTI.filter((p) => !p.sposo && !scelte.includes(p.id)));
    scelte.push(cand[0].id);
  }
  return scelte;
}

export function totaleScherzoso(posti: string[], supplementi: string[]) {
  const sel = posti.map((id) => POSTI_PER_ID.get(id)).filter(Boolean) as Posto[];
  return prezza(sel).reduce((s, p) => s + p.scontato, 0) + SUPPLEMENTI.filter((s) => supplementi.includes(s.id)).reduce((s, x) => s + x.p, 0);
}

export const settoreDi = (posto: string) => {
  const p = POSTI_PER_ID.get(posto);
  return p ? SETTORI[p.set] : undefined;
};

// ------------------------------------------------------------ esportazione Excel
export async function esportaExcel(famiglie: Famiglia[]) {
  const XLSX = await import("xlsx");
  const ospiti: (string | number)[][] = [["Famiglia", "Ospite", "Bambino", "Tavolo", "Posto", "Settore", "Stato", "Seconda conferma", "Note famiglia", "Telefono"]];
  famiglie
    .filter((f) => f.stato === "confermato" || f.stato === "da_verificare")
    .sort((a, b) => a.nome.localeCompare(b.nome))
    .forEach((f) => {
      const p = f.prenotazione!;
      const righe = p.posti.map((posto, i) => ({ posto, o: p.ospiti[i] }));
      righe.forEach(({ posto, o }) => {
        const [tav, num] = posto.split("-");
        ospiti.push([
          f.nome,
          o?.nome ?? "(nome da completare)",
          o?.bambino ? "sì" : "",
          tav,
          Number(num),
          settoreDi(posto)?.nome ?? "",
          STATI[f.stato].etichetta,
          f.richiamo ? RICHIAMI[f.richiamo].etichetta : "",
          f.note ?? "",
          f.telefono ?? "",
        ]);
      });
    });
  const famRighe: (string | number)[][] = [["Famiglia", "Stato", "Persone previste", "Persone confermate", "Bambini", "Seconda conferma", "Telefono", "Email", "Note", "Nota sposi", "Codice", "Link"]];
  [...famiglie]
    .sort((a, b) => STATI[a.stato].ordine - STATI[b.stato].ordine || a.nome.localeCompare(b.nome))
    .forEach((f) =>
      famRighe.push([
        f.nome,
        STATI[f.stato].etichetta,
        f.previste ?? "",
        f.persone || "",
        f.bambini || "",
        f.richiamo ? RICHIAMI[f.richiamo].etichetta : "",
        f.telefono ?? "",
        f.email ?? "",
        f.note ?? "",
        f.notaSposi ?? "",
        f.prenotazione?.codice ?? "",
        f.invito ? new URL(`../?i=${f.invito.token}`, window.location.href).toString().split("#")[0] : "",
      ]),
    );
  const libro = XLSX.utils.book_new();
  const f1 = XLSX.utils.aoa_to_sheet(ospiti);
  f1["!cols"] = [{ wch: 26 }, { wch: 26 }, { wch: 8 }, { wch: 7 }, { wch: 6 }, { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 34 }, { wch: 16 }];
  const f2 = XLSX.utils.aoa_to_sheet(famRighe);
  f2["!cols"] = [{ wch: 26 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 16 }, { wch: 16 }, { wch: 24 }, { wch: 30 }, { wch: 30 }, { wch: 11 }, { wch: 44 }];
  XLSX.utils.book_append_sheet(libro, f1, "Ospiti");
  XLSX.utils.book_append_sheet(libro, f2, "Famiglie");
  XLSX.writeFile(libro, `invitati-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
