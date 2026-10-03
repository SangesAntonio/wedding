// Dati finti per "npm run demo": una cinquantina di famiglie, per provare l'area sposi senza database.
// Gli inviti stanno in localStorage (condivisi con l'invito, così i link personali funzionano anche in demo);
// le prenotazioni sono quelle generate qui + quelle fatte davvero dall'invito in modalità demo.
import { CHIAVE_DEMO_INVITI, type PrenotazioneSalvata } from "../lib/prenotazioni";
import type { Invito, NuovoInvito } from "./inviti";
import type { NuovaPrenotazioneSposi, Prenotazione, VoceStorico } from "./dati";

const CHIAVE_PREN_SITO = "invito-ar:demo-prenotazioni";
const CHIAVE_PREN_SPOSI = "invito-ar:demo-prenotazioni-sposi";
const CHIAVE_SEME = "invito-ar:demo-seme-v2";

const ORA = Date.now();
const giorni = (n: number) => new Date(ORA - n * 864e5).toISOString();
const leggi = <T,>(k: string, d: T): T => {
  try {
    return JSON.parse(localStorage.getItem(k) || "") as T;
  } catch {
    return d;
  }
};
const scrivi = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));
const tokenCasuale = () => Array.from({ length: 8 }, () => "23456789abcdefghjkmnpqrstuvwxyz"[Math.floor(Math.random() * 31)]).join("");

// [famiglia, telefono, persone previste, componenti, stato]
type Seme = [string, string | null, number, string[], "confermata" | "annullata" | "aperto" | "inviato" | "nuovo"];
const SEMI: Seme[] = [
  ["Famiglia Esposito", "333 123 4567", 4, ["Gennaro Esposito", "Carmela Esposito", "Ciro Esposito", "Luca Esposito*"], "confermata"],
  ["Zia Concetta", "081 801 5731", 1, ["Concetta Sanges"], "confermata"],
  ["Famiglia Russo", "340 765 4321", 3, ["Salvatore Russo", "Anna Russo", "Sofia Russo*"], "annullata"],
  ["Cugino Mimmo e Teresa", "347 222 1010", 2, ["Domenico Martinelli", "Teresa Ruggiero"], "confermata"],
  ["Nonna Rosaria", null, 1, ["Rosaria Martinelli"], "confermata"],
  ["Compare Ciro", "339 456 1122", 2, ["Ciro Amato", "Lucia Amato"], "aperto"],
  ["Zio Peppe e Zia Ninetta", "331 908 7766", 2, ["Giuseppe Sanges", "Antonietta Sanges"], "confermata"],
  ["Famiglia De Luca", "320 111 2233", 5, ["Marco De Luca", "Paola De Luca", "Giulia De Luca", "Matteo De Luca*", "Emma De Luca*"], "confermata"],
  ["Famiglia Romano", "338 444 5566", 3, [], "inviato"],
  ["Amici del liceo", null, 6, [], "nuovo"],
  ["Famiglia Ferrara", "329 777 8899", 4, ["Luigi Ferrara", "Rita Ferrara", "Elena Ferrara", "Paolo Ferrara"], "confermata"],
  ["Cugina Assunta", "348 333 2211", 2, ["Assunta Caputo", "Vincenzo Caputo"], "confermata"],
  ["Famiglia Greco", "335 909 1010", 4, [], "aperto"],
  ["I colleghi di Antonio", null, 5, [], "nuovo"],
  ["Le amiche di Rosa", "366 121 3434", 4, ["Chiara Rossi", "Valentina Costa", "Martina Fontana", "Sara Galli"], "confermata"],
  ["Famiglia Marino", "349 565 7878", 3, [], "inviato"],
  ["Il testimone", "333 000 1111", 2, ["Francesco Iovine", "Ilaria Iovine"], "confermata"],
  ["Famiglia Conti", "340 232 4545", 4, [], "inviato"],
  ["Famiglia Bruno", "328 676 8989", 2, ["Antonio Bruno", "Maria Bruno"], "confermata"],
  ["Zia Filomena", "081 555 4433", 1, [], "aperto"],
  ["Famiglia Gallo", "345 141 5252", 5, ["Roberto Gallo", "Laura Gallo", "Pietro Gallo*", "Anna Gallo*", "Nonno Gino Gallo"], "confermata"],
  ["Il socio di papà", "347 000 1112", 2, [], "inviato"],
  ["Comare Anna", "339 878 6565", 1, ["Anna Capasso"], "confermata"],
  ["Famiglia Ricci", "334 343 2121", 3, [], "nuovo"],
  ["Famiglia Lombardi", "327 989 1414", 4, ["Davide Lombardi", "Federica Lombardi", "Tommaso Lombardi*", "Alice Lombardi*"], "confermata"],
  ["Famiglia Moretti", "338 121 9090", 2, [], "inviato"],
  ["Famiglia Barbieri", "393 565 1212", 3, ["Stefano Barbieri", "Claudia Barbieri", "Nicolò Barbieri"], "confermata"],
  ["Famiglia Santoro", null, 4, [], "nuovo"],
  ["Famiglia Mariani", "346 787 2323", 2, ["Fabio Mariani", "Elisa Mariani"], "confermata"],
  ["Famiglia Rinaldi", "320 909 3434", 3, [], "aperto"],
  ["Famiglia Caruso", "347 454 6767", 4, ["Raffaele Caruso", "Teresa Caruso", "Mario Caruso", "Lucia Caruso"], "confermata"],
  ["Famiglia Ferri", "331 212 4343", 2, [], "inviato"],
  ["Famiglia Fabbri", "349 656 8787", 3, ["Giorgio Fabbri", "Simona Fabbri", "Leo Fabbri*"], "confermata"],
  ["Famiglia Pellegrini", "335 787 9898", 2, [], "nuovo"],
  ["Famiglia Palumbo", "328 101 2020", 4, ["Enzo Palumbo", "Rosa Palumbo", "Gaia Palumbo", "Bruno Palumbo"], "confermata"],
  ["Famiglia Sanna", "340 303 4040", 2, [], "inviato"],
  ["Famiglia Farina", "338 505 6060", 3, ["Massimo Farina", "Giovanna Farina", "Irene Farina"], "confermata"],
  ["Famiglia Rizzo", "345 707 8080", 2, [], "aperto"],
  ["Famiglia Monti", "333 909 0000", 4, ["Alberto Monti", "Silvia Monti", "Pietro Monti*", "Bianca Monti*"], "confermata"],
  ["Famiglia Cattaneo", null, 2, [], "nuovo"],
  ["Famiglia Leone", "329 242 4646", 3, ["Ugo Leone", "Carla Leone", "Dario Leone"], "confermata"],
  ["Famiglia Longo", "346 464 6868", 2, [], "inviato"],
  ["Famiglia Gentile", "320 686 8080", 4, ["Michele Gentile", "Patrizia Gentile", "Andrea Gentile", "Giada Gentile"], "confermata"],
  ["Famiglia Martini", "339 808 0202", 2, ["Luca Martini", "Serena Martini"], "confermata"],
  ["Famiglia Vitale", "347 020 2424", 3, [], "aperto"],
  ["Famiglia Serra", "331 242 6464", 2, ["Nicola Serra", "Marta Serra"], "confermata"],
  ["Famiglia Coppola", "348 464 8686", 5, [], "inviato"],
  ["Famiglia D'Angelo", "335 686 0808", 2, ["Vittorio D'Angelo", "Grazia D'Angelo"], "confermata"],
];

// sedie libere in ordine, per assegnare i posti ai semi
const SEDIE = ["B1", "B2", "B3", "B4", "B5", "C1", "C2", "C3", "C4", "A1", "A2", "A3"].flatMap((t) => Array.from({ length: 8 }, (_, i) => `${t}-${i + 1}`));

function semina() {
  if (localStorage.getItem(CHIAVE_SEME)) return;
  const inviti: Invito[] = [];
  const pren: Prenotazione[] = [];
  let sedia = 0;
  SEMI.forEach(([nome, tel, previste, componenti, stato], i) => {
    const id = crypto.randomUUID();
    const telefono = tel ? "+39" + tel.replace(/\D/g, "") : null;
    const inviato = stato === "nuovo" ? null : giorni(20 - (i % 9));
    inviti.push({
      id,
      token: tokenCasuale(),
      nome,
      telefono,
      email: null,
      persone_previste: previste,
      nota_sposi: i === 3 ? "Cugini di Rosa, chiedere per il pranzo del giorno dopo" : null,
      inviato_il: inviato,
      aperto_il: stato === "aperto" || stato === "confermata" || stato === "annullata" ? giorni(18 - (i % 9)) : null,
      revocato: false,
      creato_il: giorni(25),
    });
    if (stato === "confermata" || stato === "annullata") {
      const n = componenti.length;
      const posti = SEDIE.slice(sedia, sedia + n);
      sedia += n;
      pren.push({
        id: crypto.randomUUID(),
        creata_il: giorni(16 - (i % 15) + (i % 3) * 0.3),
        modificata_il: null,
        nome,
        contatto: tel,
        note: i === 0 ? "Luca ha 4 anni, serve il seggiolone" : i === 3 ? "Teresa è celiaca" : i === 7 ? "Marco vegetariano" : null,
        persone: n,
        posti,
        ospiti: componenti.map((c) => ({ nome: c.replace("*", ""), bambino: c.endsWith("*") })),
        supplementi: i % 5 === 0 ? ["bis"] : [],
        totale: 200 + n * 130,
        codice: "AR-" + tokenCasuale().slice(0, 6).toUpperCase(),
        stato: stato === "annullata" ? "annullata" : "confermata",
        richiamo: i % 4 === 1 ? "confermato" : i % 9 === 2 ? "non_risponde" : "da_sentire",
        richiamo_il: i % 4 === 1 ? giorni(2) : null,
        nota_sposi: stato === "annullata" ? "Hanno un altro matrimonio lo stesso giorno" : null,
        invito_id: id,
      });
    }
  });
  // una conferma arrivata dal link generico, senza nomi
  pren.push({
    id: crypto.randomUUID(),
    creata_il: giorni(1),
    modificata_il: null,
    nome: "Paolo e Francesca",
    contatto: "351 999 0000",
    note: null,
    persone: 2,
    posti: SEDIE.slice(sedia, sedia + 2),
    ospiti: [],
    supplementi: [],
    totale: 330,
    codice: "AR-GEN0R1",
    stato: "da_verificare",
    richiamo: "da_sentire",
    richiamo_il: null,
    nota_sposi: null,
    invito_id: null,
  });
  scrivi(CHIAVE_DEMO_INVITI, [...leggi<Invito[]>(CHIAVE_DEMO_INVITI, []), ...inviti]);
  scrivi(CHIAVE_PREN_SPOSI, pren);
  localStorage.setItem(CHIAVE_SEME, "1");
}

const modificheSito = () => leggi<Record<string, Partial<Prenotazione>>>(CHIAVE_PREN_SPOSI + ":modifiche", {});

/** Le prenotazioni fatte dall'invito in modalità demo, collegate ai loro inviti. */
function dalSito(): Prenotazione[] {
  const sito = leggi<(PrenotazioneSalvata & { invito?: string })[]>(CHIAVE_PREN_SITO, []);
  const inviti = leggi<Invito[]>(CHIAVE_DEMO_INVITI, []);
  const mod = modificheSito();
  return sito.map((p): Prenotazione => {
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
      ospiti: p.ospiti ?? [],
      supplementi: p.supplementi,
      totale: p.totale,
      codice: p.codice,
      stato: invito ? "confermata" : "da_verificare",
      richiamo: "da_sentire",
      richiamo_il: null,
      nota_sposi: null,
      invito_id: invito?.id ?? null,
      ...mod[p.id],
    };
  });
}

export const demo = {
  semina,

  prenotazioni(): Prenotazione[] {
    semina();
    return [...dalSito(), ...leggi<Prenotazione[]>(CHIAVE_PREN_SPOSI, [])].sort((a, b) => b.creata_il.localeCompare(a.creata_il));
  },

  aggiornaPrenotazione(id: string, m: Partial<Prenotazione>) {
    const prima = demo.prenotazioni().find((p) => p.id === id) ?? null;
    const sposi = leggi<Prenotazione[]>(CHIAVE_PREN_SPOSI, []);
    const tocca = { ...m, modificata_il: new Date().toISOString(), ...(m.richiamo ? { richiamo_il: new Date().toISOString() } : {}) };
    if (m.posti) tocca.persone = m.posti.length;
    if (sposi.some((p) => p.id === id)) {
      scrivi(CHIAVE_PREN_SPOSI, sposi.map((p) => (p.id === id ? { ...p, ...tocca } : p)));
    } else {
      const mod = modificheSito();
      mod[id] = { ...mod[id], ...tocca };
      scrivi(CHIAVE_PREN_SPOSI + ":modifiche", mod);
    }
    registra(id, "sposi", m, undefined, prima);
  },

  creaPrenotazione(p: NuovaPrenotazioneSposi) {
    const nuova: Prenotazione = {
      ...p,
      id: crypto.randomUUID(),
      creata_il: new Date().toISOString(),
      modificata_il: null,
      persone: p.posti.length,
      supplementi: [],
      codice: "AR-" + tokenCasuale().slice(0, 6).toUpperCase(),
      stato: p.stato ?? "confermata",
      richiamo: "da_sentire",
      richiamo_il: null,
      nota_sposi: null,
    };
    scrivi(CHIAVE_PREN_SPOSI, [...leggi<Prenotazione[]>(CHIAVE_PREN_SPOSI, []), nuova]);
    registra(nuova.id, "sposi", null, "creata");
  },

  storico(id: string): VoceStorico[] {
    const p = demo.prenotazioni().find((x) => x.id === id);
    const voci = leggi<Record<string, VoceStorico[]>>("invito-ar:demo-storico", {})[id] ?? [];
    return [...voci, ...(p ? [{ id: 0, chi: "invitato" as const, azione: "creata", prima: null, dopo: p, quando: p.creata_il }] : [])];
  },

  inviti(): Invito[] {
    semina();
    return leggi<Invito[]>(CHIAVE_DEMO_INVITI, []);
  },
  creaInviti(nuovi: NuovoInvito[]): Invito[] {
    const creati = nuovi.map((n) => ({ ...n, id: crypto.randomUUID(), token: tokenCasuale(), inviato_il: null, aperto_il: null, revocato: false, creato_il: new Date().toISOString() }));
    scrivi(CHIAVE_DEMO_INVITI, [...demo.inviti(), ...creati]);
    return creati;
  },
  aggiornaInvito(id: string, m: Partial<Invito>) {
    scrivi(CHIAVE_DEMO_INVITI, demo.inviti().map((i) => (i.id === id ? { ...i, ...m } : i)));
  },
  eliminaInvito(id: string) {
    scrivi(CHIAVE_DEMO_INVITI, demo.inviti().filter((i) => i.id !== id));
  },
};

function registra(id: string, chi: "sposi" | "invitato", m: Partial<Prenotazione> | null, azione?: string, prima: Prenotazione | null = null) {
  const tutto = leggi<Record<string, VoceStorico[]>>("invito-ar:demo-storico", {});
  const az = azione ?? (m?.stato ? m.stato : m?.richiamo ? "richiamo:" + m.richiamo : "modificata");
  const dopo = prima && m ? { ...prima, ...m } : m;
  tutto[id] = [{ id: Date.now(), chi, azione: az, prima, dopo, quando: new Date().toISOString() }, ...(tutto[id] ?? [])];
  scrivi("invito-ar:demo-storico", tutto);
}
