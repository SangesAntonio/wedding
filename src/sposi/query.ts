// Un solo archivio dati per tutta l'area sposi (TanStack Query): ogni pagina legge da qui,
// ogni modifica rilegge i dati, e gli aggiornamenti in tempo reale invalidano la cache.
import { useEffect, useMemo } from "react";
import { QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  aggiornaPrenotazione,
  ascoltaCambi,
  caricaMatrimonio,
  caricaPrenotazioni,
  caricaStorico,
  creaPrenotazione,
  messaggioErrore,
  type NuovaPrenotazioneSposi,
  type Prenotazione,
} from "./dati";
import { aggiornaInvito, caricaInviti, creaInviti, eliminaInvito, leggiMessaggio, salvaMessaggio, type Invito, type NuovoInvito } from "./inviti";
import { costruisciFamiglie } from "./famiglie";

export const clientQuery = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 } },
});

const K = {
  matrimonio: ["matrimonio"] as const,
  prenotazioni: (m: string) => ["prenotazioni", m] as const,
  inviti: (m: string) => ["inviti", m] as const,
  messaggio: (m: string) => ["messaggio", m] as const,
  storico: (p: string) => ["storico", p] as const,
};

export function useMatrimonio() {
  return useQuery({ queryKey: K.matrimonio, queryFn: caricaMatrimonio, staleTime: Infinity });
}

/** Inviti + prenotazioni già uniti in famiglie, con aggiornamento in tempo reale. */
/**
 * Aggiornamento in tempo reale: UN solo collegamento per tutta l'area sposi (va chiamato una volta,
 * in alto). Se ogni componente aprisse il suo, la libreria riuserebbe lo stesso canale e darebbe errore.
 */
export function useTempoReale() {
  const { data: m } = useMatrimonio();
  const qc = useQueryClient();
  useEffect(() => {
    if (!m) return;
    return ascoltaCambi(() => {
      qc.invalidateQueries({ queryKey: ["prenotazioni"] });
      qc.invalidateQueries({ queryKey: ["inviti"] });
      qc.invalidateQueries({ queryKey: ["storico"] });
    });
  }, [m, qc]);
}

export function useFamiglie() {
  const { data: m } = useMatrimonio();
  const id = m?.id ?? "";
  const pren = useQuery({ queryKey: K.prenotazioni(id), queryFn: () => caricaPrenotazioni(id), enabled: !!m });
  const inv = useQuery({ queryKey: K.inviti(id), queryFn: () => caricaInviti(id), enabled: !!m });

  const famiglie = useMemo(() => (pren.data && inv.data ? costruisciFamiglie(inv.data, pren.data) : undefined), [pren.data, inv.data]);
  return {
    famiglie,
    prenotazioni: pren.data ?? [],
    inviti: inv.data ?? [],
    caricamento: pren.isLoading || inv.isLoading,
    errore: pren.error || inv.error,
    aggiornando: pren.isFetching || inv.isFetching,
    ricarica: () => Promise.all([pren.refetch(), inv.refetch()]),
  };
}

export function useMessaggio() {
  const { data: m } = useMatrimonio();
  return useQuery({ queryKey: K.messaggio(m?.id ?? ""), queryFn: () => leggiMessaggio(m!.id), enabled: !!m });
}

export function useStorico(prenotazioneId: string | undefined) {
  return useQuery({ queryKey: K.storico(prenotazioneId ?? ""), queryFn: () => caricaStorico(prenotazioneId!), enabled: !!prenotazioneId });
}

/** Tutte le modifiche, con notifica di successo/errore e rilettura dei dati. */
export function useAzioni() {
  const qc = useQueryClient();
  const { data: m } = useMatrimonio();
  const rileggi = () => qc.invalidateQueries({ predicate: (q) => ["prenotazioni", "inviti", "storico", "messaggio"].includes(q.queryKey[0] as string) });

  const crea = <A,>(fn: (a: A) => Promise<unknown>, ok?: string | ((a: A) => string)) =>
    useMutation({
      mutationFn: fn,
      onSuccess: (_r, a) => ok && toast.success(typeof ok === "function" ? ok(a) : ok),
      onError: (e) => toast.error(messaggioErrore(e)),
      onSettled: rileggi,
    });

  return {
    aggiornaPrenotazione: crea(({ id, modifiche }: { id: string; modifiche: Partial<Prenotazione> }) => aggiornaPrenotazione(id, modifiche)),
    creaPrenotazione: crea((p: NuovaPrenotazioneSposi) => creaPrenotazione(m!.id, p), "Prenotazione aggiunta"),
    creaInviti: crea((n: NuovoInvito[]) => creaInviti(m!.id, n), (n) => (n.length === 1 ? "Invito aggiunto" : `${n.length} inviti aggiunti`)),
    aggiornaInvito: crea(({ id, modifiche }: { id: string; modifiche: Partial<Invito> }) => aggiornaInvito(id, modifiche)),
    eliminaInvito: crea((id: string) => eliminaInvito(id), "Invito eliminato"),
    salvaMessaggio: crea((t: string) => salvaMessaggio(m!.id, t), "Messaggio salvato"),
  };
}
