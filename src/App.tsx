import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Box, CalendarPlus, Check, Copy, KeyRound, LayoutGrid, Lock, MapPin, Navigation, User, X } from "lucide-react";
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
import {
  COLORI,
  ORDINE_SETTORI,
  POSTI_PER_ID,
  POSTI_PRENOTABILI,
  SETTORI,
  SUPPLEMENTI,
  prezza,
  trovaPostiVicini,
  type Occupati,
  type Posto,
} from "./data/sala";
import {
  MODALITA_DEMO,

  ascoltaOccupati,
  caricaOccupati,
  cercaPrenotazione,
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

const PASSI = ["Invito", "Posti", "Nome", "Biglietti"];

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

export default function App() {
  // calcolati qui (non al caricamento del file): le impostazioni arrivano dal database prima del primo disegno
  const SCONTO_PCT = Math.round(SCONTO_FAMIGLIA * 100);
  const PREZZI = ORDINE_SETTORI.map((k) => SETTORI[k].prezzo);
  // prenotazione ricordata da questo browser (localStorage), ricontrollata sul database all'avvio
  const [salvata, setSalvata] = useState(leggiMiaPrenotazione);
  const [altroCodice, setAltroCodice] = useState(false);
  const [busta, setBusta] = useState(true);
  const [step, setStep] = useState(0);
  const [selezione, setSelezione] = useState<Posto[]>([]);
  const [supplementi, setSupplementi] = useState<string[]>([]);
  const [nome, setNome] = useState("");
  const [contatto, setContatto] = useState("");
  const [note, setNote] = useState("");
  const [erroreNome, setErroreNome] = useState("");
  // nome di ogni ospite, per posto
  const [ospiti, setOspiti] = useState<Record<string, Ospite>>({});
  const [erroreOspiti, setErroreOspiti] = useState(false);
  // l'invitato sta modificando una prenotazione già fatta (Fase D)
  const [originale, setOriginale] = useState<PrenotazioneSalvata | null>(null);
  const [chiediAnnullo, setChiediAnnullo] = useState(false);
  const [avviso, setAvviso] = useState("");
  const [vista, setVista] = useState<"3d" | "elenco">("3d");
  const [quanti, setQuanti] = useState(2);
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
      if (r.persone_previste) setQuanti(Math.min(8, Math.max(1, r.persone_previste)));
      if (r.prenotazione && r.prenotazione.stato !== "annullata") {
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
    const t = setTimeout(() => import("./components/Sala3D"), 2500);
    return () => clearTimeout(t);
  }, []);

  // posti occupati: carica + tempo reale
  const aggiornaOccupati = useCallback(async () => {
    try {
      setOccupati(await caricaOccupati());
    } catch {
      setAvviso("Non riesco a leggere i posti liberi. Controllate la connessione e riprovate.");
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

  // se qualcun altro prende un posto che avevo scelto, lo tolgo
  useEffect(() => {
    if (confermata) return;
    setSelezione((sel) => {
      const persi = sel.filter((p) => occupatiVisibili.has(p.id));
      if (!persi.length) return sel;
      setAvviso(`Qualcuno è stato più veloce: ${persi.map((p) => `${p.tav}-${p.num}`).join(", ")} non è più libero.`);
      return sel.filter((p) => !occupatiVisibili.has(p.id));
    });
  }, [occupatiVisibili, confermata]);

  const giorni = Math.max(0, Math.ceil((DATA_EVENTO.getTime() - Date.now()) / 864e5));
  const liberi = POSTI_PRENOTABILI - occupati.size;
  const modificheAperte = !MODIFICHE_FINO || Date.now() < MODIFICHE_FINO.getTime();
  const fineModifiche = MODIFICHE_FINO?.toLocaleDateString("it-IT", { day: "numeric", month: "long" });
  const prezzati = useMemo(() => prezza(selezione), [selezione]);
  const subtotale = prezzati.reduce((s, p) => s + p.scontato, 0);
  const extra = SUPPLEMENTI.filter((s) => supplementi.includes(s.id)).reduce((s, x) => s + x.p, 0);
  const risparmio = prezzati.reduce((s, p) => s + (p.pieno - p.scontato), 0);
  const totale = subtotale + extra;
  const totaleAnimato = useNumeroAnimato(totale);
  const totalePrec = useRef(totale);

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
  }, [totale]);

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
      if (sel.length === 1) setAvviso(`Secondo posto aggiunto: da qui ogni persona ha il ${SCONTO_PCT}% di sconto.`);
      return [...sel, p];
    });
  }, []);

  const trovateVoi = () => {
    const r = trovaPostiVicini(occupatiVisibili, quanti);
    if (!r) {
      setAvviso(`Non c'è un tavolo con ${quanti} posti liberi affiancati. Provate con un numero più basso.`);
      return;
    }
    vibra([10, 30, 10]);
    setSelezione(r.posti);
    setAvviso(`Vi ho messi al tavolo ${r.tavolo.cod}, ${SETTORI[r.tavolo.set].nome.toLowerCase()}. Spostatevi pure se preferite.`);
    azioniSala.current?.vaiATavolo(r.tavolo.x, r.tavolo.z);
  };

  const vaiA = (n: number) => {
    setStep(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const nomeOspite = (id: string) => ospiti[id]?.nome.trim() ?? "";
  const avanti = () => {
    if (step === 2 && !nome.trim()) {
      setErroreNome("Serve un nome per il biglietto.");
      document.getElementById("nome")?.focus();
      return;
    }
    if (step === 2) {
      const vuoto = selezione.find((p) => !nomeOspite(p.id));
      if (vuoto) {
        setErroreOspiti(true);
        document.getElementById("ospite-" + vuoto.id)?.focus();
        return;
      }
    }
    if (step === 1) {
      // i nomi già scritti seguono le persone anche se hanno cambiato sedia
      setOspiti((o) => {
        const ids = selezione.map((p) => p.id);
        const avanzati = Object.entries(o).filter(([id, v]) => !ids.includes(id) && v.nome.trim()).map(([, v]) => v);
        const nuovo: Record<string, Ospite> = {};
        ids.forEach((id) => {
          const v = o[id]?.nome.trim() ? o[id] : avanzati.shift();
          if (v) nuovo[id] = v;
        });
        return nuovo;
      });
    }
    setErroreNome("");
    setErroreOspiti(false);
    vaiA(Math.min(3, step + 1));
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

  const conferma = async () => {
    if (invio || confermata) return;
    if (IN_ANTEPRIMA) {
      setAvviso("Anteprima: le conferme non vengono salvate.");
      return;
    }
    if (originale) return salvaModifiche();
    setInvio(true);
    try {
      const p = await salvaPrenotazione({
        nome: nome.trim(),
        contatto: contatto.trim(),
        note: note.trim(),
        posti: selezione.map((s) => s.id),
        ospiti: selezione.map((s) => ({ nome: nomeOspite(s.id), bambino: !!ospiti[s.id]?.bambino })),
        supplementi,
        totale,
        invito: invito ? token : null,
      });
      vibra([10, 40, 10, 40, 30]);
      setConfermata(p);
      ricordaMiaPrenotazione(p);
      setSalvata(p);
      aggiornaOccupati();
    } catch (e) {
      if (e instanceof InvitoGiaConfermato) {
        await caricaInvito();
        setSelezione([]);
        vaiA(0);
        setAvviso("Per questo invito c'è già una conferma: la trovate qui sotto.");
      } else {
        setAvviso("Non sono riuscito a salvare la conferma. Controllate la connessione e riprovate.");
      }
    } finally {
      setInvio(false);
    }
  };

  const datiAttuali = () => ({
    nome: nome.trim(),
    contatto: contatto.trim(),
    note: note.trim(),
    posti: selezione.map((s) => s.id),
    ospiti: selezione.map((s) => ({ nome: nomeOspite(s.id), bambino: !!ospiti[s.id]?.bambino })),
    supplementi,
    totale,
  });

  const salvaModifiche = async () => {
    if (!originale) return;
    setInvio(true);
    try {
      const dati = datiAttuali();
      await modificaPrenotazione(originale.codice, dati);
      const agg: PrenotazioneSalvata = { ...originale, ...dati, stato: originale.stato === "da_verificare" ? "da_verificare" : "confermata" };
      vibra([10, 40, 10]);
      ricordaMiaPrenotazione(agg);
      setSalvata(agg);
      setConfermata(agg);
      setOriginale(null);
      setAvviso("Modifiche salvate. Grazie!");
      aggiornaOccupati();
    } catch (e) {
      setAvviso(e instanceof ModificheChiuse ? `Le modifiche si sono chiuse il ${fineModifiche}: scriveteci e sistemiamo noi.` : "Non sono riuscito a salvare le modifiche. Riprovate.");
    } finally {
      setInvio(false);
    }
  };

  const iniziaModifica = () => {
    if (!confermata) return;
    setOriginale(confermata);
    setConfermata(null);
    setChiediAnnullo(false);
    vaiA(1);
  };

  const annullaModifica = () => {
    const o = originale;
    setOriginale(null);
    if (o) apriPrenotazione(o);
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
    setSelezione(p.posti.map((id) => POSTI_PER_ID.get(id)).filter((x): x is Posto => !!x));
    setSupplementi(p.supplementi);
    setNome(p.nome);
    setContatto(p.contatto);
    setNote(p.note);
    setOspiti(Object.fromEntries((p.ospiti ?? []).map((o, i) => [p.posti[i], o])));
    setConfermata(p);
    vaiA(3);
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

  const nuovaPrenotazione = () => {
    setConfermata(null);
    setSelezione([]);
    setSupplementi([]);
    setNome("");
    setContatto("");
    setNote("");
    setOspiti({});
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
      selezione.length
        ? `Prenotazione di ${nome.trim()}: ${prezzati.map((p) => `tavolo ${p.tav} posto ${p.num}`).join(", ")}.`
        : `${SPOSI.lui} & ${SPOSI.lei} si sposano.`,
    );

  const bloccata = !!confermata;
  const annullata = confermata?.stato === "annullata";
  const mia = confermata ?? salvata;
  const s0 = prezzati[0] ? SETTORI[prezzati[0].set] : SETTORI.centro;

  return (
    <div className="app">
      {busta && <Busta onFine={() => setBusta(false)} destinatario={invito?.nome} />}

      <header className="barra-alta">
        <div className={"contenitore barra-alta-in" + (step === 1 ? " largo" : "")}>
          <span className="marchio">
            <Foglia size={13} color={COLORI.oro} /> {SPOSI.iniziali.replace("&", " & ")} · {dataBreve()}
          </span>
          <Passi step={step} />
        </div>
      </header>

      <main className={"contenitore corpo" + (step === 1 ? " largo" : "")}>
        <div className="anim-entra" key={step}>
          {originale && step > 0 && (
            <div className="banda-modifica">
              <span>
                State modificando la prenotazione <b>{originale.codice}</b>
              </span>
              <button className="link" onClick={annullaModifica}>
                Lascia com'era
              </button>
            </div>
          )}
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
                </div>
              </section>

              {invitoNonValido && (
                <section className="card nota-invalido">
                  <p className="t">Questo link personale non è più valido</p>
                  <p className="d">Potete comunque confermare da qui, oppure scriveteci: sistemiamo noi.</p>
                </section>
              )}

              {mia && !altroCodice ? (
                <section className="card nota-famiglia nota-salvata">
                  <div className="pastiglia" style={{ background: COLORI.bosco }}>
                    <Check size={15} color={COLORI.carta} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="t">{mia.stato === "annullata" ? `Avete annullato la presenza, ${mia.nome}` : `Avete già confermato, ${mia.nome}`}</p>
                    <p className="d">
                      {mia.posti.length === 1 ? "1 persona" : `${mia.posti.length} persone`} · codice {mia.codice}
                    </p>
                  </div>
                  <div className="salvata-azioni">
                    <button className="bottoncino" onClick={() => apriPrenotazione(mia)}>
                      Biglietto
                    </button>
                    <button className="link" onClick={() => setAltroCodice(true)}>
                      Altro codice?
                    </button>
                  </div>
                </section>
              ) : (
                <form className="card ritrova" onSubmit={ritrova}>
                  <p className="t">
                    <KeyRound size={14} /> Avete già confermato?
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
                    />
                    <button type="submit" className="btn btn-chiaro" disabled={cercando || codiceCercato.trim().length < 6}>
                      {cercando ? "Cerco…" : "Apri"}
                    </button>
                  </div>
                  {erroreCodice && <p className="aiuto errore">{erroreCodice}</p>}
                  {mia && (
                    <button type="button" className="link" style={{ padding: 0, marginTop: 10 }} onClick={() => setAltroCodice(false)}>
                      Torna alla prenotazione di {mia.nome}
                    </button>
                  )}
                </form>
              )}

              <div className="griglia-due">
                <section className="card nota-famiglia">
                  <div className="pastiglia">
                    <Foglia size={15} color={COLORI.carta} />
                  </div>
                  <div>
                    <p className="t">Venite in famiglia?</p>
                    <p className="d">Scegliete più posti insieme: il primo a prezzo pieno, ogni persona in più con il {SCONTO_PCT}% di sconto.</p>
                  </div>
                </section>

                <section className="card riga-contatore">
                  <div>
                    <p className="t">{liberi} posti ancora liberi</p>
                    <p className="d">Mancano {giorni} giorni</p>
                  </div>
                  <span className="conteggio">{giorni}</span>
                </section>
              </div>

              <section className="card dove">
                <div className="dove-tx">
                  <p className="etichetta">
                    <MapPin size={12} style={{ verticalAlign: "-1px", marginRight: 6 }} />
                    Dove
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

          {step === 1 && (
            <div className="layout-posti">
              <div className="colonna-sala">
                <div className="titolo-riga">
                  <h2 className="titolo">
                    <MapPin size={17} /> Scegliete i posti
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
                  Le sedie colorate sono libere, quelle bianche già prese. Toccatene quante ne servono: dal secondo posto in poi si paga il {SCONTO_PCT}% in meno a persona.
                </p>
                {vista === "3d" ? (
                  <Suspense fallback={<CaricoSala />}>
                    <Sala3D occupati={occupatiVisibili} selezione={selezione} onToggle={toggle} onAvviso={setAvviso} azioni={azioniSala} />
                  </Suspense>
                ) : (
                  <ElencoPosti occupati={occupatiVisibili} selezione={selezione} onToggle={toggle} onAvviso={setAvviso} />
                )}
              </div>

              <aside className="colonna-lato">
                <div className="card gruppo">
                  <div className="gruppo-tx">
                    <p className="t">Quanti siete?</p>
                    <p className="d">Vi trovo posti liberi affiancati allo stesso tavolo.</p>
                  </div>
                  <div className="stepper" role="group" aria-label="Quante persone">
                    <button onClick={() => setQuanti((q) => Math.max(1, q - 1))} aria-label="Uno in meno">
                      −
                    </button>
                    <span aria-live="polite">{quanti}</span>
                    <button onClick={() => setQuanti((q) => Math.min(8, q + 1))} aria-label="Uno in più">
                      +
                    </button>
                  </div>
                  <button className="btn btn-scuro gruppo-btn" onClick={trovateVoi}>
                    Trovate voi
                  </button>
                </div>

                {prezzati.length > 0 ? (
                  <div className="card riepilogo anim-entra">
                    <div className="riepilogo-cap">
                      <span className="etichetta">
                        {prezzati.length} {prezzati.length === 1 ? "posto scelto" : "posti scelti"}
                      </span>
                      <button onClick={() => setSelezione([])} className="link">
                        Svuota
                      </button>
                    </div>
                    <div className="chips">
                      {prezzati.map((p) => (
                        <button key={p.id} onClick={() => toggle(p.id)} className="chip chip-sel" style={{ background: SETTORI[p.set].soft, color: SETTORI[p.set].col }} aria-label={`Togli ${p.tav}-${p.num}`}>
                          {p.tav}-{p.num} · {p.scontato} €{p.sconto ? ` (−${SCONTO_PCT}%)` : ""} <X size={13} />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="card legenda solo-largo">
                    {ORDINE_SETTORI.map((k) => (
                      <div key={k} className="legenda-riga">
                        <i style={{ background: SETTORI[k].col }} />
                        <span>{SETTORI[k].nome}</span>
                        <b style={{ color: SETTORI[k].col }}>{SETTORI[k].prezzo} €</b>
                      </div>
                    ))}
                  </div>
                )}
              </aside>
            </div>
          )}

          {step === 2 && (
            <>
              <h2 className="titolo">
                <User size={17} /> Chi siete
              </h2>
              <div className="card">
                <div className="riepilogo-cap">
                  <span className="etichetta">
                    {prezzati.length} {prezzati.length === 1 ? "posto" : "posti"} · {subtotale} €
                  </span>
                  <button onClick={() => vaiA(1)} className="bottoncino">
                    Modifica
                  </button>
                </div>
                <div className="lista-posti">
                  {prezzati.map((p) => (
                    <div key={p.id} className="voce">
                      <span className="voce-n">
                        <Foglia size={12} color={SETTORI[p.set].col} />
                        Tavolo {p.tav} · posto {p.num}
                      </span>
                      <span className="voce-p">
                        {p.sconto && <s>{p.pieno}</s>}
                        {p.scontato} €
                      </span>
                    </div>
                  ))}
                </div>
                {risparmio > 0 && <p className="banda-sconto">Sconto famiglia applicato: risparmiate {risparmio} €.</p>}
              </div>

              <label htmlFor="nome" className="etichetta blocco">
                {prezzati.length > 1 ? "Nome della famiglia o del gruppo" : "Nome e cognome"}
              </label>
              <input
                id="nome"
                value={nome}
                onChange={(e) => {
                  setNome(e.target.value);
                  setErroreNome("");
                }}
                placeholder={prezzati.length > 1 ? "Es. Famiglia Esposito" : "Es. Mario Rossi"}
                className="campo"
                autoComplete="name"
                autoCapitalize="words"
                enterKeyHint="next"
                maxLength={120}
                aria-invalid={!!erroreNome}
                style={{ borderColor: erroreNome ? SETTORI.vicino.col : undefined }}
              />
              <p className="aiuto" style={{ color: erroreNome ? SETTORI.vicino.col : undefined }}>
                {erroreNome || "Compare sul biglietto e nella causale."}
              </p>

              <p className="etichetta blocco">Chi viene · un nome per ogni posto</p>
              <div className="card ospiti">
                {selezione.map((p, i) => {
                  const o = ospiti[p.id] ?? { nome: "", bambino: false };
                  const manca = erroreOspiti && !o.nome.trim();
                  const aggiorna = (m: Partial<Ospite>) => {
                    setOspiti((x) => ({ ...x, [p.id]: { ...o, ...m } }));
                    if (erroreOspiti) setErroreOspiti(false);
                  };
                  return (
                    <div key={p.id} className="ospite-riga">
                      <label htmlFor={"ospite-" + p.id} className="ospite-posto">
                        <Foglia size={11} color={SETTORI[p.set].col} /> {p.tav}-{p.num}
                      </label>
                      <input
                        id={"ospite-" + p.id}
                        value={o.nome}
                        onChange={(e) => aggiorna({ nome: e.target.value })}
                        placeholder={i === 0 ? "Nome e cognome" : `Ospite ${i + 1}`}
                        className="campo"
                        autoCapitalize="words"
                        autoComplete="off"
                        enterKeyHint={i < selezione.length - 1 ? "next" : "done"}
                        maxLength={80}
                        aria-invalid={manca}
                        style={{ borderColor: manca ? SETTORI.vicino.col : undefined }}
                      />
                      <button type="button" className={"chip-bimbo" + (o.bambino ? " on" : "")} aria-pressed={o.bambino} onClick={() => aggiorna({ bambino: !o.bambino })} title="Bambino">
                        {o.bambino && <Check size={12} strokeWidth={3} />} bimbo
                      </button>
                    </div>
                  );
                })}
              </div>
              <p className="aiuto" style={{ color: erroreOspiti ? SETTORI.vicino.col : undefined }}>
                {erroreOspiti ? "Manca qualche nome: serve per i segnaposto." : "Segnate \"bimbo\" per i bambini: ci aiuta con il menù e i seggioloni."}
              </p>

              <label htmlFor="contatto" className="etichetta blocco">
                Telefono o email · facoltativo
              </label>
              <input
                id="contatto"
                value={contatto}
                onChange={(e) => setContatto(e.target.value)}
                placeholder="Per avvisarvi se cambia qualcosa"
                className="campo"
                autoComplete="tel"
                inputMode="email"
                maxLength={120}
              />

              <label htmlFor="note" className="etichetta blocco">
                Allergie, intolleranze · facoltativo
              </label>
              <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Es. Anna è celiaca, Luca non mangia pesce" className="campo campo-note" rows={3} maxLength={600} />

              <p className="etichetta blocco">Supplementi facoltativi · una volta per prenotazione</p>
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

          {step === 3 && prezzati.length > 0 && (
            <>
              <h2 className="titolo">{prezzati.length === 1 ? "Il vostro biglietto" : `I vostri ${prezzati.length} biglietti`}</h2>
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
                  <p className="d">{LUOGO.nome} · {LUOGO.citta}</p>
                </div>
                <div className="big-corpo">
                  <div className="voce">
                    <span className="etichetta">Intestatario</span>
                    <span className="voce-p">{nome.trim()}</span>
                  </div>
                  {prezzati.map((p) => (
                    <div key={p.id} className="voce bordo">
                      <span className="voce-n">
                        <Foglia size={12} color={SETTORI[p.set].col} />
                        {nomeOspite(p.id) ? (
                          <span>
                            {nomeOspite(p.id)}
                            {ospiti[p.id]?.bambino && <em className="bimbo">bimbo</em>}
                            <i>
                              Tavolo {p.tav} · posto {p.num} · {SETTORI[p.set].nome}
                            </i>
                          </span>
                        ) : (
                          <span>
                            Tavolo {p.tav} · posto {p.num}
                            <i>{SETTORI[p.set].nome}</i>
                          </span>
                        )}
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

              {confermata && (
                <div className="card card-codice anim-entra">
                  <div>
                    <p className="etichetta">
                      <KeyRound size={12} style={{ verticalAlign: "-1px", marginRight: 6 }} />
                      Il vostro codice
                    </p>
                    <p className="codice-grande">{confermata.codice}</p>
                    <p className="aiuto" style={{ marginTop: 4 }}>
                      Conservatelo: riaprendo l'invito da qualsiasi telefono ritrovate posti, luogo e IBAN.
                    </p>
                  </div>
                  <button onClick={copiaCodice} className={"btn " + (codiceCopiato ? "btn-ok" : "btn-chiaro")}>
                    {codiceCopiato ? <Check size={14} /> : <Copy size={14} />}
                    {codiceCopiato ? "Copiato" : "Copia"}
                  </button>
                </div>
              )}

              <div className="card">
                <p className="etichetta">
                  <Lock size={12} style={{ verticalAlign: "-1px", marginRight: 6 }} />
                  Salda la busta
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
                  Busta {nome.trim()}
                  {confermata ? ` — ${confermata.codice}` : ""}
                </p>
                {risparmio > 0 && (
                  <div className="voce" style={{ marginTop: 14 }}>
                    <span style={{ color: COLORI.soft }}>Sconto famiglia ({SCONTO_PCT}%)</span>
                    <span style={{ color: SETTORI.centro.col }}>− {risparmio} €</span>
                  </div>
                )}
                <div className="totale">
                  <span className="etichetta">Importo</span>
                  <span className="totale-v">{totale} €</span>
                </div>
                <div className="banda-oro">{TESTI.nota_pagamento}</div>
                <p className="aiuto">
                  {TESTI.nota_contanti}
                </p>
                <button onClick={conferma} disabled={invio || bloccata} className={"btn btn-largo " + (bloccata ? "btn-ok" : "btn-scuro")} aria-live="polite">
                  {bloccata ? (
                    annullata ? (
                      "Presenza annullata"
                    ) : (
                      <>
                        <Check size={16} /> Presenza confermata — ci vediamo il {DATA_EVENTO.toLocaleDateString("it-IT", { day: "numeric", month: "long" })}
                      </>
                    )
                  ) : invio ? (
                    originale ? "Salvo le modifiche…" : "Sto confermando…"
                  ) : originale ? (
                    "Salva le modifiche"
                  ) : (
                    "Confermiamo la nostra presenza"
                  )}
                </button>
                {originale && !bloccata && (
                  <button className="btn btn-chiaro btn-largo btn-secondo" onClick={annullaModifica} disabled={invio}>
                    Lascia tutto com'era
                  </button>
                )}
                {bloccata && !annullata && (
                  <div className="dove-azioni dopo-conferma anim-entra">
                    <button className="btn btn-chiaro" onClick={() => setMappa(true)}>
                      <Navigation size={15} /> Come arrivare
                    </button>
                    <button className="btn btn-chiaro" onClick={calendario}>
                      <CalendarPlus size={15} /> Aggiungi al calendario
                    </button>
                  </div>
                )}
                {bloccata && (
                  <div className="modifiche anim-entra">
                    {annullata ? (
                      <>
                        <p className="t">Avete annullato la vostra presenza.</p>
                        {modificheAperte ? (
                          <>
                            <p className="d">Se cambiate idea, potete confermare di nuovo fino al {fineModifiche}.</p>
                            <button className="btn btn-scuro" onClick={iniziaModifica}>
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
                          <p className="d">Potete aggiungere o togliere persone, cambiare nomi e posti fino al {fineModifiche}.</p>
                          <div className="modifiche-azioni">
                            <button className="btn btn-chiaro" onClick={iniziaModifica}>
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
                )}
              </div>
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

      <div className="barra-bassa">
        <div className={"contenitore barra-bassa-in" + (step === 1 ? " largo" : "")}>
          {step > 0 && !(step === 3 && bloccata) && (
            <button onClick={indietro} aria-label="Indietro" className="btn btn-tondo">
              <ArrowLeft size={18} />
            </button>
          )}
          {step === 3 && bloccata && (
            <button onClick={() => vaiA(0)} aria-label="Torna all'invito" className="btn btn-tondo">
              <ArrowLeft size={18} />
            </button>
          )}
          <div className="barra-info">
            {prezzati.length ? (
              <>
                <p className="k">
                  {prezzati.length} {prezzati.length === 1 ? "posto" : "posti"}
                  {risparmio > 0 && <span className="pastiglia-sconto">−{SCONTO_PCT}% · {risparmio} €</span>}
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
            ) : (
              <>
                <p className="k">{step === 0 ? `Da ${Math.min(...PREZZI)} a ${Math.max(...PREZZI)} €` : "Nessun posto scelto"}</p>
                <p className="v2">{step === 0 ? `${liberi} sedie libere su ${POSTI_PRENOTABILI}` : "Toccate una sedia libera"}</p>
              </>
            )}
          </div>
          {step < 3 && (
            <button onClick={step === 0 && mia ? nuovaPrenotazione : avanti} disabled={step === 1 && !prezzati.length} className={"btn btn-scuro" + (step === 1 && !prezzati.length ? " btn-off" : "")}>
              {step === 0 ? (mia ? "Nuova prenotazione" : "Scegli i posti") : step === 1 ? "Continua" : "Biglietti"}
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>

      {mappa && (
        <Suspense fallback={<div className="mappa-scena mappa-carico">Apro la mappa…</div>}>
          <ComeArrivare onChiudi={() => setMappa(false)} />
        </Suspense>
      )}
    </div>
  );
}
