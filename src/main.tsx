import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import { applica, caricaEApplica, configPredefinita, unisci } from "./lib/configMatrimonio";
import { IN_ANTEPRIMA, type MessaggioAnteprima } from "./lib/anteprima";
import { DATA_EVENTO, SPOSI } from "./config";

/** In anteprima ridisegna l'invito ogni volta che l'area sposi manda impostazioni nuove. */
function Radice() {
  const [, setVersione] = useState(0);
  useEffect(() => {
    if (!IN_ANTEPRIMA) return;
    const ricevi = (e: MessageEvent<MessaggioAnteprima>) => {
      if (e.origin !== window.location.origin || e.data?.tipo !== "invito-anteprima") return;
      applica(unisci(e.data.config));
      setVersione((v) => v + 1);
    };
    window.addEventListener("message", ricevi);
    window.parent.postMessage({ tipo: "invito-anteprima-pronta" }, window.location.origin);
    return () => window.removeEventListener("message", ricevi);
  }, []);
  return <App />;
}

async function avvia() {
  // le impostazioni del matrimonio arrivano prima del primo disegno (massimo 2,5 s, poi valgono quelle predefinite)
  if (IN_ANTEPRIMA) applica(configPredefinita());
  else await caricaEApplica();
  document.title = `${SPOSI.lui} & ${SPOSI.lei} — ${DATA_EVENTO.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}`;
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <Radice />
    </StrictMode>,
  );
}
avvia();
