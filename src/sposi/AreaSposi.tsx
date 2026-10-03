import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Download, LogOut, Mail, MessageCircle, Phone, RefreshCw, Search, X } from "lucide-react";
import { DATA_EVENTO, SPOSI } from "../config";
import { COLORI } from "../data/sala";
import { Foglia } from "../components/Ornamenti";
import { MODALITA_DEMO } from "../lib/supabase";
import { leggiContatto, linkChiamata, linkEmail, linkWhatsApp, telefonoLeggibile } from "../lib/contatti";
import { Accesso } from "./Accesso";
import {
  ETICHETTE_RICHIAMO,
  ETICHETTE_STATO,
  ascoltaCambi,
  caricaMatrimonio,
  caricaPrenotazioni,
  dataBreve,
  descriviPosti,
  nomeSupplemento,
  scaricaCsv,
  type Prenotazione,
  type Richiamo,
  type Stato,
} from "./dati";

type FiltroStato = Stato | "tutte";
type FiltroRichiamo = Richiamo | "tutti";

export function AreaSposi() {
  return <Accesso>{(sessione, esci) => <Pannello sessione={sessione} esci={esci} />}</Accesso>;
}

function Pannello({ sessione, esci }: { sessione: Session | null; esci: () => void }) {
  const [matrimonio, setMatrimonio] = useState<{ id: string } | null | undefined>(undefined);
  const [righe, setRighe] = useState<Prenotazione[] | null>(null);
  const [errore, setErrore] = useState("");
  const [caricando, setCaricando] = useState(false);
  const [cerca, setCerca] = useState("");
  const [stato, setStato] = useState<FiltroStato>("tutte");
  const [richiamo, setRichiamo] = useState<FiltroRichiamo>("tutti");

  useEffect(() => {
    caricaMatrimonio()
      .then(setMatrimonio)
      .catch(() => setErrore("Non riesco a leggere i dati. Controllate la connessione."));
  }, []);

  const ricarica = useCallback(async () => {
    if (!matrimonio) return;
    setCaricando(true);
    try {
      setRighe(await caricaPrenotazioni(matrimonio.id));
      setErrore("");
    } catch {
      setErrore("Non riesco a leggere le conferme. Controllate la connessione e riprovate.");
    } finally {
      setCaricando(false);
    }
  }, [matrimonio]);

  useEffect(() => {
    if (!matrimonio) return;
    ricarica();
    const stop = ascoltaCambi(ricarica);
    const visibile = () => document.visibilityState === "visible" && ricarica();
    document.addEventListener("visibilitychange", visibile);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", visibile);
    };
  }, [matrimonio, ricarica]);

  const totali = useMemo(() => {
    const r = righe ?? [];
    const conf = r.filter((p) => p.stato === "confermata");
    return {
      famiglie: conf.length,
      persone: conf.reduce((s, p) => s + p.persone, 0),
      daVerificare: r.filter((p) => p.stato === "da_verificare").length,
      annullate: r.filter((p) => p.stato === "annullata").length,
      daRisentire: conf.filter((p) => p.richiamo === "da_sentire").length,
      conNote: conf.filter((p) => p.note).length,
    };
  }, [righe]);

  const filtrate = useMemo(() => {
    const q = cerca.trim().toLowerCase();
    return (righe ?? []).filter((p) => {
      if (stato !== "tutte" && p.stato !== stato) return false;
      if (richiamo !== "tutti" && p.richiamo !== richiamo) return false;
      if (!q) return true;
      return [p.nome, p.contatto, p.note, p.nota_sposi, p.codice, p.posti.join(" ")].some((v) => v?.toLowerCase().includes(q));
    });
  }, [righe, cerca, stato, richiamo]);

  const giorni = Math.max(0, Math.ceil((DATA_EVENTO.getTime() - Date.now()) / 864e5));

  return (
    <div className="sposi">
      <header className="sposi-testa">
        <div className="sposi-contenitore sposi-testa-in">
          <span className="marchio">
            <Foglia size={13} color={COLORI.oro} /> {SPOSI.iniziali.replace("&", " & ")} · Area sposi
          </span>
          <span className="sposi-utente">
            {MODALITA_DEMO ? "modalità demo" : sessione?.user.email}
            {!MODALITA_DEMO && (
              <button className="cmd" onClick={esci} aria-label="Esci" title="Esci">
                <LogOut size={15} />
              </button>
            )}
          </span>
        </div>
      </header>

      <main className="sposi-contenitore sposi-corpo">
        {matrimonio === null ? (
          <div className="card vuoto">
            <p className="t">Questo account non è abilitato</p>
            <p className="d">L'accesso funziona, ma l'account non è collegato al matrimonio. Seguite il passo "registrarvi come sposi" del README.</p>
            <button className="btn btn-chiaro" onClick={esci}>
              Esci
            </button>
          </div>
        ) : (
          <>
            <div className="sposi-titolo">
              <h1 className="titolo">Conferme</h1>
              <p className="aiuto">Mancano {giorni} giorni</p>
            </div>

            <section className="contatori">
              <Contatore v={totali.persone} l="persone confermate" forte />
              <Contatore v={totali.famiglie} l="famiglie" />
              <Contatore v={totali.daRisentire} l="da risentire" onClick={() => (setStato("confermata"), setRichiamo("da_sentire"))} />
              <Contatore v={totali.daVerificare} l="da verificare" onClick={() => (setStato("da_verificare"), setRichiamo("tutti"))} />
              <Contatore v={totali.annullate} l="annullate" onClick={() => (setStato("annullata"), setRichiamo("tutti"))} />
              <Contatore v={totali.conNote} l="con note o allergie" />
            </section>

            <section className="strumenti">
              <label className="cerca">
                <Search size={16} />
                <input value={cerca} onChange={(e) => setCerca(e.target.value)} placeholder="Cerca nome, telefono, posto, codice…" aria-label="Cerca" />
                {cerca && (
                  <button className="mappa-x" onClick={() => setCerca("")} aria-label="Cancella ricerca">
                    <X size={14} />
                  </button>
                )}
              </label>
              <div className="filtri">
                <select value={stato} onChange={(e) => setStato(e.target.value as FiltroStato)} aria-label="Stato">
                  <option value="tutte">Tutti gli stati</option>
                  {(Object.keys(ETICHETTE_STATO) as Stato[]).map((s) => (
                    <option key={s} value={s}>
                      {ETICHETTE_STATO[s]}
                    </option>
                  ))}
                </select>
                <select value={richiamo} onChange={(e) => setRichiamo(e.target.value as FiltroRichiamo)} aria-label="Seconda conferma">
                  <option value="tutti">Seconda conferma: tutte</option>
                  {(Object.keys(ETICHETTE_RICHIAMO) as Richiamo[]).map((s) => (
                    <option key={s} value={s}>
                      {ETICHETTE_RICHIAMO[s]}
                    </option>
                  ))}
                </select>
                <button className="cmd" onClick={ricarica} aria-label="Aggiorna" title="Aggiorna">
                  <RefreshCw size={15} className={caricando ? "gira" : ""} />
                </button>
                <button className="btn btn-chiaro btn-piccolo" onClick={() => scaricaCsv(filtrate)} disabled={!filtrate.length}>
                  <Download size={15} /> CSV
                </button>
              </div>
            </section>

            {errore && <p className="aiuto errore">{errore}</p>}

            {righe === null ? (
              <p className="aiuto">Carico le conferme…</p>
            ) : filtrate.length === 0 ? (
              <div className="card vuoto">
                <p className="t">{righe.length ? "Nessuna conferma con questi filtri" : "Ancora nessuna conferma"}</p>
                {righe.length > 0 && (
                  <button className="link" onClick={() => (setCerca(""), setStato("tutte"), setRichiamo("tutti"))}>
                    Togli i filtri
                  </button>
                )}
              </div>
            ) : (
              <>
                <p className="aiuto conteggio-elenco">
                  {filtrate.length} {filtrate.length === 1 ? "prenotazione" : "prenotazioni"} · {filtrate.reduce((s, p) => s + p.persone, 0)} persone
                </p>
                <div className="elenco-conferme">
                  {filtrate.map((p) => (
                    <Riga key={p.id} p={p} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Contatore({ v, l, forte, onClick }: { v: number; l: string; forte?: boolean; onClick?: () => void }) {
  const C = onClick ? "button" : "div";
  return (
    <C className={"contatore" + (forte ? " forte" : "") + (onClick ? " cliccabile" : "")} onClick={onClick}>
      <span className="v">{v}</span>
      <span className="l">{l}</span>
    </C>
  );
}

function Riga({ p }: { p: Prenotazione }) {
  const c = leggiContatto(p.contatto);
  const posti = descriviPosti(p.posti);
  return (
    <article className={"card conferma stato-" + p.stato}>
      <div className="conferma-testa">
        <div style={{ minWidth: 0 }}>
          <h2 className="conferma-nome">{p.nome}</h2>
          <p className="aiuto" style={{ margin: 0 }}>
            {p.persone} {p.persone === 1 ? "persona" : "persone"} · {dataBreve(p.creata_il)}
          </p>
        </div>
        <div className="badge-gruppo">
          <span className={"badge badge-" + p.stato}>{ETICHETTE_STATO[p.stato]}</span>
          {p.stato === "confermata" && <span className={"badge badge-r-" + p.richiamo}>{ETICHETTE_RICHIAMO[p.richiamo]}</span>}
        </div>
      </div>

      <dl className="conferma-dati">
        <div>
          <dt>Posti</dt>
          <dd>
            {posti.elenco} <span className="aiuto">· {posti.settori}</span>
          </dd>
        </div>
        {p.note && (
          <div className="evidenza">
            <dt>Note</dt>
            <dd>{p.note}</dd>
          </div>
        )}
        {p.nota_sposi && (
          <div>
            <dt>Vostra nota</dt>
            <dd>{p.nota_sposi}</dd>
          </div>
        )}
        {p.supplementi.length > 0 && (
          <div>
            <dt>Supplementi</dt>
            <dd>{p.supplementi.map(nomeSupplemento).join(", ")}</dd>
          </div>
        )}
        <div>
          <dt>Codice</dt>
          <dd className="mono">{p.codice}</dd>
        </div>
      </dl>

      <div className="conferma-contatti">
        {c.telefono && (
          <>
            <a className="btn btn-chiaro btn-piccolo" href={linkChiamata(c.telefono)}>
              <Phone size={14} /> {telefonoLeggibile(c.telefono)}
            </a>
            <a className="btn btn-chiaro btn-piccolo" href={linkWhatsApp(c.telefono)} target="_blank" rel="noopener">
              <MessageCircle size={14} /> WhatsApp
            </a>
          </>
        )}
        {c.email && (
          <a className="btn btn-chiaro btn-piccolo" href={linkEmail(c.email)}>
            <Mail size={14} /> {c.email}
          </a>
        )}
        {!c.telefono && !c.email && <span className="aiuto">{p.contatto ? `Contatto: ${p.contatto}` : "Nessun contatto lasciato"}</span>}
      </div>
    </article>
  );
}
