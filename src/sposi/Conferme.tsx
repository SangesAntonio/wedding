import { useMemo, useState } from "react";
import { Check, Download, Mail, MessageCircle, Phone, RefreshCw, Search, X } from "lucide-react";
import { leggiContatto, linkChiamata, linkEmail, linkWhatsApp, telefonoLeggibile } from "../lib/contatti";
import {
  ETICHETTE_RICHIAMO,
  ETICHETTE_STATO,
  dataBreve,
  descriviPosti,
  nomeSupplemento,
  scaricaCsv,
  type Prenotazione,
  type Richiamo,
  type Stato,
} from "./dati";
import type { Invito } from "./inviti";

type FiltroStato = Stato | "tutte";
type FiltroRichiamo = Richiamo | "tutti";

interface Props {
  righe: Prenotazione[] | null;
  inviti: Invito[];
  caricando: boolean;
  onRicarica: () => void;
  onAggiorna: (id: string, modifiche: Partial<Prenotazione>) => Promise<void>;
}

export function Conferme({ righe, inviti, caricando, onRicarica, onAggiorna }: Props) {
  const [cerca, setCerca] = useState("");
  const [stato, setStato] = useState<FiltroStato>("tutte");
  const [richiamo, setRichiamo] = useState<FiltroRichiamo>("tutti");
  const invitiPerId = useMemo(() => new Map(inviti.map((i) => [i.id, i])), [inviti]);

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
      const invito = p.invito_id ? invitiPerId.get(p.invito_id)?.nome : "";
      return [p.nome, invito, p.contatto, p.note, p.nota_sposi, p.codice, p.posti.join(" ")].some((v) => v?.toLowerCase().includes(q));
    });
  }, [righe, cerca, stato, richiamo, invitiPerId]);

  const filtra = (s: FiltroStato, r: FiltroRichiamo) => {
    setStato(s);
    setRichiamo(r);
  };

  return (
    <>
      <section className="contatori">
        <Contatore v={totali.persone} l="persone confermate" forte />
        <Contatore v={totali.famiglie} l="famiglie" />
        <Contatore v={totali.daRisentire} l="da risentire" onClick={() => filtra("confermata", "da_sentire")} />
        <Contatore v={totali.daVerificare} l="da verificare" onClick={() => filtra("da_verificare", "tutti")} avviso={totali.daVerificare > 0} />
        <Contatore v={totali.annullate} l="annullate" onClick={() => filtra("annullata", "tutti")} />
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
          <button className="cmd" onClick={onRicarica} aria-label="Aggiorna" title="Aggiorna">
            <RefreshCw size={15} className={caricando ? "gira" : ""} />
          </button>
          <button className="btn btn-chiaro btn-piccolo" onClick={() => scaricaCsv(filtrate)} disabled={!filtrate.length}>
            <Download size={15} /> CSV
          </button>
        </div>
      </section>

      {righe === null ? (
        <p className="aiuto">Carico le conferme…</p>
      ) : filtrate.length === 0 ? (
        <div className="card vuoto">
          <p className="t">{righe.length ? "Nessuna conferma con questi filtri" : "Ancora nessuna conferma"}</p>
          {righe.length > 0 && (
            <button className="link" onClick={() => (setCerca(""), filtra("tutte", "tutti"))}>
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
              <Riga key={p.id} p={p} invito={p.invito_id ? invitiPerId.get(p.invito_id) : undefined} inviti={inviti} onAggiorna={onAggiorna} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function Contatore({ v, l, forte, avviso, onClick }: { v: number; l: string; forte?: boolean; avviso?: boolean; onClick?: () => void }) {
  const C = onClick ? "button" : "div";
  return (
    <C className={"contatore" + (forte ? " forte" : "") + (avviso ? " avviso-c" : "") + (onClick ? " cliccabile" : "")} onClick={onClick}>
      <span className="v">{v}</span>
      <span className="l">{l}</span>
    </C>
  );
}

function Riga({
  p,
  invito,
  inviti,
  onAggiorna,
}: {
  p: Prenotazione;
  invito?: Invito;
  inviti: Invito[];
  onAggiorna: Props["onAggiorna"];
}) {
  const [occupato, setOccupato] = useState(false);
  const c = leggiContatto(p.contatto);
  const posti = descriviPosti(p.posti);
  const differenza = invito?.persone_previste ? p.persone - invito.persone_previste : 0;
  const esegui = async (modifiche: Partial<Prenotazione>) => {
    setOccupato(true);
    try {
      await onAggiorna(p.id, modifiche);
    } finally {
      setOccupato(false);
    }
  };

  return (
    <article className={"card conferma stato-" + p.stato}>
      <div className="conferma-testa">
        <div style={{ minWidth: 0 }}>
          <h2 className="conferma-nome">{p.nome}</h2>
          <p className="aiuto" style={{ margin: 0 }}>
            {p.persone} {p.persone === 1 ? "persona" : "persone"}
            {differenza !== 0 && (
              <span className={"differenza " + (differenza > 0 ? "piu" : "meno")}>
                {differenza > 0 ? "+" : ""}
                {differenza} rispetto al previsto
              </span>
            )}{" "}
            · {dataBreve(p.creata_il)}
          </p>
        </div>
        <div className="badge-gruppo">
          <span className={"badge badge-" + p.stato}>{ETICHETTE_STATO[p.stato]}</span>
          {p.stato === "confermata" && <span className={"badge badge-r-" + p.richiamo}>{ETICHETTE_RICHIAMO[p.richiamo]}</span>}
        </div>
      </div>

      {p.stato === "da_verificare" && (
        <div className="verifica">
          <p className="aiuto" style={{ margin: 0 }}>
            Arrivata dal link generico. Se la conoscete, approvatela o collegatela al suo invito.
          </p>
          <div className="verifica-azioni">
            <button className="btn btn-scuro btn-piccolo" disabled={occupato} onClick={() => esegui({ stato: "confermata" })}>
              <Check size={14} /> Approva
            </button>
            <select
              disabled={occupato}
              value=""
              onChange={(e) => e.target.value && esegui({ invito_id: e.target.value, stato: "confermata" })}
              aria-label="Collega a un invito"
            >
              <option value="">Collega a un invito…</option>
              {inviti
                .filter((i) => !i.revocato)
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nome}
                  </option>
                ))}
            </select>
            <button className="btn btn-chiaro btn-piccolo" disabled={occupato} onClick={() => esegui({ stato: "annullata" })}>
              Non la conosciamo
            </button>
          </div>
        </div>
      )}

      <dl className="conferma-dati">
        {invito && invito.nome !== p.nome && (
          <div>
            <dt>Invito</dt>
            <dd>{invito.nome}</dd>
          </div>
        )}
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
