import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Navigate, Route, Routes } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { Loader2, ShieldAlert } from "lucide-react";
import "./tema";
import "./app.css";
import { Accesso } from "./Accesso";
import { clientQuery, useMatrimonio, useTempoReale } from "./query";
import { AzioniUiProvider } from "./azioni-ui";
import { ConfermaProvider } from "./components/Conferma";
import { Shell } from "./components/Shell";
import { CercaRapida } from "./components/CercaRapida";
import { Finestre } from "./components/Finestre";
import { Panoramica } from "./pagine/Panoramica";
import { Ospiti } from "./pagine/Ospiti";
import { Impostazioni } from "./pagine/Impostazioni";
import { TooltipProvider } from "./ui/tooltip";
import { Button } from "./ui/button";
import { caricaEApplica } from "../lib/configMatrimonio";

function AreaSposi({ email, esci }: { email?: string; esci: () => void }) {
  const { data: matrimonio, isLoading, error } = useMatrimonio();
  useTempoReale();

  if (isLoading)
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  if (error || matrimonio === null)
    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <div className="max-w-sm rounded-2xl border bg-card p-6 text-center">
          <ShieldAlert className="mx-auto size-8 text-warn" />
          <p className="mt-3 font-serif text-2xl">
            {error ? "Dati non raggiungibili" : "Account non abilitato"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {error
              ? "Controllate la connessione e ricaricate la pagina."
              : "L'accesso funziona, ma l'account non è collegato al matrimonio. Vedete docs/LOGIN-SPOSI.md."}
          </p>
          <Button variant="outline" className="mt-4" onClick={esci}>
            Esci
          </Button>
        </div>
      </div>
    );

  return (
    <AzioniUiProvider>
      <ConfermaProvider>
        <Shell email={email} esci={esci}>
          <Routes>
            <Route path="/" element={<Panoramica />} />
            <Route path="/ospiti" element={<Ospiti />} />
            <Route
              path="/impostazioni"
              element={<Impostazioni email={email} esci={esci} />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Shell>
        <CercaRapida />
        <Finestre />
      </ConfermaProvider>
    </AzioniUiProvider>
  );
}

// le impostazioni del matrimonio (data, nomi…) prima del primo disegno
caricaEApplica().then(() =>
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={clientQuery}>
        <TooltipProvider delayDuration={300}>
          <HashRouter>
            <Accesso>
              {(sessione, esci) => (
                <AreaSposi
                  email={sessione?.user.email}
                  esci={() => {
                    clientQuery.clear();
                    esci();
                  }}
                />
              )}
            </Accesso>
          </HashRouter>
          <Toaster
            position="top-center"
            richColors
            closeButton
            toastOptions={{ className: "font-sans" }}
          />
        </TooltipProvider>
      </QueryClientProvider>
    </StrictMode>,
  ),
);
