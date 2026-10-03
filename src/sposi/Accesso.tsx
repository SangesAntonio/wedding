import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { MODALITA_DEMO, supabase } from "../lib/supabase";
import { SPOSI } from "../config";
import { Foglia } from "../components/Ornamenti";
import { COLORI } from "../data/sala";

type Vista = "login" | "recupero" | "nuova-password";

function Cornice({ titolo, children }: { titolo: string; children: ReactNode }) {
  return (
    <div className="accesso">
      <div className="accesso-card">
        <Foglia size={22} color={COLORI.oro} />
        <p className="occhiello">Area sposi</p>
        <h1 className="accesso-nomi">
          {SPOSI.lui} &amp; {SPOSI.lei}
        </h1>
        <p className="accesso-titolo">{titolo}</p>
        {children}
      </div>
    </div>
  );
}

/** Mostra i figli solo a chi ha fatto login. In modalità demo entra subito. */
export function Accesso({ children }: { children: (sessione: Session | null, esci: () => void) => ReactNode }) {
  const [sessione, setSessione] = useState<Session | null>(null);
  const [pronto, setPronto] = useState(MODALITA_DEMO);
  const [vista, setVista] = useState<Vista>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [messaggio, setMessaggio] = useState("");
  const [errore, setErrore] = useState("");
  const [attesa, setAttesa] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSessione(data.session);
      setPronto(true);
    });
    const { data } = supabase.auth.onAuthStateChange((evento, s) => {
      setSessione(s);
      if (evento === "PASSWORD_RECOVERY") setVista("nuova-password");
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const esci = () => {
    supabase?.auth.signOut();
    setPassword("");
    setVista("login");
  };

  if (MODALITA_DEMO) return <>{children(null, () => {})}</>;
  if (!pronto) return <div className="accesso" />;
  if (sessione && vista !== "nuova-password") return <>{children(sessione, esci)}</>;

  const invia = (azione: () => Promise<void>) => async (e: FormEvent) => {
    e.preventDefault();
    setErrore("");
    setMessaggio("");
    setAttesa(true);
    try {
      await azione();
    } finally {
      setAttesa(false);
    }
  };

  const entra = invia(async () => {
    const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setErrore(error.message.includes("Invalid") ? "Email o password non corrette." : "Accesso non riuscito: " + error.message);
  });

  const recupera = invia(async () => {
    const { error } = await supabase!.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.href.split("#")[0] });
    if (error) setErrore("Invio non riuscito: " + error.message);
    else setMessaggio("Se l'email è registrata, vi arriva un link per scegliere una nuova password.");
  });

  const cambia = invia(async () => {
    if (password.length < 8) {
      setErrore("Almeno 8 caratteri.");
      return;
    }
    const { error } = await supabase!.auth.updateUser({ password });
    if (error) setErrore("Non riuscito: " + error.message);
    else {
      setPassword("");
      setVista("login");
    }
  });

  if (vista === "nuova-password")
    return (
      <Cornice titolo="Scegliete una nuova password">
        <form onSubmit={cambia} className="accesso-form">
          <input className="campo" type="password" autoComplete="new-password" placeholder="Nuova password (almeno 8 caratteri)" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {errore && <p className="aiuto errore">{errore}</p>}
          <button className="btn btn-scuro btn-largo" disabled={attesa}>
            {attesa ? "Salvo…" : "Salva e entra"}
          </button>
        </form>
      </Cornice>
    );

  if (vista === "recupero")
    return (
      <Cornice titolo="Password dimenticata">
        <form onSubmit={recupera} className="accesso-form">
          <input className="campo" type="email" autoComplete="email" placeholder="La vostra email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          {errore && <p className="aiuto errore">{errore}</p>}
          {messaggio && <p className="aiuto ok">{messaggio}</p>}
          <button className="btn btn-scuro btn-largo" disabled={attesa}>
            {attesa ? "Invio…" : "Mandatemi il link"}
          </button>
          <button type="button" className="link" onClick={() => setVista("login")}>
            Torna all'accesso
          </button>
        </form>
      </Cornice>
    );

  return (
    <Cornice titolo="Entrate per vedere le conferme">
      <form onSubmit={entra} className="accesso-form">
        <input className="campo" type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="campo" type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {errore && <p className="aiuto errore">{errore}</p>}
        <button className="btn btn-scuro btn-largo" disabled={attesa}>
          {attesa ? "Entro…" : "Entra"}
        </button>
        <button type="button" className="link" onClick={() => setVista("recupero")}>
          Password dimenticata?
        </button>
      </form>
    </Cornice>
  );
}
