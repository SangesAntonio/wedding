import { useEffect, useState } from "react";

export function useMediaQuery(query: string) {
  const [ok, setOk] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const cambia = () => setOk(m.matches);
    cambia();
    m.addEventListener("change", cambia);
    return () => m.removeEventListener("change", cambia);
  }, [query]);
  return ok;
}

/** Computer o tablet in orizzontale: barra laterale e pannelli laterali. */
export const useDesktop = () => useMediaQuery("(min-width: 1024px)");
/** Da tablet in su: il dettaglio si apre di lato invece che dal basso. */
export const useLargo = () => useMediaQuery("(min-width: 768px)");
