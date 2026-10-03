import { Suspense, lazy, useMemo, type ReactNode } from "react";
import { Link } from "react-router";
import { ArrowRight, Baby, CalendarHeart, Clock, Send, ShieldQuestion, TriangleAlert, UserPen, Users } from "lucide-react";
import { Skeleton } from "@/sposi/ui/skeleton";
import { cn } from "@/sposi/lib/utils";
import { useDataEvento, useFamiglie } from "../query";
import { useAzioniUi } from "../azioni-ui";
import { totali, type Famiglia } from "../famiglie";
import { dataRelativa } from "../dati";
import { StatoBadge } from "../components/Stato";

const Grafico = lazy(() => import("../components/GraficoConferme"));

const saluto = () => {
  const h = new Date().getHours();
  return h < 13 ? "Buongiorno" : h < 18 ? "Buon pomeriggio" : "Buonasera";
};

export function Panoramica() {
  const { famiglie, prenotazioni, caricamento } = useFamiglie();
  const DATA_EVENTO = useDataEvento();
  const giorni = () => Math.max(0, Math.ceil((DATA_EVENTO.getTime() - Date.now()) / 864e5));
  const t = useMemo(() => (famiglie ? totali(famiglie) : null), [famiglie]);
  const { mostraFamiglia } = useAzioniUi();

  const senzaRisposta = useMemo(
    () =>
      (famiglie ?? [])
        .filter((f) => (f.stato === "inviato" || f.stato === "aperto") && f.invito?.inviato_il && Date.now() - new Date(f.invito.inviato_il).getTime() > 7 * 864e5)
        .sort((a, b) => a.invito!.inviato_il!.localeCompare(b.invito!.inviato_il!)),
    [famiglie],
  );
  const ultime = useMemo(
    () =>
      [...(famiglie ?? [])]
        .filter((f) => f.prenotazione)
        .sort((a, b) => b.prenotazione!.creata_il.localeCompare(a.prenotazione!.creata_il))
        .slice(0, 6),
    [famiglie],
  );

  if (caricamento || !t)
    return (
      <div className="mx-auto grid max-w-6xl gap-4">
        <Skeleton className="h-24" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    );

  const percentuale = t.inviti ? Math.round((t.confermate / t.inviti) * 100) : 0;

  return (
    <div className="mx-auto grid max-w-6xl gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{saluto()} 👋</p>
          <h1 className="font-serif text-4xl">Panoramica</h1>
        </div>
        <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-2.5">
          <CalendarHeart className="size-5 text-oro" />
          <div>
            <p className="font-serif text-2xl leading-none tabular">{giorni()} giorni</p>
            <p className="text-xs text-muted-foreground">{DATA_EVENTO.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}</p>
          </div>
        </div>
      </header>

      {/* numeri */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="col-span-2 rounded-2xl bg-primary p-5 text-primary-foreground lg:col-span-1">
          <p className="text-sm opacity-80">Persone confermate</p>
          <p className="mt-1 font-serif text-5xl leading-none tabular">{t.persone}</p>
          <p className="mt-3 flex items-center gap-3 text-sm opacity-85">
            <span className="inline-flex items-center gap-1">
              <Users className="size-4" /> {t.adulti} adulti
            </span>
            <span className="inline-flex items-center gap-1">
              <Baby className="size-4" /> {t.bambini} bimbi
            </span>
          </p>
        </div>
        <Numero titolo="Famiglie confermate" valore={`${t.confermate}`} sotto={`su ${t.inviti} inviti · ${percentuale}%`}>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-ok" style={{ width: `${percentuale}%` }} />
          </div>
        </Numero>
        <Numero titolo="In attesa di risposta" valore={t.inAttesa} sotto={`${t.daInviare} ancora da inviare`} a="/ospiti?filtro=in_attesa" />
        <Numero titolo="Seconda conferma" valore={`${t.riconfermate}`} sotto={`riconfermate · ${t.daRisentire} da risentire`} a="/ospiti?filtro=da_risentire" />
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        {/* grafico */}
        <section className="rounded-2xl border bg-card p-5">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-medium">Conferme nel tempo</h2>
            <span className="text-xs text-muted-foreground">persone confermate, giorno per giorno</span>
          </div>
          <Suspense fallback={<Skeleton className="h-56" />}>
            <Grafico prenotazioni={prenotazioni} previste={t.previste} />
          </Suspense>
        </section>

        {/* da fare */}
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="mb-3 font-medium">Da fare</h2>
          <ul className="grid gap-1">
            <DaFare icona={ShieldQuestion} tono="warn" n={t.daVerificare} testo={["conferma da verificare", "conferme da verificare"]} a="/ospiti?filtro=da_verificare" />
            <DaFare icona={UserPen} tono="warn" n={t.nomiMancanti} testo={["famiglia con nomi da completare", "famiglie con nomi da completare"]} a="/ospiti?filtro=nomi_mancanti" />
            <DaFare icona={Clock} tono="violet" n={senzaRisposta.length} testo={["senza risposta da più di 7 giorni", "senza risposta da più di 7 giorni"]} a="/ospiti?filtro=in_attesa" />
            <DaFare icona={Send} tono="info" n={t.daInviare} testo={["invito ancora da inviare", "inviti ancora da inviare"]} a="/ospiti?filtro=da_inviare" />
            <DaFare icona={TriangleAlert} tono="orange" n={t.conNote} testo={["famiglia con allergie o note", "famiglie con allergie o note"]} a="/ospiti?filtro=confermati" />
          </ul>
          {senzaRisposta.length > 0 && (
            <div className="mt-4 border-t pt-3">
              <p className="mb-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">Da sollecitare</p>
              <ul className="grid gap-1">
                {senzaRisposta.slice(0, 4).map((f) => (
                  <li key={f.chiave}>
                    <button onClick={() => mostraFamiglia(f.chiave)} className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent">
                      <span className="truncate">{f.nome}</span>
                      <span className="text-xs text-muted-foreground">inviato {dataRelativa(f.invito!.inviato_il!)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      {/* ultime risposte */}
      <section className="rounded-2xl border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">Ultime risposte</h2>
          <Link to="/ospiti" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            Tutti gli ospiti <ArrowRight className="size-4" />
          </Link>
        </div>
        {ultime.length ? (
          <ul className="divide-y">
            {ultime.map((f) => (
              <UltimaRisposta key={f.chiave} f={f} onApri={() => mostraFamiglia(f.chiave)} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Ancora nessuna risposta.</p>
        )}
      </section>
    </div>
  );
}

function Numero({ titolo, valore, sotto, a, children }: { titolo: string; valore: ReactNode; sotto: string; a?: string; children?: ReactNode }) {
  const corpo = (
    <>
      <p className="text-sm text-muted-foreground">{titolo}</p>
      <p className="mt-1 font-serif text-4xl leading-none tabular">{valore}</p>
      <p className="mt-2 text-xs text-muted-foreground">{sotto}</p>
      {children}
    </>
  );
  const cls = "rounded-2xl border bg-card p-5";
  return a ? (
    <Link to={a} className={cn(cls, "transition-colors hover:border-ring/60")}>
      {corpo}
    </Link>
  ) : (
    <div className={cls}>{corpo}</div>
  );
}

const TONI = { warn: "bg-warn-bg text-warn", violet: "bg-violet-bg text-violet", info: "bg-info-bg text-info", orange: "bg-orange-bg text-orange" };

function DaFare({ icona: I, n, testo, a, tono }: { icona: typeof Clock; n: number; testo: [string, string]; a: string; tono: keyof typeof TONI }) {
  return (
    <li>
      <Link to={a} className={cn("flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-accent", !n && "pointer-events-none opacity-45")}>
        <span className={cn("flex size-8 items-center justify-center rounded-lg", n ? TONI[tono] : "bg-muted text-muted-foreground")}>
          <I className="size-4" />
        </span>
        <span className="flex-1">
          <b className="tabular">{n}</b> {n === 1 ? testo[0] : testo[1]}
        </span>
        {n > 0 && <ArrowRight className="size-4 text-muted-foreground" />}
      </Link>
    </li>
  );
}

function UltimaRisposta({ f, onApri }: { f: Famiglia; onApri: () => void }) {
  const p = f.prenotazione!;
  return (
    <li>
      <button onClick={onApri} className="flex w-full items-center gap-3 py-2.5 text-left hover:opacity-80">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent font-serif text-sm">{f.nome.replace(/^(Famiglia|Fam\.)\s+/i, "").slice(0, 2)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{f.nome}</span>
          <span className="block text-xs text-muted-foreground">
            {p.stato === "annullata" ? "non viene" : `${p.persone} ${p.persone === 1 ? "persona" : "persone"}`} · {dataRelativa(p.creata_il)}
          </span>
        </span>
        <StatoBadge stato={f.stato} />
      </button>
    </li>
  );
}
