import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Box, CalendarPlus, Check, Copy, KeyRound, LayoutGrid, Lock, MapPin, Navigation, Plus, User, X } from "lucide-react";
import {
  DATA_EVENTO,
  IBAN,
  IBAN_DI_ESEMPIO,
  LUOGO,
  MAX_POSTI_PER_PRENOTAZIONE,
  ORARIO,
  SCONTO_FAMIGLIA,
  SPOSI,
  MODIFICHE_FINO,
  TESTI,
  dataBreve,
  dataEstesa,
  oraEvento,
} from "./config";
import { COLORI, ORDINE_SETTORI, POSTI_PER_ID, SETTORI, SUPPLEMENTI, TAVOLI, postiAutomatici, prezza, type Occupati, type Posto } from "./data/sala";
import {
  MODALITA_DEMO,
  ascoltaOccupati,
  caricaOccupati,
  cercaPrenotazione,
  declinaInvito,
  dimenticaMiaPrenotazione,
  leggiMiaPrenotazione,
  apriInvito,
  tokenDallUrl,
  InvitoGiaConfermato,
  ModificheChiuse,
  annullaPrenotazione,
  modificaPrenotazione,
  type InvitoAperto,
  ricordaMiaPrenotazione,
  salvaPrenotazione,
  type Ospite,
  type PrenotazioneSalvata,
} from "./lib/prenotazioni";
import { scaricaEventoCalendario, vibra } from "./lib/calendario";
import { Busta } from "./components/Busta";
import { IN_ANTEPRIMA } from "./lib/anteprima";
import { ElencoPosti } from "./components/ElencoPosti";
import { Angolo, Filigrana, Foglia, Stelle, useNumeroAnimato } from "./components/Ornamenti";
import type { AzioniSala } from "./components/Sala3D";

const Sala3D = lazy(() => import("./components/Sala3D"));
const ComeArrivare = lazy(() => import("./components/ComeArrivare"));

const PASSI = ["Invito", "Chi viene", "Biglietto"];
const VUOTO: Ospite = { nome: "", bambino: false };

function Passi({ step }: { step: number }) {
  return (
    <ol className="passi" aria-label="Avanzamento">
      {PASSI.map((t, i) => (
        <li key={t} className="passo" aria-current={i === step ? "step" : undefined}>
          <span className={"gemma-passo" + (i < step ? " fatto" : i === step ? " attivo" : "")}>
            <span>{i < step ? <Check size={11} strokeWidth={3} /> : i + 1}</span>
          </span>
          <span className="passo-lab" style={{ color: i === step ? COLORI.inchiostro : "#ADA795", fontWeight: i === step ? 600 : 400 }}>
            {t}
          </span>
          {i < PASSI.length - 1 && <span className="passo-linea" />}
        </li>
      ))}
    </ol>
  );
}

function CaricoSala() {
  return (
    <div className="scena scena-carico">
      <Foglia size={22} color={COLORI.salvia} />
      <p>Preparo la sala…</p>
    </div>
  );
}

/** Porta l'elenco a `n` persone: aggiunge righe vuote o toglie prima quelle senza nome, dal fondo. */
function ridimensiona(p: Ospite[], n: number): Ospite[] {
  if (n >= p.length) return [...p, ...Array.from({ length: n - p.length }, () => ({ ...VUOTO }))];
  const out = [...p];
  for (let i = out.length - 1; i >= 0 && out.length > n; i--) if (!out[i].nome.trim()) out.splice(i, 1);
  return out.slice(0, n);
}

/** "Tavolo B3 · posti 2, 3" oppure "Tavoli B3 (2, 3) e C1 (4)" */
function descriviTavoli(sel: Posto[]) {
  const per = new Map<string, number[]>();
  sel.forEach((p) => per.set(p.tav, [...(per.get(p.tav) ?? []), p.num]));
  const t = [...per.entries()];
  if (t.length === 1) return `Tavolo ${t[0][0]} · ${t[0][1].length === 1 ? "posto" : "posti"} ${t[0][1].join(", ")}`;
  return "Tavoli " + t.map(([c, n]) => `${c} (${n.join(", ")})`).join(", ").replace(/, ([^,]*)$/, " e $1");
}

export default function App() {
  // calcolati qui (non al caricamento del file): le impostazioni arrivano dal database prima del primo disegno
  const SCONTO_PCT = Math.round(SCONTO_FAMIGLIA * 100);
  // prenotazione ricordata da questo browser (localStorage), ricontrollata sul database all'avvio
  const [salvata, setSalvata] = useState(leggiMiaPrenotazione);
  const [altroCodice, setAltroCodice] = useState(false);
  const [busta, setBusta] = useState(true);
  const [step, setStep] = useState(0);
  // una persona per posto, nello stesso ordine
  const [persone, setPersone] = useState<Ospite[]>([]);
  const [selezione, setSelezione] = useState<Posto[]>([]);
  // le sedie le sceglie il sito; diventano "manuali" se l'invitato le sceglie in sala
  const [manuale, setManuale] = useState(false);
  const [sala, setSala] = useState(false);
  const primaDellaSala = useRef<Posto[]>([]);
  const [supplementi, setSupplementi] = useState<string[]>([]);
  const [nome, setNome] = useState("");
  const [contatto, setContatto] = useState("");
  const [note, setNote] = useState("");
  const [mostraNote, setMostraNote] = useState(false);
  const [mostraContatto, setMostraContatto] = useState(false);
  const [erroreOspiti, setErroreOspiti] = useState(false);
  // "Purtroppo no"
  const [rispostaNo, setRispostaNo] = useState(false);
  const [notaNo, setNotaNo] = useState("");
  // l'invitato sta modificando una prenotazione già fatta
  const [originale, setOriginale] = useState<PrenotazioneSalvata | null>(null);
  const [chiediAnnullo, setChiediAnnullo] = useState(false);
  const [avviso, setAvviso] = useState("");
  const [vista, setVista] = useState<"3d" | "elenco">("3d");
  const [delta, setDelta] = useState<{ v: number; k: number } | null>(null);
  const [copiato, setCopiato] = useState(false);
  const [occupati, setOccupati] = useState<Occupati>(new Map());
  const [mappa, setMappa] = useState(false);
  const [invio, setInvio] = useState(false);
  const [confermata, setConfermata] = useState<PrenotazioneSalvata | null>(null);
  const [codiceCercato, setCodiceCercato] = useState("");
  const [cercando, setCercando] = useState(false);
  const [erroreCodice, setErroreCodice] = useState("");
  const [codiceCopiato, setCodiceCopiato] = useState(false);
  const azioniSala = useRef<AzioniSala | null>(null);
  // link personale ?i=TOKEN
  const token = useMemo(tokenDallUrl, []);
  const [invito, setInvito] = useState<InvitoAperto | null>(null);
  const [invitoNonValido, setInvitoNonValido] = useState(false);

  const caricaInvito = useCallback(async () => {
    if (!token) return;
    try {
      const r = await apriInvito(token);
      if (!r || r === "revocato") {
        setInvitoNonValido(true);
        return;
      }
      setInvito(r);
      setNome((n) => n || r.nome);
      if (r.prenotazione) {
        ricordaMiaPrenotazione(r.prenotazione);
        setSalvata(r.prenotazione);
      }
    } catch {
      /* senza rete l'invito funziona come link generico */
    }
  }, [token]);
  useEffect(() => {
    caricaInvito();
  }, [caricaInvito]);

  // se la prenotazione ricordata è stata cancellata dal database, la dimentichiamo
  useEffect(() => {
    const ricordata = leggiMiaPrenotazione();
    if (!ricordata) return;
    cercaPrenotazione(ricordata.codice)
      .then((p) => {
        if (p) {
          ricordaMiaPrenotazione(p);
          setSalvata(p);
        } else {
          dimenticaMiaPrenotazione();
          setSalvata(null);
        }
      })
      .catch(() => {
        /* senza rete teniamo quella ricordata */
      });
  }, []);

  // la sala 3D si scarica in sottofondo mentre si legge l'invito
  useEffect(() => {
    const t = setTimeout(() => import("./components/Sala3D"), 4000);
    return () => clearTimeout(t);
  }, []);

  // posti occupati: carica + tempo reale
  const aggiornaOccupati = useCallback(async () => {
    try {
      setOccupati(await caricaOccupati());
    } catch {
      setAvviso("Non riesco a leggere la sala. Controllate la connessione e riprovate.");
    }
  }, []);
  useEffect(() => {
    aggiornaOccupati();
    const stop = ascoltaOccupati(aggiornaOccupati);
    const visibile = () => document.visibilityState === "visible" && aggiornaOccupati();
    document.addEventListener("visibilitychange", visibile);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", visibile);
    };
  }, [aggiornaOccupati]);

  // durante una modifica le sedie della propria prenotazione risultano libere
  const occupatiVisibili = useMemo(() => {
    if (!originale) return occupati;
    const m = new Map(occupati);
    originale.posti.forEach((id) => m.delete(id));
    return m;
  }, [occupati, originale]);

  /** Sedie per `n` persone partendo da quelle attuali. */
  const sediePer = (n: number, sel: Posto[], scelteAMano: boolean): Posto[] => {
    if (!scelteAMano) return postiAutomatici(occupatiVisibili, n) ?? sel.slice(0, n);
    if (n <= sel.length) return sel.slice(0, n);
    const presi: Occupati = new Map(occupatiVisibili);
    sel.forEach((p) => presi.set(p.id, ""));
    return [...sel, ...(postiAutomatici(presi, n - sel.length) ?? [])];
  };

  // se qualcun altro prende una sedia che avevo, ne trovo un'altra
  useEffect(() => {
    if (confermata || !selezione.some((p) => occupatiVisibili.has(p.id))) return;
    const tenute = selezione.filter((p) => !occupatiVisibili.has(p.id));
    if (sala) {
      setSelezione(tenute);
      setAvviso("Qualcuno è stato più veloce: una sedia che avevate scelto non è più libera.");
      return;
    }
    setSelezione(sediePer(selezione.length, tenute, manuale));
  }, [occupatiVisibili]); // eslint-disable-line react-hooks/exhaustive-deps

  const giorni = Math.max(0, Math.ceil((DATA_EVENTO.getTime() - Date.now()) / 864e5));
  const modificheAperte = !MODIFICHE_FINO || Date.now() < MODIFICHE_FINO.getTime();
  const fineModifiche = MODIFICHE_FINO?.toLocaleDateString("it-IT", { day: "numeric", month: "long" });
  const prezzati = useMemo(() => prezza(selezione), [selezione]);
  const subtotale = prezzati.reduce((s, p) => s + p.scontato, 0);
  const extra = SUPPLEMENTI.filter((s) => supplementi.includes(s.id)).reduce((s, x) => s + x.p, 0);
  const risparmio = prezzati.reduce((s, p) => s + (p.pieno - p.scontato), 0);
  const totale = subtotale + extra;
  const totaleAnimato = useNumeroAnimato(totale);
  const totalePrec = useRef(totale);
  const n = persone.length;
  const nomeDerivato = persone[0]?.nome.trim() ? persone[0].nome.trim() + (n > 1 ? ` + ${n - 1}` : "") : "";
  const nomeFinale = nome.trim() || nomeDerivato;

  useEffect(() => {
    if (!avviso) return;
    const t = setTimeout(() => setAvviso(""), 4200);
    return () => clearTimeout(t);
  }, [avviso]);

  useEffect(() => {
    const d = totale - totalePrec.current;
    totalePrec.current = totale;
    if (d > 0 && !confermata) {
      setDelta({ v: d, k: Date.now() });
      const t = setTimeout(() => setDelta(null), 1300);
      return () => clearTimeout(t);
    }
  }, [totale]); // eslint-disable-line react-hooks/exhaustive-deps

  const vaiA = (s: number) => {
    setStep(s);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ------------------------------------------------------------ persone
  const impostaPersone = (quante: number) => {
    const q = Math.min(MAX_POSTI_PER_PRENOTAZIONE, Math.max(1, quante));
    if (q === n && selezione.length === q) return;
    vibra(10);
    setPersone((p) => ridimensiona(p, q));
    setSelezione(sediePer(q, selezione, manuale));
    setErroreOspiti(false);
  };

  const togliPersona = (i: number) => {
    if (n <= 1) return;
    vibra(10);
    setPersone((p) => p.filter((_, j) => j !== i));
    const resto = selezione.filter((_, j) => j !== i);
    setSelezione(manuale ? resto : sediePer(n - 1, resto, false));
  };

  const aggiornaPersona = (i: number, m: Partial<Ospite>) => {
    setPersone((p) => p.map((o, j) => (j === i ? { ...o, ...m } : o)));
    if (erroreOspiti) setErroreOspiti(false);
  };

  const inizia = () => {
    const previste = Math.min(MAX_POSTI_PER_PRENOTAZIONE, Math.max(1, invito?.persone_previste ?? 2));
    if (!persone.length) {
      setPersone(ridimensiona([], previste));
      setSelezione(sediePer(previste, [], false));
      setManuale(false);
    }
    setRispostaNo(false);
    vaiA(1);
    // il primo nome: la tastiera si apre da sola sui computer, non sui telefoni
    if (window.matchMedia("(hover:hover) and (pointer:fine)").matches) setTimeout(() => document.getElementById("ospite-0")?.focus(), 450);
  };

  // ------------------------------------------------------------ sala (facoltativa)
  const apriSala = () => {
    primaDellaSala.current = selezione;
    setSala(true);
    import("./components/Sala3D");
    const t = TAVOLI.find((x) => x.cod === selezione[0]?.tav);
    if (t) setTimeout(() => azioniSala.current?.vaiATavolo(t.x, t.z), 700);
  };

  const chiudiSala = (tieni: boolean) => {
    setSala(false);
    if (!tieni || !selezione.length) {
      setSelezione(primaDellaSala.current);
      return;
    }
    if (selezione.map((p) => p.id).join() === primaDellaSala.current.map((p) => p.id).join()) return;
    setManuale(true);
    if (selezione.length !== n) {
      setPersone((p) => ridimensiona(p, selezione.length));
      setAvviso(selezione.length > n ? `Avete scelto ${selezione.length} sedie: ho aggiunto ${selezione.length - n === 1 ? "un nome" : "dei nomi"} da scrivere.` : `Ora siete in ${selezione.length}.`);
    }
  };

  useEffect(() => {
    if (!sala) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && chiudiSala(false);
    window.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", esc);
      document.body.style.overflow = "";
    };
  }, [sala]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = useCallback((id: string) => {
    const p = POSTI_PER_ID.get(id);
    if (!p) return;
    vibra(12);
    setSelezione((sel) => {
      if (sel.some((s) => s.id === id)) return sel.filter((s) => s.id !== id);
      if (sel.length >= MAX_POSTI_PER_PRENOTAZIONE) {
        setAvviso(`Massimo ${MAX_POSTI_PER_PRENOTAZIONE} posti per prenotazione.`);
        return sel;
      }
      return [...sel, p];
    });
  }, []);

  // ------------------------------------------------------------ passi
  const avanti = () => {
    const vuoto = persone.findIndex((o) => !o.nome.trim());
    if (vuoto >= 0) {
      setErroreOspiti(true);
      document.getElementById("ospite-" + vuoto)?.focus();
      return;
    }
    if (selezione.length !== n) {
      const s = sediePer(n, selezione, manuale);
      if (s.length !== n) {
        setAvviso("Non trovo abbastanza sedie libere in sala. Provate a sceglierle voi.");
        return;
      }
      setSelezione(s);
    }
    setErroreOspiti(false);
    vaiA(2);
  };

  const indietro = () => {
    if (originale && step === 1) annullaModifica();
    else vaiA(Math.max(0, step - 1));
  };

  const copiaIban = () => {
    navigator.clipboard?.writeText(IBAN.replace(/\s/g, "")).catch(() => {});
    setCopiato(true);
    setTimeout(() => setCopiato(false), 2200);
  };

  const datiAttuali = () => ({
    nome: nomeFinale,
    contatto: contatto.trim(),
    note: note.trim(),
    posti: selezione.map((s) => s.id),
    ospiti: persone.map((o) => ({ nome: o.nome.trim(), bambino: o.bambino })),
    supplementi,
    totale,
  });

  const conferma = async () => {
    if (invio || confermata) return;
    if (IN_ANTEPRIMA) {
      setAvviso("Anteprima: le conferme non vengono salvate.");
      return;
    }
    if (originale) return salvaModifiche();
    setInvio(true);
    try {
      const p = await salvaPrenotazione({ ...datiAttuali(), invito: invito ? token : null });
      vibra([10, 40, 10, 40, 30]);
      setConfermata(p);
      ricordaMiaPrenotazione(p);
      setSalvata(p);
      aggiornaOccupati();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      if (e instanceof InvitoGiaConfermato) {
        await caricaInvito();
        vaiA(0);
        setAvviso("Per questo invito c'è già una risposta: la trovate qui.");
      } else {
        setAvviso("Non sono riuscito a salvare la conferma. Controllate la connessione e riprovate.");
      }
    } finally {
      setInvio(false);
    }
  };

  const salvaModifiche = async () => {
    if (!originale) return;
    setInvio(true);
    try {
      const dati = datiAttuali();
      await modificaPrenotazione(originale.codice, dati);
      const stato = originale.stato === "annullata" ? (invito ? "confermata" : "da_verificare") : originale.stato;
      const agg: PrenotazioneSalvata = { ...originale, ...dati, stato };
      vibra([10, 40, 10]);
      ricordaMiaPrenotazione(agg);
      setSalvata(agg);
      setConfermata(agg);
      setOriginale(null);
      setAvviso(originale.stato === "annullata" ? "Che bella notizia! Vi aspettiamo." : "Modifiche salvate. Grazie!");
      aggiornaOccupati();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setAvviso(e instanceof ModificheChiuse ? `Le modifiche si sono chiuse il ${fineModifiche}: scriveteci e sistemiamo noi.` : "Non sono riuscito a salvare le modifiche. Riprovate.");
    } finally {
      setInvio(false);
    }
  };

  const declina = async () => {
    if (!token || invio) return;
    if (IN_ANTEPRIMA) {
      setAvviso("Anteprima: le risposte non vengono salvate.");
      return;
    }
    setInvio(true);
    try {
      const p = await declinaInvito(token, nome.trim() || invito?.nome || "", notaNo);
      vibra(20);
      ricordaMiaPrenotazione(p);
      setSalvata(p);
      setRispostaNo(false);
      setNotaNo("");
      setAvviso("Grazie per avercelo detto. Ci mancherete!");
    } catch (e) {
      if (e instanceof InvitoGiaConfermato) {
        await caricaInvito();
        setRispostaNo(false);
        setAvviso("Per questo invito c'è già una conferma: la trovate qui.");
      } else {
        setAvviso("Non sono riuscito a inviare la risposta. Riprovate.");
      }
    } finally {
      setInvio(false);
    }
  };

  /** Riapre una prenotazione (anche un "no") per cambiarla. */
  const iniziaModifica = (p: PrenotazioneSalvata | null = confermata) => {
    if (!p) return;
    setOriginale(p);
    setConfermata(null);
    setChiediAnnullo(false);
    setNome(p.nome);
    setContatto(p.contatto);
    setSupplementi(p.supplementi);
    if (p.posti.length) {
      setSelezione(p.posti.map((id) => POSTI_PER_ID.get(id)).filter((x): x is Posto => !!x));
      setPersone(ridimensiona(p.ospiti ?? [], p.posti.length));
      setNote(p.note);
      setMostraNote(!!p.note);
      setManuale(true);
    } else {
      // aveva detto di no: si riparte come una risposta nuova (la nota era il messaggio agli sposi)
      const previste = Math.min(MAX_POSTI_PER_PRENOTAZIONE, Math.max(1, invito?.persone_previste ?? 2));
      setPersone(ridimensiona([], previste));
      setSelezione(postiAutomatici(occupati, previste) ?? []);
      setNote("");
      setManuale(false);
    }
    vaiA(1);
  };

  const annullaModifica = () => {
    const o = originale;
    setOriginale(null);
    if (o?.posti.length) apriPrenotazione(o);
    else {
      setPersone([]);
      setSelezione([]);
      vaiA(0);
    }
  };

  const annullaPresenza = async () => {
    if (!confermata || invio) return;
    setInvio(true);
    try {
      await annullaPrenotazione(confermata.codice);
      const agg: PrenotazioneSalvata = { ...confermata, stato: "annullata" };
      ricordaMiaPrenotazione(agg);
      setSalvata(agg);
      setConfermata(agg);
      setChiediAnnullo(false);
      aggiornaOccupati();
      setAvviso("Presenza annullata. Ci mancherete!");
    } catch (e) {
      setAvviso(e instanceof ModificheChiuse ? `Le modifiche si sono chiuse il ${fineModifiche}: scriveteci.` : "Non sono riuscito ad annullare. Riprovate.");
    } finally {
      setInvio(false);
    }
  };

  const apriPrenotazione = (p: PrenotazioneSalvata) => {
    if (!p.posti.length) return vaiA(0);
    setSelezione(p.posti.map((id) => POSTI_PER_ID.get(id)).filter((x): x is Posto => !!x));
    setPersone(ridimensiona(p.ospiti ?? [], p.posti.length));
    setSupplementi(p.supplementi);
    setNome(p.nome);
    setContatto(p.contatto);
    setNote(p.note);
    setManuale(true);
    setConfermata(p);
    vaiA(2);
  };

  const ritrova = async (e: FormEvent) => {
    e.preventDefault();
    if (cercando) return;
    setErroreCodice("");
    setCercando(true);
    try {
      const p = await cercaPrenotazione(codiceCercato);
      if (!p) {
        setErroreCodice("Nessuna prenotazione con questo codice. Lo trovate nel biglietto, tipo AR-7KQ2MX.");
        return;
      }
      ricordaMiaPrenotazione(p);
      setSalvata(p);
      setAltroCodice(false);
      setCodiceCercato("");
      apriPrenotazione(p);
    } catch {
      setErroreCodice("Non riesco a cercare in questo momento. Controllate la connessione e riprovate.");
    } finally {
      setCercando(false);
    }
  };

  /** Dal link generico: un'altra famiglia risponde dallo stesso telefono. */
  const rispostaNuova = () => {
    setConfermata(null);
    setSupplementi([]);
    setNome("");
    setContatto("");
    setNote("");
    setMostraNote(false);
    setAltroCodice(false);
    const previste = 2;
    setPersone(ridimensiona([], previste));
    setSelezione(postiAutomatici(occupati, previste) ?? []);
    setManuale(false);
    vaiA(1);
  };

  const copiaCodice = () => {
    if (!confermata) return;
    navigator.clipboard?.writeText(confermata.codice).catch(() => {});
    setCodiceCopiato(true);
    setTimeout(() => setCodiceCopiato(false), 2200);
  };

  const calendario = () =>
    scaricaEventoCalendario(
      selezione.length && confermata
        ? `Prenotazione di ${nomeFinale}: ${persone.map((o) => o.nome).join(", ")}.`
        : `${SPOSI.lui} & ${SPOSI.lei} si sposano.`,
    );

  const bloccata = !!confermata;
  const annullata = confermata?.stato === "annullata";
  const mia = confermata ?? salvata;
  const miaNo = !!mia && mia.stato === "annullata" && !mia.posti.length;
  const s0 = prezzati[0] ? SETTORI[prezzati[0].set] : SETTORI.centro;
  // prezza() ordina per prezzo: i nomi seguono la sedia, non la posizione
  const personaDi = new Map(selezione.map((p, i) => [p.id, persone[i]]));
  const settoriScelti = [...new Set(selezione.map((p) => SETTORI[p.set].nome))];
  const dataCorta = DATA_EVENTO.toLocaleDateString("it-IT", { day: "numeric", month: "long" });

  // pulsante principale della barra in basso
  const principale: { testo: string; azione: () => void; off?: boolean } | null =
    step === 0
      ? mia && !altroCodice
        ? miaNo
          ? modificheAperte
            ? { testo: "Abbiamo cambiato idea", azione: () => iniziaModifica(mia) }
            : null
          : { testo: "Il vostro biglietto", azione: () => apriPrenotazione(mia) }
        : rispostaNo
          ? null
          : { testo: "Rispondi all'invito", azione: inizia }
      : step === 1
        ? { testo: "Vedi il biglietto", azione: avanti }
        : !bloccata
          ? { testo: invio ? (originale ? "Salvo…" : "Confermo…") : originale ? "Salva" : "Conferma", azione: conferma, off: invio }
          : null;

  return (
    <div className="app">
      {busta && <Busta onFine={() => setBusta(false)} destinatario={invito?.nome} />}

      <header className="barra-alta">
        <div className="contenitore barra-alta-in">
          <span className="marchio">
            <Foglia size={13} color={COLORI.oro} /> {SPOSI.iniziali.replace("&", " & ")} · {dataBreve()}
          </span>
          <Passi step={step === 2 && bloccata && !annullata ? 3 : step} />
        </div>
      </header>

      <main className="contenitore corpo">
        <div className="anim-entra" key={step + (bloccata ? "-ok" : "")}>
          {originale && step > 0 && (
            <div className="banda-modifica">
              <span>{originale.posti.length ? <>State modificando la prenotazione <b>{originale.codice}</b></> : "Che bello, ci avete ripensato!"}</span>
              <button className="link" onClick={annullaModifica}>
                Lascia com'era
              </button>
            </div>
          )}

          {/* ------------------------------------------------ 1 · invito */}
          {step === 0 && (
            <>
              <section className="card manifesto">
                <Angolo pos="tl" />
                <Angolo pos="tr" />
                <Angolo pos="br" />
                <Angolo pos="bl" />
                <Stelle n={18} />
                <div className="manifesto-in">
                  {invito && <p className="saluto">Ciao {invito.nome}</p>}
                  <p className="occhiello">{TESTI.occhiello}</p>
                  <Filigrana w={230} />
                  <h1 className="nomi">
                    {SPOSI.lui}
                    <span className="e">&amp;</span>
                    {SPOSI.lei}
                  </h1>
                  <p className="cognomi">{SPOSI.cognomi}</p>
                  <div className="sep">
                    <span />
                    <Foglia size={13} color={COLORI.oro} />
                    <span />
                  </div>
                  <p className="data">{dataEstesa()}</p>
                  <p className="sotto-data">{ORARIO}</p>
                  <p className="claim">{TESTI.claim}</p>
                  <div className="listino">
                    {ORDINE_SETTORI.slice()
                      .reverse()
                      .map((k, i) => {
                        const s = SETTORI[k];
                        return (
                          <div key={k} className="tessera" style={{ background: s.soft, animationDelay: `${0.08 * i}s` }}>
                            <Foglia size={13} color={s.col} />
                            <p className="tessera-tag" style={{ color: s.col }}>
                              {s.tag}
                            </p>
                            <p className="tessera-prezzo" style={{ color: s.col }}>
                              {s.prezzo} €
                            </p>
                          </div>
                        );
                      })}
                  </div>
                  <p className="nota-gioco">{TESTI.nota_gioco}</p>
                </div>
              </section>

              {invitoNonValido && (
                <section className="card nota-invalido">
                  <p className="t">Questo link personale non è più valido</p>
                  <p className="d">Potete comunque rispondere da qui, oppure scriveteci: sistemiamo noi.</p>
                </section>
              )}

              {mia && !altroCodice ? (
                miaNo ? (
                  <section className="card risposta">
                    <p className="t">Ci avete detto che non potete venire</p>
                    <p className="d">
                      Ci mancherete, {mia.nome}! {modificheAperte ? `Se cambiate idea, c'è posto fino al ${fineModifiche}.` : "Per qualsiasi cosa scriveteci."}
                    </p>
                    {modificheAperte && (
                      <div className="risposta-azioni">
                        <button className="btn btn-scuro" onClick={() => iniziaModifica(mia)}>
                          Abbiamo cambiato idea
                        </button>
                      </div>
                    )}
                  </section>
                ) : (
                  <section className="card nota-famiglia nota-salvata">
                    <div className="pastiglia" style={{ background: mia.stato === "annullata" ? "#8B8B85" : COLORI.bosco }}>
                      <Check size={15} color={COLORI.carta} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="t">{mia.stato === "annullata" ? `Avete annullato la presenza, ${mia.nome}` : `Avete già risposto, ${mia.nome}`}</p>
                      <p className="d">
                        {mia.posti.length === 1 ? "1 persona" : `${mia.posti.length} persone`} · codice {mia.codice}
                      </p>
                    </div>
                    <div className="salvata-azioni">
                      <button className="bottoncino" onClick={() => apriPrenotazione(mia)}>
                        Biglietto
                      </button>
                      {!invito && (
                        <button className="link" onClick={() => setAltroCodice(true)}>
                          Altro codice?
                        </button>
                      )}
                    </div>
                  </section>
                )
              ) : (
                <section className="card risposta">
                  <p className="t">Ci sarete?</p>
                  <p className="d">Basta un minuto: ci dite chi viene e vi diamo il biglietto. Potrete cambiare tutto anche dopo.</p>
                  {!rispostaNo ? (
                    <div className="risposta-azioni">
                      <button className="btn btn-scuro" onClick={inizia}>
                        Sì, ci saremo
                      </button>
                      {invito && (
                        <button className="btn btn-chiaro" onClick={() => setRispostaNo(true)}>
                          Purtroppo no
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="risposta-no anim-entra">
                      <label htmlFor="nota-no" className="etichetta blocco">
                        Ci dispiace! Volete lasciarci due righe? · facoltativo
                      </label>
                      <textarea id="nota-no" className="campo campo-note" rows={3} maxLength={600} value={notaNo} onChange={(e) => setNotaNo(e.target.value)} placeholder="Un pensiero per gli sposi" autoFocus />
                      <div className="risposta-azioni">
                        <button className="btn btn-chiaro" onClick={() => setRispostaNo(false)} disabled={invio}>
                          Indietro
                        </button>
                        <button className="btn btn-scuro" onClick={declina} disabled={invio}>
                          {invio ? "Invio…" : "Invia la risposta"}
                        </button>
                      </div>
                    </div>
                  )}
                  {!invito && !altroCodice && (
                    <button className="link risposta-codice" onClick={() => setAltroCodice(true)}>
                      Avete già risposto? Ritrovate il biglietto con il codice
                    </button>
                  )}
                </section>
              )}

              {altroCodice && (
                <form className="card ritrova anim-entra" onSubmit={ritrova}>
                  <p className="t">
                    <KeyRound size={14} /> Avete già risposto?
                  </p>
                  <p className="d">Inserite il codice del biglietto per rivedere posti, luogo e informazioni.</p>
                  <div className="ritrova-riga">
                    <input
                      value={codiceCercato}
                      onChange={(e) => {
                        setCodiceCercato(e.target.value);
                        setErroreCodice("");
                      }}
                      placeholder="AR-7KQ2MX"
                      className="campo campo-codice"
                      aria-label="Codice della prenotazione"
                      autoCapitalize="characters"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      enterKeyHint="search"
                      maxLength={12}
                      autoFocus
                    />
                    <button type="submit" className="btn btn-chiaro" disabled={cercando || codiceCercato.trim().length < 6}>
                      {cercando ? "Cerco…" : "Apri"}
                    </button>
                  </div>
                  {erroreCodice && <p className="aiuto errore">{erroreCodice}</p>}
                  <div className="ritrova-piede">
                    <button type="button" className="link" onClick={() => setAltroCodice(false)}>
                      {mia ? `Torna alla prenotazione di ${mia.nome}` : "Chiudi"}
                    </button>
                    {mia && (
                      <button type="button" className="link" onClick={rispostaNuova}>
                        Rispondete per un'altra famiglia?
                      </button>
                    )}
                  </div>
                </form>
              )}

              <section className="card dove">
                <div className="dove-tx">
                  <p className="etichetta">
                    <MapPin size={12} style={{ verticalAlign: "-1px", marginRight: 6 }} />
                    Dove · tra {giorni} {giorni === 1 ? "giorno" : "giorni"}
                  </p>
                  <p className="valore">{LUOGO.nome}</p>
                  <p className="aiuto" style={{ marginTop: 2 }}>
                    {LUOGO.indirizzo}
                  </p>
                </div>
                <div className="dove-azioni">
                  <button className="btn btn-scuro" onClick={() => setMappa(true)}>
                    <Navigation size={15} /> Come arrivare
                  </button>
                  <button className="btn btn-chiaro" onClick={calendario}>
                    <CalendarPlus size={15} /> Calendario
                  </button>
                </div>
              </section>
            </>
          )}

          {/* ------------------------------------------------ 2 · chi viene */}
          {step === 1 && (
            <>
              <h2 className="titolo">
                <User size={17} /> Chi viene?
              </h2>
              <p className="intro">Un nome per ogni persona: ci serve per i segnaposto. Al resto pensiamo noi.</p>

              <div className="card ospiti">
                <div className="ospiti-testa">
                  <span className="t">Quante persone?</span>
                  <div className="stepper" role="group" aria-label="Quante persone">
                    <button onClick={() => impostaPersone(n - 1)} aria-label="Una persona in meno" disabled={n <= 1}>
                      −
                    </button>
                    <span aria-live="polite">{n}</span>
                    <button onClick={() => impostaPersone(n + 1)} aria-label="Una persona in più" disabled={n >= MAX_POSTI_PER_PRENOTAZIONE}>
                      +
                    </button>
                  </div>
                </div>
                {persone.map((o, i) => {
                  const manca = erroreOspiti && !o.nome.trim();
                  return (
                    <div key={i} className="ospite-riga">
                      <label htmlFor={"ospite-" + i} className="ospite-num">
                        {i + 1}
                      </label>
                      <input
                        id={"ospite-" + i}
                        value={o.nome}
                        onChange={(e) => aggiornaPersona(i, { nome: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const dopo = document.getElementById("ospite-" + (i + 1));
                            if (dopo) dopo.focus();
                            else (e.target as HTMLInputElement).blur();
                          }
                        }}
                        placeholder={i === 0 ? "Nome e cognome" : `Persona ${i + 1}`}
                        className="campo"
                        autoCapitalize="words"
                        autoComplete={i === 0 ? "name" : "off"}
                        enterKeyHint={i < n - 1 ? "next" : "done"}
                        maxLength={80}
                        aria-invalid={manca}
                        style={{ borderColor: manca ? SETTORI.vicino.col : undefined }}
                      />
                      <button type="button" className={"chip-bimbo" + (o.bambino ? " on" : "")} aria-pressed={o.bambino} onClick={() => aggiornaPersona(i, { bambino: !o.bambino })} title="Bambino">
                        {o.bambino && <Check size={12} strokeWidth={3} />} bimbo
                      </button>
                      {n > 1 ? (
                        <button type="button" className="ospite-togli" onClick={() => togliPersona(i)} aria-label={`Togli ${o.nome.trim() || `la persona ${i + 1}`}`}>
                          <X size={15} />
                        </button>
                      ) : (
                        <span />
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="aiuto" style={{ color: erroreOspiti ? SETTORI.vicino.col : undefined }}>
                {erroreOspiti ? "Manca qualche nome: serve per i segnaposto." : "Segnate «bimbo» per i più piccoli: pensiamo noi a menù e seggiolone."}
              </p>

              {!invito && (
                <>
                  <label htmlFor="nome" className="etichetta blocco">
                    Nome sul biglietto · facoltativo
                  </label>
                  <input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder={nomeDerivato || "Es. Famiglia Esposito"}
                    className="campo"
                    autoCapitalize="words"
                    maxLength={120}
                  />
                </>
              )}

              <div className="facoltativi">
                {mostraNote ? (
                  <div className="anim-entra">
                    <label htmlFor="note" className="etichetta blocco">
                      Allergie, intolleranze, esigenze
                    </label>
                    <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Es. Anna è celiaca, Luca non mangia pesce" className="campo campo-note" rows={3} maxLength={600} autoFocus={!note} />
                  </div>
                ) : (
                  <button className="aggiungi" onClick={() => setMostraNote(true)}>
                    <Plus size={15} /> Allergie o intolleranze?
                  </button>
                )}
                {!invito &&
                  (mostraContatto || contatto ? (
                    <div className="anim-entra">
                      <label htmlFor="contatto" className="etichetta blocco">
                        Telefono o email · per avvisarvi se cambia qualcosa
                      </label>
                      <input id="contatto" value={contatto} onChange={(e) => setContatto(e.target.value)} className="campo" autoComplete="tel" inputMode="email" maxLength={120} autoFocus={!contatto} />
                    </div>
                  ) : (
                    <button className="aggiungi" onClick={() => setMostraContatto(true)}>
                      <Plus size={15} /> Un recapito per avvisarvi
                    </button>
                  ))}
              </div>

              <section className="card tavolo">
                <div className="tavolo-tx">
                  <p className="etichetta">Il vostro tavolo · per gioco</p>
                  <p className="valore">{selezione.length ? descriviTavoli(selezione) : "Lo troviamo noi"}</p>
                  <p className="d">
                    {settoriScelti.length === 1 && <>{settoriScelti[0]} · </>}
                    {manuale ? "scelto da voi" : "scelto per voi"}
                    {risparmio > 0 && <> · sconto famiglia −{risparmio} €</>}
                  </p>
                </div>
                <button className="btn btn-chiaro" onClick={apriSala}>
                  <Box size={15} /> {manuale ? "Cambia" : "Sceglietelo voi"}
                </button>
              </section>
            </>
          )}

          {/* ------------------------------------------------ 3 · biglietto */}
          {step === 2 && prezzati.length > 0 && (
            <>
              {bloccata && !annullata ? (
                <section className="card fatto anim-entra">
                  <div className="pastiglia" style={{ background: COLORI.bosco }}>
                    <Check size={16} color={COLORI.carta} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p className="t">Fatto, vi aspettiamo!</p>
                    <p className="d">
                      {dataEstesa()} · ore {oraEvento()}
                      <br />
                      {LUOGO.nome}, {LUOGO.citta}
                    </p>
                  </div>
                </section>
              ) : !bloccata ? (
                <>
                  <h2 className="titolo">Ecco {prezzati.length === 1 ? "il vostro biglietto" : `i vostri ${prezzati.length} biglietti`}</h2>
                  <p className="intro">Controllate i nomi e confermate.{modificheAperte && fineModifiche ? ` Potrete cambiare tutto fino al ${fineModifiche}.` : ""}</p>
                </>
              ) : null}

              <div className={"card biglietto" + (bloccata ? " timbrato" : "")}>
                <Angolo pos="tl" />
                <Angolo pos="tr" />
                {bloccata && <div className={"timbro" + (annullata ? " timbro-annullato" : "")}>{annullata ? "Annullato" : "Confermato"}</div>}
                <div className="big-testa" style={{ background: s0.soft }}>
                  <div className="sigillo">
                    <span>{SPOSI.iniziali}</span>
                  </div>
                  <p className="occhiello" style={{ color: s0.col }}>
                    Ingresso per {prezzati.length} {prezzati.length === 1 ? "persona" : "persone"}
                  </p>
                  <p className="big-nomi">
                    {SPOSI.lui} &amp; {SPOSI.lei}
                  </p>
                  <p className="d">
                    {dataEstesa()} · ore {oraEvento()}
                  </p>
                  <p className="d">
                    {LUOGO.nome} · {LUOGO.citta}
                  </p>
                </div>
                <div className="big-corpo">
                  <div className="voce">
                    <span className="etichetta">Intestatario</span>
                    <span className="voce-p">{nomeFinale}</span>
                  </div>
                  {selezione.map((x) => prezzati.find((p) => p.id === x.id)!).map((p) => (
                    <div key={p.id} className="voce bordo">
                      <span className="voce-n">
                        <Foglia size={12} color={SETTORI[p.set].col} />
                        <span>
                          {personaDi.get(p.id)?.nome.trim() || `Tavolo ${p.tav} · posto ${p.num}`}
                          {personaDi.get(p.id)?.bambino && <em className="bimbo">bimbo</em>}
                          <i>
                            Tavolo {p.tav} · posto {p.num} · {SETTORI[p.set].nome}
                          </i>
                        </span>
                      </span>
                      <span className="voce-p">
                        {p.sconto && <s>{p.pieno} €</s>}
                        {p.scontato} €
                      </span>
                    </div>
                  ))}
                  {SUPPLEMENTI.filter((s) => supplementi.includes(s.id)).map((s) => (
                    <div key={s.id} className="voce bordo">
                      <span className="voce-n">{s.n}</span>
                      <span className="voce-p">+{s.p} €</span>
                    </div>
                  ))}
                  {note.trim() && (
                    <div className="voce bordo">
                      <span className="voce-n">
                        <span>
                          Note<i>{note.trim()}</i>
                        </span>
                      </span>
                    </div>
                  )}
                </div>
                <div className="strappo">
                  <span />
                  <Foglia size={12} color={COLORI.oro} />
                  <span />
                </div>
                <div className="big-piede">
                  <div className={"codice-barre" + (bloccata ? "" : " sbiadito")} aria-hidden="true">
                    {Array.from({ length: 46 }).map((_, i) => (
                      <span key={i} style={{ width: [1, 1, 2, 3][i % 4], height: i % 7 === 0 ? "100%" : "74%" }} />
                    ))}
                  </div>
                  <p className="codice">{confermata ? confermata.codice : "il codice arriva con la conferma"}</p>
                </div>
              </div>

              {!bloccata && (
                <>
                  {SUPPLEMENTI.length > 0 && (
                    <>
                      <p className="etichetta blocco">Un extra? · per gioco, facoltativo</p>
                      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                        {SUPPLEMENTI.map((s, i) => {
                          const on = supplementi.includes(s.id);
                          return (
                            <button
                              key={s.id}
                              onClick={() => setSupplementi((x) => (on ? x.filter((y) => y !== s.id) : [...x, s.id]))}
                              className="extra"
                              role="checkbox"
                              aria-checked={on}
                              style={{ borderTop: i ? `1px solid ${COLORI.linea}` : "none" }}
                            >
                              <span className={"spunta" + (on ? " on" : "")}>{on && <Check size={13} strokeWidth={3} />}</span>
                              <span className="extra-tx">
                                <span className="n">{s.n}</span>
                                <span className="d">{s.d}</span>
                              </span>
                              <span className="extra-p">+{s.p} €</span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                  <button onClick={conferma} disabled={invio} className="btn btn-largo btn-scuro" aria-live="polite">
                    {invio ? (originale ? "Salvo le modifiche…" : "Sto confermando…") : originale ? "Salva le modifiche" : "Confermiamo la nostra presenza"}
                  </button>
                  {originale && (
                    <button className="btn btn-chiaro btn-largo btn-secondo" onClick={annullaModifica} disabled={invio}>
                      Lascia tutto com'era
                    </button>
                  )}
                </>
              )}

              {bloccata && !annullata && (
                <>
                  <div className="dove-azioni dopo-conferma anim-entra">
                    <button className="btn btn-scuro" onClick={() => setMappa(true)}>
                      <Navigation size={15} /> Come arrivare
                    </button>
                    <button className="btn btn-chiaro" onClick={calendario}>
                      <CalendarPlus size={15} /> Calendario
                    </button>
                  </div>

                  <section className="card da-ricordare anim-entra">
                    <p className="etichetta">Da ricordare</p>
                    <ul>
                      {invito ? (
                        <li>
                          Per rivedere il biglietto o cambiare qualcosa, riaprite <b>questo stesso link</b>
                          {modificheAperte && fineModifiche ? ` (fino al ${fineModifiche})` : ""}.
                        </li>
                      ) : (
                        <li>
                          Il vostro codice è <b className="codice-inline">{confermata?.codice}</b>{" "}
                          <button onClick={copiaCodice} className="bottoncino">
                            {codiceCopiato ? <Check size={12} /> : <Copy size={12} />} {codiceCopiato ? "Copiato" : "Copia"}
                          </button>
                          <br />
                          Con il codice, da qualsiasi telefono, rivedete il biglietto e cambiate qualcosa{modificheAperte && fineModifiche ? ` fino al ${fineModifiche}` : ""}.
                        </li>
                      )}
                      <li>Il tavolo del biglietto è per gioco: quello vero lo trovate il giorno della festa.</li>
                      <li>La busta è facoltativa: se volete, i dati sono qui sotto.</li>
                    </ul>
                  </section>
                </>
              )}

              {bloccata && (
                <div className="card">
                  {!annullata && (
                    <>
                      <p className="etichetta">
                        <Lock size={12} style={{ verticalAlign: "-1px", marginRight: 6 }} />
                        La busta · facoltativa
                      </p>
                      <p className="sotto-etichetta">Intestato a</p>
                      <p className="valore">{SPOSI.intestatario}</p>
                      <p className="sotto-etichetta">IBAN</p>
                      <div className="iban-riga">
                        <code className="iban">{IBAN}</code>
                        <button onClick={copiaIban} className={"btn btn-scuro" + (copiato ? " btn-ok" : "")}>
                          {copiato ? <Check size={14} /> : <Copy size={14} />}
                          {copiato ? "Copiato" : "Copia IBAN"}
                        </button>
                      </div>
                      <p className="sotto-etichetta">Causale</p>
                      <p className="valore rompi">
                        Busta {nomeFinale} — {confermata?.codice}
                      </p>
                      <div className="totale">
                        <span className="etichetta">Importo del biglietto</span>
                        <span className="totale-v">{totale} €</span>
                      </div>
                      <div className="banda-oro">{TESTI.nota_pagamento}</div>
                      <p className="aiuto">{TESTI.nota_contanti}</p>
                    </>
                  )}
                  <div className={"modifiche" + (annullata ? " modifiche-sola" : "")}>
                    {annullata ? (
                      <>
                        <p className="t">Avete annullato la vostra presenza.</p>
                        {modificheAperte ? (
                          <>
                            <p className="d">Se cambiate idea, potete confermare di nuovo fino al {fineModifiche}.</p>
                            <button className="btn btn-scuro" onClick={() => iniziaModifica()}>
                              Abbiamo cambiato idea
                            </button>
                          </>
                        ) : (
                          <p className="d">Per qualsiasi cosa scriveteci: sistemiamo noi.</p>
                        )}
                      </>
                    ) : modificheAperte ? (
                      chiediAnnullo ? (
                        <>
                          <p className="t">Sicuri di non poter venire?</p>
                          <p className="d">La prenotazione viene annullata, ma potete ripensarci fino al {fineModifiche}.</p>
                          <div className="modifiche-azioni">
                            <button className="btn btn-chiaro" onClick={() => setChiediAnnullo(false)} disabled={invio}>
                              No, veniamo
                            </button>
                            <button className="btn btn-rosso" onClick={annullaPresenza} disabled={invio}>
                              {invio ? "Annullo…" : "Sì, annulla"}
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="t">Qualcosa è cambiato?</p>
                          <p className="d">Potete aggiungere o togliere persone e cambiare i nomi fino al {fineModifiche}.</p>
                          <div className="modifiche-azioni">
                            <button className="btn btn-chiaro" onClick={() => iniziaModifica()}>
                              Modifica
                            </button>
                            <button className="btn btn-chiaro btn-testo-rosso" onClick={() => setChiediAnnullo(true)}>
                              Non possiamo più venire
                            </button>
                          </div>
                        </>
                      )
                    ) : (
                      <p className="d">Le modifiche si sono chiuse il {fineModifiche}: per cambiare qualcosa scriveteci, sistemiamo noi.</p>
                    )}
                  </div>
                </div>
              )}
              {(MODALITA_DEMO || IBAN_DI_ESEMPIO) && (
                <p className="piedino">
                  {MODALITA_DEMO ? "Modalità demo · le conferme restano su questo dispositivo" : ""}
                  {MODALITA_DEMO && IBAN_DI_ESEMPIO ? " · " : ""}
                  {IBAN_DI_ESEMPIO ? "IBAN di esempio" : ""}
                </p>
              )}
            </>
          )}
        </div>
      </main>

      {avviso && (
        <div className="avviso anim-su" role="status" key={avviso}>
          {avviso}
        </div>
      )}

      {!sala && (
        <div className="barra-bassa">
          <div className="contenitore barra-bassa-in">
            {step > 0 && (
              <button onClick={bloccata ? () => vaiA(0) : indietro} aria-label={bloccata ? "Torna all'invito" : "Indietro"} className="btn btn-tondo">
                <ArrowLeft size={18} />
              </button>
            )}
            <div className="barra-info">
              {step === 0 ? (
                <>
                  <p className="k">{dataEstesa()}</p>
                  <p className="v2">{mia && !altroCodice ? (miaNo ? "Avete risposto: non venite" : `Avete risposto · ${mia.posti.length} ${mia.posti.length === 1 ? "persona" : "persone"}`) : `Mancano ${giorni} giorni`}</p>
                </>
              ) : bloccata ? (
                <>
                  <p className="k">{annullata ? "Presenza annullata" : `Confermato · ci vediamo il ${dataCorta}`}</p>
                  <p className="v2">{confermata?.codice}</p>
                </>
              ) : (
                <>
                  <p className="k">
                    {n} {n === 1 ? "persona" : "persone"}
                    {risparmio > 0 && (
                      <span className="pastiglia-sconto">
                        −{SCONTO_PCT}% · {risparmio} €
                      </span>
                    )}
                  </p>
                  <p className="v" aria-live="polite">
                    {totaleAnimato} €
                    {delta && (
                      <span key={delta.k} className="delta">
                        +{delta.v} €
                      </span>
                    )}
                  </p>
                </>
              )}
            </div>
            {principale && (
              <button onClick={principale.azione} disabled={principale.off} className="btn btn-scuro">
                {principale.testo}
                {step < 2 && <ArrowRight size={16} />}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------ sala, facoltativa */}
      {sala && (
        <div className="sala-scena" role="dialog" aria-modal="true" aria-label="Scegliete le sedie">
          <div className="contenitore largo sala-in">
            <div className="titolo-riga">
              <h2 className="titolo">
                <MapPin size={17} /> Scegliete le sedie
              </h2>
              <div className="toggle" role="tablist" aria-label="Vista">
                {(
                  [
                    ["3d", Box, "Sala 3D"],
                    ["elenco", LayoutGrid, "Elenco"],
                  ] as const
                ).map(([k, Icona, label]) => (
                  <button key={k} role="tab" aria-selected={vista === k} onClick={() => setVista(k)} aria-label={label} title={label} className={"toggle-b" + (vista === k ? " on" : "")}>
                    <Icona size={15} />
                  </button>
                ))}
              </div>
            </div>
            <p className="intro">
              È un gioco: toccate le sedie colorate per prenderle o lasciarle, quelle bianche sono già scelte. Dal secondo posto si paga il {SCONTO_PCT}% in meno. I tavoli veri li facciamo noi.
            </p>
            {vista === "3d" ? (
              <Suspense fallback={<CaricoSala />}>
                <Sala3D occupati={occupatiVisibili} selezione={selezione} onToggle={toggle} onAvviso={setAvviso} azioni={azioniSala} />
              </Suspense>
            ) : (
              <ElencoPosti occupati={occupatiVisibili} selezione={selezione} onToggle={toggle} onAvviso={setAvviso} />
            )}
          </div>
          <div className="barra-bassa">
            <div className="contenitore largo barra-bassa-in">
              <button onClick={() => chiudiSala(false)} aria-label="Lascia le sedie di prima" className="btn btn-tondo">
                <X size={18} />
              </button>
              <div className="barra-info">
                <p className="k">
                  {selezione.length} {selezione.length === 1 ? "sedia" : "sedie"} per {n} {n === 1 ? "persona" : "persone"}
                </p>
                <p className="v">{totaleAnimato} €</p>
              </div>
              <button onClick={() => chiudiSala(true)} disabled={!selezione.length} className={"btn btn-scuro" + (!selezione.length ? " btn-off" : "")}>
                <Check size={16} /> Fatto
              </button>
            </div>
          </div>
        </div>
      )}

      {mappa && (
        <Suspense fallback={<div className="mappa-scena mappa-carico">Apro la mappa…</div>}>
          <ComeArrivare onChiudi={() => setMappa(false)} />
        </Suspense>
      )}
    </div>
  );
}
