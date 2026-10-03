// Finestre aperte da più punti (barra, ricerca rapida, dettaglio): un unico stato condiviso.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router";
import type { Famiglia } from "./famiglie";
import type { Invito } from "./inviti";

export type FinestraAperta =
  | { tipo: "nuovo-invito" }
  | { tipo: "modifica-invito"; invito: Invito }
  | { tipo: "importa" }
  | { tipo: "sequenza"; inviti?: Invito[] }
  | { tipo: "prenotazione"; famiglia?: Famiglia } // nuova (eventualmente per un invito) o modifica
  | { tipo: "messaggio" }
  | null;

interface Ctx {
  finestra: FinestraAperta;
  apri: (f: Exclude<FinestraAperta, null>) => void;
  chiudi: () => void;
  cercaAperta: boolean;
  setCercaAperta: (v: boolean) => void;
  /** apre il dettaglio di una famiglia nella pagina Ospiti */
  mostraFamiglia: (chiave: string) => void;
}

const Contesto = createContext<Ctx | null>(null);

export function AzioniUiProvider({ children }: { children: ReactNode }) {
  const [finestra, setFinestra] = useState<FinestraAperta>(null);
  const [cercaAperta, setCercaAperta] = useState(false);
  const naviga = useNavigate();
  const [, setParams] = useSearchParams();

  const mostraFamiglia = useCallback(
    (chiave: string) => {
      if (window.location.hash.startsWith("#/ospiti")) setParams((p) => (p.set("f", chiave), p));
      else naviga(`/ospiti?f=${encodeURIComponent(chiave)}`);
    },
    [naviga, setParams],
  );

  const v = useMemo<Ctx>(
    () => ({ finestra, apri: setFinestra, chiudi: () => setFinestra(null), cercaAperta, setCercaAperta, mostraFamiglia }),
    [finestra, cercaAperta, mostraFamiglia],
  );
  return <Contesto.Provider value={v}>{children}</Contesto.Provider>;
}

export function useAzioniUi() {
  const c = useContext(Contesto);
  if (!c) throw new Error("useAzioniUi fuori dal provider");
  return c;
}
