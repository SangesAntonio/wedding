import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { LogOut } from "lucide-react";
import { DATA_EVENTO, SPOSI } from "../config";
import { COLORI } from "../data/sala";
import { Foglia } from "../components/Ornamenti";
import { MODALITA_DEMO } from "../lib/supabase";
import { Accesso } from "./Accesso";
import { Conferme } from "./Conferme";
import { Invitati, type AzioniInviti } from "./Invitati";
import { aggiornaPrenotazione, ascoltaCambi, caricaMatrimonio, caricaPrenotazioni, type Prenotazione } from "./dati";
import {
  MESSAGGIO_PREDEFINITO,
  aggiornaInvito,
  caricaInviti,
  creaInviti,
  eliminaInvito,
  leggiMessaggio,
  salvaMessaggio,
  segnaInviato,
  type Invito,
} from "./inviti";

type Scheda = "conferme" | "invitati";

const schedaIniziale = (): Scheda => (window.location.hash === "#invitati" ? "invitati" : "conferme");

export function AreaSposi() {
  return <Accesso>{(sessione, esci) => <Pannello sessione={sessione} esci={esci} />}</Accesso>;
}

function Pannello({ sessione, esci }: { sessione: Session | null; esci: () => void }) {
  const [matrimonio, setMatrimonio] = useState<{ id: string } | null | undefined>(undefined);
  const [prenotazioni, setPrenotazioni] = useState<Prenotazione[] | null>(null);
  const [inviti, setInviti] = useState<Invito[] | null>(null);
  const [messaggio, setMessaggio] = useState(MESSAGGIO_PREDEFINITO);
  const [errore, setErrore] = useState("");
  const [caricando, setCaricando] = useState(false);
  const [scheda, setScheda] = useState<Scheda>(schedaIniziale);

  const cambiaScheda = (s: Scheda) => {
    setScheda(s);
    history.replaceState(null, "", s === "invitati" ? "#invitati" : window.location.pathname + window.location.search);
  };

  useEffect(() => {
    const segui = () => setScheda(schedaIniziale());
    window.addEventListener("hashchange", segui);
    return () => window.removeEventListener("hashchange", segui);
  }, []);

  useEffect(() => {
    caricaMatrimonio()
      .then(setMatrimonio)
      .catch(() => setErrore("Non riesco a leggere i dati. Controllate la connessione."));
  }, []);

  const ricarica = useCallback(async () => {
    if (!matrimonio) return;
    setCaricando(true);
    try {
      const [p, i, m] = await Promise.all([caricaPrenotazioni(matrimonio.id), caricaInviti(matrimonio.id), leggiMessaggio(matrimonio.id)]);
      setPrenotazioni(p);
      setInviti(i);
      setMessaggio(m);
      setErrore("");
    } catch {
      setErrore("Non riesco a leggere i dati. Controllate la connessione e riprovate.");
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

  // ogni azione salva e poi rilegge, così l'elenco è sempre quello del database
  const conRicarica =
    <A extends unknown[]>(f: (...a: A) => Promise<unknown>) =>
    async (...a: A) => {
      try {
        await f(...a);
      } catch (e) {
        setErrore("Operazione non riuscita. Controllate la connessione e riprovate.");
        throw e;
      } finally {
        await ricarica();
      }
    };

  const azioniInviti: AzioniInviti = useMemo(
    () => ({
      crea: conRicarica((n) => creaInviti(matrimonio!.id, n)),
      aggiorna: conRicarica(aggiornaInvito),
      elimina: conRicarica(eliminaInvito),
      segnaInviato: conRicarica(segnaInviato),
      salvaMessaggio: conRicarica((t: string) => salvaMessaggio(matrimonio!.id, t)),
    }),
    [matrimonio, ricarica],
  );

  const giorni = Math.max(0, Math.ceil((DATA_EVENTO.getTime() - Date.now()) / 864e5));
  const daVerificare = (prenotazioni ?? []).filter((p) => p.stato === "da_verificare").length;

  return (
    <div className="sposi">
      <header className="sposi-testa">
        <div className="sposi-contenitore sposi-testa-in">
          <span className="marchio">
            <Foglia size={13} color={COLORI.oro} /> {SPOSI.iniziali.replace("&", " & ")} · Area sposi
          </span>
          <span className="sposi-utente">
            <span className="sposi-email">{MODALITA_DEMO ? "modalità demo" : sessione?.user.email}</span>
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
              <nav className="schede" role="tablist">
                <button role="tab" aria-selected={scheda === "conferme"} className={scheda === "conferme" ? "on" : ""} onClick={() => cambiaScheda("conferme")}>
                  Conferme
                  {daVerificare > 0 && <span className="pallino">{daVerificare}</span>}
                </button>
                <button role="tab" aria-selected={scheda === "invitati"} className={scheda === "invitati" ? "on" : ""} onClick={() => cambiaScheda("invitati")}>
                  Invitati
                </button>
              </nav>
              <p className="aiuto">Mancano {giorni} giorni</p>
            </div>

            {errore && <p className="aiuto errore">{errore}</p>}

            {scheda === "conferme" ? (
              <Conferme
                righe={prenotazioni}
                inviti={inviti ?? []}
                caricando={caricando}
                onRicarica={ricarica}
                onAggiorna={conRicarica((id: string, m: Partial<Prenotazione>) => aggiornaPrenotazione(id, m))}
              />
            ) : (
              <Invitati inviti={inviti} prenotazioni={prenotazioni ?? []} messaggio={messaggio} azioni={azioniInviti} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
