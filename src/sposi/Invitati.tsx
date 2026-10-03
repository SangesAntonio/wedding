import { useMemo, useRef, useState, type FormEvent } from "react";
import { Ban, Check, Copy, Download, FileSpreadsheet, MessageCircle, MessageSquareText, Pencil, Plus, RotateCcw, Search, Send, Share2, Trash2, X } from "lucide-react";
import { normalizzaTelefono, telefonoLeggibile } from "../lib/contatti";
import { Finestra } from "./Finestra";
import type { Prenotazione } from "./dati";
import { leggiFile, scaricaModello, type RigaImport } from "./excel";
import {
  MESSAGGIO_PREDEFINITO,
  linkInvito,
  testoMessaggio,
  whatsappInvito,
  type Invito,
  type NuovoInvito,
} from "./inviti";

type StatoInvito = "da_inviare" | "inviato" | "aperto" | "confermato" | "annullato" | "revocato";

const ETICHETTE: Record<StatoInvito, string> = {
  da_inviare: "Da inviare",
  inviato: "Inviato",
  aperto: "Aperto, senza risposta",
  confermato: "Confermato",
  annullato: "Ha annullato",
  revocato: "Revocato",
};

type Filtro = "tutti" | "da_inviare" | "senza_risposta" | "confermato" | "revocato";

export interface AzioniInviti {
  crea: (nuovi: NuovoInvito[]) => Promise<void>;
  aggiorna: (id: string, modifiche: Partial<Invito>) => Promise<void>;
  elimina: (id: string) => Promise<void>;
  segnaInviato: (id: string) => Promise<void>;
  salvaMessaggio: (testo: string) => Promise<void>;
}

interface Props {
  inviti: Invito[] | null;
  prenotazioni: Prenotazione[];
  messaggio: string;
  azioni: AzioniInviti;
}

export function Invitati({ inviti, prenotazioni, messaggio, azioni }: Props) {
  const [cerca, setCerca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("tutti");
  const [modifica, setModifica] = useState<Invito | "nuovo" | null>(null);
  const [importa, setImporta] = useState(false);
  const [sequenza, setSequenza] = useState(false);
  const [editorMsg, setEditorMsg] = useState(false);
  const [notifica, setNotifica] = useState("");

  const prenotazionePer = useMemo(() => {
    const m = new Map<string, Prenotazione>();
    // la più recente non annullata vince; altrimenti l'ultima annullata
    [...prenotazioni]
      .sort((a, b) => a.creata_il.localeCompare(b.creata_il))
      .forEach((p) => {
        if (!p.invito_id) return;
        const prima = m.get(p.invito_id);
        if (!prima || p.stato !== "annullata" || prima.stato === "annullata") m.set(p.invito_id, p);
      });
    return m;
  }, [prenotazioni]);

  const statoDi = (i: Invito): StatoInvito => {
    if (i.revocato) return "revocato";
    const p = prenotazionePer.get(i.id);
    if (p) return p.stato === "annullata" ? "annullato" : "confermato";
    if (i.aperto_il) return "aperto";
    if (i.inviato_il) return "inviato";
    return "da_inviare";
  };

  const lista = inviti ?? [];
  const totali = useMemo(() => {
    const stati = lista.map(statoDi);
    const attivi = lista.filter((i) => !i.revocato);
    return {
      inviti: attivi.length,
      previste: attivi.reduce((s, i) => s + (i.persone_previste ?? 0), 0),
      daInviare: stati.filter((s) => s === "da_inviare").length,
      senzaRisposta: stati.filter((s) => s === "inviato" || s === "aperto").length,
      confermati: stati.filter((s) => s === "confermato").length,
      aperti: lista.filter((i) => i.aperto_il && !i.revocato).length,
    };
  }, [lista, prenotazionePer]);

  const filtrati = useMemo(() => {
    const q = cerca.trim().toLowerCase();
    return lista.filter((i) => {
      const s = statoDi(i);
      if (filtro === "da_inviare" && s !== "da_inviare") return false;
      if (filtro === "senza_risposta" && s !== "inviato" && s !== "aperto") return false;
      if (filtro === "confermato" && s !== "confermato") return false;
      if (filtro === "revocato" && s !== "revocato") return false;
      if (filtro === "tutti" && s === "revocato") return false;
      return !q || [i.nome, i.telefono, i.email, i.nota_sposi].some((v) => v?.toLowerCase().includes(q));
    });
  }, [lista, cerca, filtro, prenotazionePer]);


  const coda = useMemo(() => lista.filter((i) => statoDi(i) === "da_inviare" && i.telefono), [lista, prenotazionePer]);

  const avvisa = (t: string) => {
    setNotifica(t);
    setTimeout(() => setNotifica(""), 2600);
  };

  return (
    <>
      <section className="contatori">
        <Contatore v={totali.inviti} l="inviti" forte />
        <Contatore v={totali.previste} l="persone previste" />
        <Contatore v={totali.daInviare} l="da inviare" onClick={() => setFiltro("da_inviare")} />
        <Contatore v={totali.senzaRisposta} l="senza risposta" onClick={() => setFiltro("senza_risposta")} />
        <Contatore v={totali.aperti} l="hanno aperto il link" />
        <Contatore v={totali.confermati} l="confermati" onClick={() => setFiltro("confermato")} />
      </section>

      <section className="azioni-inviti">
        <button className="btn btn-scuro btn-piccolo" onClick={() => setModifica("nuovo")}>
          <Plus size={15} /> Aggiungi
        </button>
        <button className="btn btn-chiaro btn-piccolo" onClick={() => setImporta(true)}>
          <FileSpreadsheet size={15} /> Carica Excel
        </button>
        <button className="btn btn-chiaro btn-piccolo" onClick={() => scaricaModello()}>
          <Download size={15} /> Modello Excel
        </button>
        <button className="btn btn-chiaro btn-piccolo" onClick={() => setEditorMsg(true)}>
          <MessageSquareText size={15} /> Messaggio
        </button>
        <button className="btn btn-scuro btn-piccolo" onClick={() => setSequenza(true)} disabled={!coda.length} title={coda.length ? "" : "Nessun invito da inviare con un numero di telefono"}>
          <Send size={15} /> Invia in sequenza{coda.length ? ` (${coda.length})` : ""}
        </button>
      </section>

      <section className="strumenti">
        <label className="cerca">
          <Search size={16} />
          <input value={cerca} onChange={(e) => setCerca(e.target.value)} placeholder="Cerca famiglia, telefono, email…" aria-label="Cerca" />
          {cerca && (
            <button className="mappa-x" onClick={() => setCerca("")} aria-label="Cancella ricerca">
              <X size={14} />
            </button>
          )}
        </label>
        <div className="filtri">
          <select value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)} aria-label="Filtro">
            <option value="tutti">Tutti gli inviti</option>
            <option value="da_inviare">Da inviare</option>
            <option value="senza_risposta">Senza risposta</option>
            <option value="confermato">Confermati</option>
            <option value="revocato">Revocati</option>
          </select>
        </div>
      </section>

      {inviti === null ? (
        <p className="aiuto">Carico gli inviti…</p>
      ) : lista.length === 0 ? (
        <div className="card vuoto">
          <p className="t">Nessun invito ancora</p>
          <p className="d">Aggiungete le famiglie a mano o caricate il file Excel: scaricate il modello, compilatelo e caricatelo.</p>
          <div className="vuoto-azioni">
            <button className="btn btn-chiaro btn-piccolo" onClick={() => scaricaModello()}>
              <Download size={15} /> Modello Excel
            </button>
            <button className="btn btn-scuro btn-piccolo" onClick={() => setImporta(true)}>
              <FileSpreadsheet size={15} /> Carica Excel
            </button>
          </div>
        </div>
      ) : filtrati.length === 0 ? (
        <div className="card vuoto">
          <p className="t">Nessun invito con questi filtri</p>
          <button className="link" onClick={() => (setCerca(""), setFiltro("tutti"))}>
            Togli i filtri
          </button>
        </div>
      ) : (
        <div className="elenco-inviti">
          {filtrati.map((i) => (
            <RigaInvito
              key={i.id}
              invito={i}
              stato={statoDi(i)}
              prenotazione={prenotazionePer.get(i.id)}
              messaggio={messaggio}
              azioni={azioni}
              onModifica={() => setModifica(i)}
              avvisa={avvisa}
            />
          ))}
        </div>
      )}

      {notifica && <div className="avviso anim-su sposi-avviso">{notifica}</div>}

      {modifica && (
        <FormInvito
          invito={modifica === "nuovo" ? null : modifica}
          onChiudi={() => setModifica(null)}
          onSalva={async (dati) => {
            if (modifica === "nuovo") await azioni.crea([dati]);
            else await azioni.aggiorna(modifica.id, dati);
            setModifica(null);
            avvisa(modifica === "nuovo" ? "Invito aggiunto" : "Invito aggiornato");
          }}
        />
      )}
      {importa && (
        <Importa
          esistenti={lista}
          onChiudi={() => setImporta(false)}
          onImporta={async (nuovi) => {
            await azioni.crea(nuovi);
            setImporta(false);
            avvisa(`${nuovi.length} inviti aggiunti`);
          }}
        />
      )}
      {sequenza && <InvioSequenza coda={coda} messaggio={messaggio} segnaInviato={azioni.segnaInviato} onChiudi={() => setSequenza(false)} />}
      {editorMsg && (
        <EditorMessaggio
          testo={messaggio}
          esempio={lista[0]}
          onChiudi={() => setEditorMsg(false)}
          onSalva={async (t) => {
            await azioni.salvaMessaggio(t);
            setEditorMsg(false);
            avvisa("Messaggio salvato");
          }}
        />
      )}
    </>
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

// ------------------------------------------------------------------ riga
function RigaInvito({
  invito: i,
  stato,
  prenotazione,
  messaggio,
  azioni,
  onModifica,
  avvisa,
}: {
  invito: Invito;
  stato: StatoInvito;
  prenotazione?: Prenotazione;
  messaggio: string;
  azioni: AzioniInviti;
  onModifica: () => void;
  avvisa: (t: string) => void;
}) {
  const wa = whatsappInvito(messaggio, i);
  const link = linkInvito(i.token);
  const segna = () => !i.inviato_il && azioni.segnaInviato(i.id);
  const diff = prenotazione && stato === "confermato" && i.persone_previste ? prenotazione.persone - i.persone_previste : 0;

  const copia = async () => {
    try {
      await navigator.clipboard.writeText(link);
      avvisa("Link copiato");
      segna();
    } catch {
      window.prompt("Copiate il link:", link);
    }
  };
  const condividi = async () => {
    try {
      await navigator.share({ title: "Invito", text: testoMessaggio(messaggio, i) });
      segna();
    } catch {
      /* annullato */
    }
  };
  const elimina = async () => {
    if (prenotazione) {
      if (window.confirm(`${i.nome} ha già una prenotazione. Revocare l'invito? Il link smetterà di funzionare, la prenotazione resta.`)) await azioni.aggiorna(i.id, { revocato: true });
      return;
    }
    if (window.confirm(`Eliminare l'invito di ${i.nome}?`)) await azioni.elimina(i.id);
  };

  return (
    <article className={"card invito stato-inv-" + stato}>
      <div className="invito-testa">
        <div style={{ minWidth: 0 }}>
          <h3 className="conferma-nome">{i.nome}</h3>
          <p className="aiuto" style={{ margin: 0 }}>
            {i.persone_previste ? `${i.persone_previste} previst${i.persone_previste === 1 ? "a" : "e"}` : "persone non indicate"}
            {i.telefono && ` · ${telefonoLeggibile(i.telefono)}`}
            {i.email && ` · ${i.email}`}
          </p>
          {i.nota_sposi && <p className="aiuto invito-nota">{i.nota_sposi}</p>}
        </div>
        <span className={"badge badge-inv-" + stato}>
          {ETICHETTE[stato]}
          {stato === "confermato" && prenotazione && ` · ${prenotazione.persone}`}
          {diff !== 0 && ` (${diff > 0 ? "+" : ""}${diff})`}
        </span>
      </div>

      <div className="invito-azioni">
        {!i.revocato && wa && (
          <a className="btn btn-scuro btn-piccolo" href={wa} target="_blank" rel="noopener" onClick={segna}>
            <MessageCircle size={14} /> WhatsApp
          </a>
        )}
        {!i.revocato && (
          <button className="btn btn-chiaro btn-piccolo" onClick={copia}>
            <Copy size={14} /> Copia link
          </button>
        )}
        {!i.revocato && typeof navigator.share === "function" && (
          <button className="btn btn-chiaro btn-piccolo" onClick={condividi}>
            <Share2 size={14} /> Condividi
          </button>
        )}
        <span className="invito-azioni-destra">
          {!i.revocato && (
            <button className="link" onClick={() => azioni.aggiorna(i.id, { inviato_il: i.inviato_il ? null : new Date().toISOString() })}>
              {i.inviato_il ? "segna da inviare" : "segna inviato"}
            </button>
          )}
          <button className="cmd" onClick={onModifica} aria-label="Modifica" title="Modifica">
            <Pencil size={14} />
          </button>
          {i.revocato ? (
            <button className="cmd" onClick={() => azioni.aggiorna(i.id, { revocato: false })} aria-label="Riattiva" title="Riattiva il link">
              <RotateCcw size={14} />
            </button>
          ) : (
            <button className="cmd" onClick={() => window.confirm(`Revocare il link di ${i.nome}? Smetterà di funzionare.`) && azioni.aggiorna(i.id, { revocato: true })} aria-label="Revoca" title="Revoca il link">
              <Ban size={14} />
            </button>
          )}
          <button className="cmd" onClick={elimina} aria-label="Elimina" title="Elimina">
            <Trash2 size={14} />
          </button>
        </span>
      </div>
    </article>
  );
}

// ------------------------------------------------------------------ aggiungi / modifica
function FormInvito({ invito, onChiudi, onSalva }: { invito: Invito | null; onChiudi: () => void; onSalva: (d: NuovoInvito) => Promise<void> }) {
  const [nome, setNome] = useState(invito?.nome ?? "");
  const [telefono, setTelefono] = useState(invito?.telefono ? telefonoLeggibile(invito.telefono) : "");
  const [email, setEmail] = useState(invito?.email ?? "");
  const [persone, setPersone] = useState(invito?.persone_previste ? String(invito.persone_previste) : "");
  const [nota, setNota] = useState(invito?.nota_sposi ?? "");
  const [errore, setErrore] = useState("");
  const [attesa, setAttesa] = useState(false);

  const salva = async (e: FormEvent) => {
    e.preventDefault();
    const tel = telefono.trim() ? normalizzaTelefono(telefono) : null;
    if (!nome.trim()) return setErrore("Serve il nome della famiglia.");
    if (telefono.trim() && !tel) return setErrore("Numero di telefono non riconosciuto.");
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setErrore("Email non valida.");
    const n = persone ? parseInt(persone, 10) : null;
    if (n !== null && (!Number.isFinite(n) || n < 1 || n > 30)) return setErrore("Persone previste: da 1 a 30.");
    setAttesa(true);
    try {
      await onSalva({ nome: nome.trim(), telefono: tel, email: email.trim() || null, persone_previste: n, nota_sposi: nota.trim() || null });
    } catch {
      setErrore("Salvataggio non riuscito. Riprovate.");
      setAttesa(false);
    }
  };

  return (
    <Finestra titolo={invito ? "Modifica invito" : "Nuovo invito"} onChiudi={onChiudi}>
      <form onSubmit={salva} className="modulo">
        <label>
          <span className="etichetta">Famiglia o nome *</span>
          <input className="campo" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Famiglia Esposito" autoFocus maxLength={120} />
        </label>
        <div className="modulo-due">
          <label>
            <span className="etichetta">Telefono</span>
            <input className="campo" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="333 123 4567" inputMode="tel" />
          </label>
          <label>
            <span className="etichetta">Persone previste</span>
            <input className="campo" value={persone} onChange={(e) => setPersone(e.target.value.replace(/\D/g, ""))} placeholder="4" inputMode="numeric" maxLength={2} />
          </label>
        </div>
        <label>
          <span className="etichetta">Email</span>
          <input className="campo" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="facoltativa" inputMode="email" />
        </label>
        <label>
          <span className="etichetta">Vostra nota</span>
          <input className="campo" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="es. cugini di Rosa" maxLength={600} />
        </label>
        <p className="aiuto">Il numero di persone è solo indicativo: la famiglia può confermarne di più o di meno.</p>
        {errore && <p className="aiuto errore">{errore}</p>}
        <div className="modulo-piede">
          <button type="button" className="btn btn-chiaro" onClick={onChiudi}>
            Annulla
          </button>
          <button className="btn btn-scuro" disabled={attesa}>
            {attesa ? "Salvo…" : "Salva"}
          </button>
        </div>
      </form>
    </Finestra>
  );
}

// ------------------------------------------------------------------ importa da Excel
function Importa({ esistenti, onChiudi, onImporta }: { esistenti: Invito[]; onChiudi: () => void; onImporta: (n: NuovoInvito[]) => Promise<void> }) {
  const [righe, setRighe] = useState<RigaImport[] | null>(null);
  const [nomeFile, setNomeFile] = useState("");
  const [errore, setErrore] = useState("");
  const [attesa, setAttesa] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const scegli = async (f: File | undefined) => {
    if (!f) return;
    setErrore("");
    setNomeFile(f.name);
    try {
      setRighe(await leggiFile(f, esistenti));
    } catch (e) {
      setRighe(null);
      setErrore(e instanceof Error ? e.message : "File non leggibile.");
    }
  };

  const buone = (righe ?? []).filter((r) => !r.errori.length);
  const scartate = (righe ?? []).length - buone.length;

  return (
    <Finestra titolo="Carica la lista invitati" onChiudi={onChiudi} larga>
      <div className="importa">
        <p className="aiuto" style={{ marginTop: 0 }}>
          File Excel (.xlsx, .xls) o CSV con le colonne <b>Famiglia</b>, Telefono, Email, Persone previste, Note. Solo Famiglia è obbligatoria.{" "}
          <button className="link" onClick={() => scaricaModello()}>
            Scarica il modello
          </button>
        </p>
        <div
          className="importa-zona"
          onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            scegli(e.dataTransfer.files[0]);
          }}
        >
          <FileSpreadsheet size={22} />
          <span>{nomeFile || "Scegliete il file o trascinatelo qui"}</span>
          <input ref={input} type="file" accept=".xlsx,.xls,.csv,.ods" hidden onChange={(e) => scegli(e.target.files?.[0])} />
        </div>
        {errore && <p className="aiuto errore">{errore}</p>}

        {righe && (
          <>
            <p className="aiuto">
              <b>{buone.length}</b> pronti da aggiungere{scartate > 0 && <>, <b>{scartate}</b> saltati (vedi sotto)</>}.
            </p>
            <div className="importa-tabella">
              <table>
                <thead>
                  <tr>
                    <th />
                    <th>Famiglia</th>
                    <th>Telefono</th>
                    <th>Persone</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {righe.map((r) => (
                    <tr key={r.riga} className={r.errori.length ? "riga-errore" : r.avvisi.length ? "riga-avviso" : ""}>
                      <td>{r.errori.length ? <X size={14} /> : <Check size={14} />}</td>
                      <td>
                        {r.dati.nome || <i>—</i>}
                        {[...r.errori, ...r.avvisi].length > 0 && (
                          <span className="importa-msg">
                            riga {r.riga}: {[...r.errori, ...r.avvisi].join(" · ")}
                          </span>
                        )}
                      </td>
                      <td>{r.dati.telefono ? telefonoLeggibile(r.dati.telefono) : r.telefonoScritto ? <s>{r.telefonoScritto}</s> : ""}</td>
                      <td>{r.dati.persone_previste ?? ""}</td>
                      <td>{r.dati.nota_sposi ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <div className="modulo-piede">
          <button className="btn btn-chiaro" onClick={onChiudi}>
            Annulla
          </button>
          <button
            className="btn btn-scuro"
            disabled={!buone.length || attesa}
            onClick={async () => {
              setAttesa(true);
              try {
                await onImporta(buone.map((r) => r.dati));
              } catch {
                setErrore("Importazione non riuscita. Riprovate.");
                setAttesa(false);
              }
            }}
          >
            {attesa ? "Aggiungo…" : `Aggiungi ${buone.length} inviti`}
          </button>
        </div>
      </div>
    </Finestra>
  );
}

// ------------------------------------------------------------------ invio in sequenza
function InvioSequenza({ coda, messaggio, segnaInviato, onChiudi }: { coda: Invito[]; messaggio: string; segnaInviato: (id: string) => Promise<void>; onChiudi: () => void }) {
  // la coda si "congela" all'apertura, così non cambia mentre si invia
  const [lista] = useState(coda);
  const [n, setN] = useState(0);
  const [inviati, setInviati] = useState(0);
  const i = lista[n];

  if (!i)
    return (
      <Finestra titolo="Invio in sequenza" onChiudi={onChiudi}>
        <div className="sequenza-fine">
          <Check size={28} />
          <p className="t">Fatto!</p>
          <p className="aiuto">
            {inviati} {inviati === 1 ? "invito aperto" : "inviti aperti"} su WhatsApp. Chi non ha il telefono lo trovate con "Copia link".
          </p>
          <button className="btn btn-scuro" onClick={onChiudi}>
            Chiudi
          </button>
        </div>
      </Finestra>
    );

  const wa = whatsappInvito(messaggio, i)!;
  return (
    <Finestra titolo="Invio in sequenza" onChiudi={onChiudi}>
      <div className="sequenza">
        <div className="sequenza-barra">
          <span style={{ width: `${(n / lista.length) * 100}%` }} />
        </div>
        <p className="aiuto">
          {n + 1} di {lista.length}
        </p>
        <p className="sequenza-nome">{i.nome}</p>
        <p className="aiuto">{telefonoLeggibile(i.telefono!)}</p>
        <pre className="sequenza-msg">{testoMessaggio(messaggio, i)}</pre>
        <a
          className="btn btn-scuro btn-largo"
          href={wa}
          target="_blank"
          rel="noopener"
          onClick={() => {
            segnaInviato(i.id);
            setInviati((x) => x + 1);
            setTimeout(() => setN((x) => x + 1), 400);
          }}
        >
          <MessageCircle size={16} /> Apri WhatsApp e vai al prossimo
        </a>
        <button className="link" onClick={() => setN((x) => x + 1)}>
          Salta questo
        </button>
        <p className="aiuto">In WhatsApp premete Invia, poi tornate qui: trovate già la famiglia successiva.</p>
      </div>
    </Finestra>
  );
}

// ------------------------------------------------------------------ testo del messaggio
function EditorMessaggio({ testo, esempio, onChiudi, onSalva }: { testo: string; esempio?: Invito; onChiudi: () => void; onSalva: (t: string) => Promise<void> }) {
  const [t, setT] = useState(testo);
  const [attesa, setAttesa] = useState(false);
  const prova = esempio ?? ({ nome: "Famiglia Esposito", token: "esempio1" } as Invito);
  return (
    <Finestra titolo="Messaggio dell'invito" onChiudi={onChiudi} larga>
      <div className="modulo">
        <p className="aiuto" style={{ marginTop: 0 }}>
          <b>{"{nome}"}</b> diventa il nome della famiglia, <b>{"{link}"}</b> il suo link personale.
        </p>
        <textarea className="campo campo-note" rows={6} value={t} onChange={(e) => setT(e.target.value)} />
        {!t.includes("{link}") && <p className="aiuto errore">Manca {"{link}"}: senza, la famiglia non riceve il suo invito.</p>}
        <p className="etichetta">Anteprima</p>
        <pre className="sequenza-msg">{testoMessaggio(t, prova)}</pre>
        <div className="modulo-piede">
          <button className="link" onClick={() => setT(MESSAGGIO_PREDEFINITO)}>
            Ripristina il testo iniziale
          </button>
          <button className="btn btn-chiaro" onClick={onChiudi}>
            Annulla
          </button>
          <button
            className="btn btn-scuro"
            disabled={attesa || !t.includes("{link}")}
            onClick={async () => {
              setAttesa(true);
              try {
                await onSalva(t);
              } finally {
                setAttesa(false);
              }
            }}
          >
            Salva
          </button>
        </div>
      </div>
    </Finestra>
  );
}
