// Modello Excel da scaricare e lettura del file compilato (xlsx, xls, csv).
// SheetJS si carica solo quando serve, così l'area sposi resta leggera.
import { normalizzaTelefono } from "../lib/contatti";
import type { Invito, NuovoInvito } from "./inviti";

const COLONNE = ["Famiglia", "Telefono", "Email", "Persone previste", "Note"] as const;

export async function scaricaModello() {
  const XLSX = await import("xlsx");
  const righe = [
    [...COLONNE],
    ["Famiglia Esposito", "333 123 4567", "", 4, "Cugini di Rosa"],
    ["Zia Concetta", "", "concetta@esempio.it", 1, ""],
  ];
  const foglio = XLSX.utils.aoa_to_sheet(righe);
  foglio["!cols"] = [{ wch: 28 }, { wch: 18 }, { wch: 28 }, { wch: 16 }, { wch: 36 }];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, foglio, "Invitati");
  XLSX.writeFile(libro, "invitati-modello.xlsx");
}

export interface RigaImport {
  riga: number; // numero di riga nel file, per i messaggi
  dati: NuovoInvito;
  telefonoScritto: string;
  errori: string[];
  avvisi: string[];
}

// intestazioni accettate (minuscole, senza accenti né spazi doppi)
const SINONIMI: Record<keyof NuovoInvito, string[]> = {
  nome: ["famiglia", "nome", "nome famiglia", "invitato", "invitati", "nominativo", "cognome"],
  telefono: ["telefono", "cellulare", "tel", "numero", "numero di telefono", "whatsapp"],
  email: ["email", "e-mail", "mail", "posta"],
  persone_previste: ["persone previste", "persone", "numero persone", "n persone", "quanti", "partecipanti"],
  nota_sposi: ["note", "nota", "commenti"],
};

const pulisci = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export async function leggiFile(file: File, esistenti: Invito[]): Promise<RigaImport[]> {
  const XLSX = await import("xlsx");
  const libro = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const foglio = libro.Sheets[libro.SheetNames[0]];
  const tabella = XLSX.utils.sheet_to_json<unknown[]>(foglio, { header: 1, blankrows: false, raw: false });
  if (!tabella.length) throw new Error("Il file è vuoto.");

  // trova la riga di intestazione (la prima che contiene almeno la colonna del nome)
  let iTesta = tabella.findIndex((r) => r.some((c) => SINONIMI.nome.includes(pulisci(c))));
  if (iTesta < 0) throw new Error('Non trovo la colonna "Famiglia". Usate il modello scaricabile.');
  const testa = tabella[iTesta].map(pulisci);
  const colonna = (campo: keyof NuovoInvito) => testa.findIndex((h) => SINONIMI[campo].includes(h));
  const col = {
    nome: colonna("nome"),
    telefono: colonna("telefono"),
    email: colonna("email"),
    persone_previste: colonna("persone_previste"),
    nota_sposi: colonna("nota_sposi"),
  };

  const chiave = (nome: string, tel: string | null) => pulisci(nome) + "|" + (tel ?? "");
  const giaPresenti = new Set(esistenti.map((i) => chiave(i.nome, i.telefono)));
  const nomiPresenti = new Set(esistenti.map((i) => pulisci(i.nome)));
  const visti = new Set<string>();

  const out: RigaImport[] = [];
  for (let i = iTesta + 1; i < tabella.length; i++) {
    const r = tabella[i];
    const v = (c: number) => (c >= 0 ? String(r[c] ?? "").trim() : "");
    const nome = v(col.nome);
    const telefonoScritto = v(col.telefono);
    const email = v(col.email);
    const personeTesto = v(col.persone_previste);
    const nota = v(col.nota_sposi);
    if (!nome && !telefonoScritto && !email && !personeTesto && !nota) continue;

    const errori: string[] = [];
    const avvisi: string[] = [];
    if (!nome) errori.push("manca il nome");
    if (nome.length > 120) errori.push("nome troppo lungo");

    const telefono = telefonoScritto ? normalizzaTelefono(telefonoScritto) : null;
    if (telefonoScritto && !telefono) avvisi.push("telefono non riconosciuto, verrà ignorato");

    const emailOk = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) avvisi.push("email non valida, verrà ignorata");

    let persone: number | null = null;
    if (personeTesto) {
      const n = parseInt(personeTesto, 10);
      if (Number.isFinite(n) && n >= 1 && n <= 30) persone = n;
      else avvisi.push("numero di persone non valido");
    }

    const k = chiave(nome, telefono);
    if (nome && (giaPresenti.has(k) || visti.has(k))) errori.push(giaPresenti.has(k) ? "già nella lista" : "ripetuto nel file");
    else if (nome && nomiPresenti.has(pulisci(nome))) avvisi.push("c'è già un invito con questo nome");
    visti.add(k);

    out.push({
      riga: i + 1,
      telefonoScritto,
      errori,
      avvisi,
      dati: {
        nome,
        telefono,
        email: emailOk && email ? email : null,
        persone_previste: persone,
        nota_sposi: nota ? nota.slice(0, 600) : null,
      },
    });
  }
  return out;
}
