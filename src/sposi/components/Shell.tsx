import { useEffect, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router";
import { ExternalLink, LayoutDashboard, LogOut, Moon, Plus, Search, Settings, Sun, Users } from "lucide-react";
import { SPOSI } from "../../config";
import { MODALITA_DEMO } from "../../lib/supabase";
import { Button } from "@/sposi/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/sposi/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/sposi/ui/dropdown-menu";
import { cn } from "@/sposi/lib/utils";
import { useDesktop } from "../hooks/useMediaQuery";
import { useTema } from "../tema";
import { useAzioniUi } from "../azioni-ui";
import { useDataEvento, useFamiglie } from "../query";
import { totali } from "../famiglie";

const VOCI = [
  { a: "/", icona: LayoutDashboard, testo: "Panoramica" },
  { a: "/ospiti", icona: Users, testo: "Ospiti" },
  { a: "/impostazioni", icona: Settings, testo: "Impostazioni" },
];

const linkInvito = () => new URL("../", window.location.href).toString().split("#")[0];

export function Shell({ email, esci, children }: { email?: string; esci: () => void; children: ReactNode }) {
  const desktop = useDesktop();
  const data = useDataEvento();
  const dataEvento = data.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
  const giorni = () => Math.max(0, Math.ceil((data.getTime() - Date.now()) / 864e5));
  const { setCercaAperta, apri } = useAzioniUi();
  const { famiglie } = useFamiglie();
  const daVerificare = famiglie ? totali(famiglie).daVerificare : 0;
  const [tema, setTema] = useTema();
  const scuro = tema === "scuro" || (tema === "sistema" && document.documentElement.classList.contains("dark"));
  const { pathname } = useLocation();
  const titolo = VOCI.find((v) => v.a === pathname)?.testo ?? "Area sposi";

  // Ctrl+K / Cmd+K apre la ricerca rapida
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCercaAperta(true);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [setCercaAperta]);

  if (desktop)
    return (
      <div className="flex min-h-dvh">
        <aside className="sticky top-0 flex h-dvh w-64 shrink-0 flex-col border-r bg-sidebar px-3 py-5">
          <div className="flex items-center gap-3 px-2">
            <div className="flex size-10 items-center justify-center rounded-full border border-oro/50 bg-card font-serif text-sm text-oro">{SPOSI.iniziali}</div>
            <div className="min-w-0">
              <p className="truncate font-serif text-xl leading-tight">
                {SPOSI.lui} &amp; {SPOSI.lei}
              </p>
              <p className="text-xs text-muted-foreground">
                {dataEvento} · tra {giorni()} giorni
              </p>
            </div>
          </div>

          <button
            onClick={() => setCercaAperta(true)}
            className="mt-6 flex h-9 items-center gap-2 rounded-lg border bg-background px-3 text-sm text-muted-foreground transition-colors hover:border-ring/60"
          >
            <Search className="size-4" /> Cerca…
            <kbd className="ml-auto rounded border bg-muted px-1.5 font-mono text-[10px]">Ctrl K</kbd>
          </button>

          <nav className="mt-4 grid gap-0.5">
            {VOCI.map(({ a, icona: I, testo }) => (
              <NavLink
                key={a}
                to={a}
                end
                className={({ isActive }) =>
                  cn(
                    "flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
                    isActive && "bg-sidebar-accent text-sidebar-foreground",
                  )
                }
              >
                <I className="size-4" /> {testo}
                {a === "/ospiti" && daVerificare > 0 && (
                  <span className="ml-auto rounded-full bg-oro px-1.5 text-[11px] leading-5 font-semibold text-white tabular">{daVerificare}</span>
                )}
              </NavLink>
            ))}
          </nav>

          <Button className="mt-4 justify-start" onClick={() => apri({ tipo: "nuovo-invito" })}>
            <Plus /> Nuovo invito
          </Button>

          <div className="mt-auto grid gap-1 border-t pt-4">
            <a href={linkInvito()} target="_blank" rel="noopener" className="flex h-9 items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground">
              <ExternalLink className="size-4" /> Apri l'invito
            </a>
            <button
              onClick={() => setTema(scuro ? "chiaro" : "scuro")}
              className="flex h-9 items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
            >
              {scuro ? <Sun className="size-4" /> : <Moon className="size-4" />} Tema {scuro ? "chiaro" : "scuro"}
            </button>
            <div className="mt-2 flex items-center gap-2 px-3">
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{MODALITA_DEMO ? "Modalità demo" : email}</span>
              {!MODALITA_DEMO && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8" onClick={esci} aria-label="Esci">
                      <LogOut className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Esci</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-8 py-7">{children}</main>
      </div>
    );

  // telefono e tablet in verticale
  return (
    <div className="min-h-dvh pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 border-b bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="flex h-14 items-center gap-2 px-4">
          <div className="flex size-8 items-center justify-center rounded-full border border-oro/50 bg-card font-serif text-xs text-oro">{SPOSI.iniziali}</div>
          <h1 className="font-serif text-2xl leading-none">{titolo}</h1>
          <Button variant="ghost" size="icon" className="ml-auto" onClick={() => setCercaAperta(true)} aria-label="Cerca">
            <Search />
          </Button>
        </div>
      </header>
      <main className="px-4 py-4">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="grid h-16 grid-cols-4">
          {VOCI.slice(0, 2).map((v) => (
            <VoceBassa key={v.a} {...v} pallino={v.a === "/ospiti" ? daVerificare : 0} />
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex flex-col items-center justify-center" aria-label="Aggiungi">
                <span className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
                  <Plus className="size-5" />
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="center" className="w-56">
              <DropdownMenuItem onClick={() => apri({ tipo: "nuovo-invito" })}>Nuovo invito</DropdownMenuItem>
              <DropdownMenuItem onClick={() => apri({ tipo: "prenotazione" })}>Prenotazione a mano</DropdownMenuItem>
              <DropdownMenuItem onClick={() => apri({ tipo: "importa" })}>Carica Excel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <VoceBassa {...VOCI[2]} />
        </div>
      </nav>
    </div>
  );
}

function VoceBassa({ a, icona: I, testo, pallino = 0 }: { a: string; icona: typeof Users; testo: string; pallino?: number }) {
  return (
    <NavLink to={a} end className={({ isActive }) => cn("relative flex flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground", isActive && "text-foreground")}>
      <I className="size-5" />
      {testo}
      {pallino > 0 && <span className="absolute top-2 left-1/2 ml-2 rounded-full bg-oro px-1.5 text-[10px] leading-4 font-semibold text-white">{pallino}</span>}
    </NavLink>
  );
}
