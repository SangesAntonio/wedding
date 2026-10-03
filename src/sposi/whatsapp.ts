// Apertura di WhatsApp dall'area sposi.
// Telefono: wa.me apre subito l'app. Computer: wa.me mostra una pagina intermedia ("usa l'app o il web?"),
// quindi si può andare dritti a WhatsApp Web (sempre nella stessa scheda) o all'app per computer.
import { useEffect, useState } from "react";

export type ModoWhatsApp = "web" | "app" | "chiedi";
const CHIAVE = "sposi:whatsapp";

export const eTelefono = () =>
  typeof window !== "undefined" && (window.matchMedia("(pointer: coarse)").matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

function leggi(): ModoWhatsApp {
  try {
    return (localStorage.getItem(CHIAVE) as ModoWhatsApp) || "web";
  } catch {
    return "web";
  }
}

export function useModoWhatsApp() {
  const [modo, setModo] = useState<ModoWhatsApp>(leggi);
  useEffect(() => {
    try {
      localStorage.setItem(CHIAVE, modo);
    } catch {
      /* ignora */
    }
  }, [modo]);
  return [modo, setModo] as const;
}

/** Apre una chat (con un messaggio già scritto, se c'è) nel modo scelto per questo dispositivo. */
export function apriWhatsApp(telefono: string, testo?: string) {
  const numero = telefono.replace(/\D/g, "");
  const t = testo ? encodeURIComponent(testo) : "";
  if (eTelefono()) {
    window.open(`https://wa.me/${numero}${t ? `?text=${t}` : ""}`, "_blank", "noopener");
    return;
  }
  const modo = leggi();
  if (modo === "app") {
    // protocollo dell'app per computer: il browser chiede il permesso solo la prima volta
    window.location.href = `whatsapp://send?phone=${numero}${t ? `&text=${t}` : ""}`;
  } else if (modo === "web") {
    // sempre la stessa scheda: l'invio in sequenza non apre decine di schede
    window.open(`https://web.whatsapp.com/send?phone=${numero}${t ? `&text=${t}` : ""}`, "whatsapp-web");
  } else {
    window.open(`https://wa.me/${numero}${t ? `?text=${t}` : ""}`, "_blank", "noopener");
  }
}
