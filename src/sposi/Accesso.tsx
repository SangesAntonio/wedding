import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";
import { MODALITA_DEMO, supabase } from "../lib/supabase";
import { SPOSI } from "../config";
import { Button } from "@/sposi/ui/button";
import { Input } from "@/sposi/ui/input";
import { Label } from "@/sposi/ui/label";

type Vista = "login" | "recupero" | "nuova-password";

function Cornice({ titolo, children }: { titolo: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[radial-gradient(900px_600px_at_50%_20%,color-mix(in_oklab,var(--card)_80%,transparent),transparent)] px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full border border-oro/50 bg-card font-serif text-lg text-oro shadow-sm">
            {SPOSI.iniziali}
          </div>
          <p className="text-[11px] font-medium tracking-[0.25em] text-muted-foreground uppercase">Area sposi</p>
          <h1 className="mt-1 font-serif text-4xl font-medium">
            {SPOSI.lui} &amp; {SPOSI.lei}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{titolo}</p>
        </div>
        <div className="rounded-2xl border bg-card p-6 shadow-[0_24px_60px_-30px_rgba(35,48,42,.35)]">{children}</div>
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
  if (!pronto)
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
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

  const Errore = () => (errore ? <p className="text-sm text-destructive">{errore}</p> : null);

  if (vista === "nuova-password")
    return (
      <Cornice titolo="Scegliete una nuova password">
        <form onSubmit={cambia} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="pw">Nuova password</Label>
            <Input id="pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </div>
          <Errore />
          <Button size="lg" disabled={attesa}>
            {attesa && <Loader2 className="animate-spin" />} Salva e entra
          </Button>
        </form>
      </Cornice>
    );

  if (vista === "recupero")
    return (
      <Cornice titolo="Password dimenticata">
        <form onSubmit={recupera} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <Errore />
          {messaggio && <p className="text-sm text-ok">{messaggio}</p>}
          <Button size="lg" disabled={attesa}>
            {attesa && <Loader2 className="animate-spin" />} Mandatemi il link
          </Button>
          <Button type="button" variant="link" onClick={() => setVista("login")}>
            Torna all'accesso
          </Button>
        </form>
      </Cornice>
    );

  return (
    <Cornice titolo="Entrate per gestire invitati e conferme">
      <form onSubmit={entra} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="pw">Password</Label>
            <button type="button" className="text-xs text-muted-foreground underline-offset-4 hover:underline" onClick={() => setVista("recupero")}>
              Dimenticata?
            </button>
          </div>
          <Input id="pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <Errore />
        <Button size="lg" disabled={attesa}>
          {attesa && <Loader2 className="animate-spin" />} Entra
        </Button>
      </form>
    </Cornice>
  );
}
