import { cn } from "@/sposi/lib/utils";
import { RICHIAMI, STATI, type StatoFamiglia, type Tono } from "../famiglie";
import type { Richiamo } from "../dati";

const TONI: Record<Tono, string> = {
  ok: "bg-ok-bg text-ok",
  info: "bg-info-bg text-info",
  warn: "bg-warn-bg text-warn",
  orange: "bg-orange-bg text-orange",
  violet: "bg-violet-bg text-violet",
  neutral: "bg-neutral-bg text-neutral",
};
const PUNTI: Record<Tono, string> = {
  ok: "bg-ok",
  info: "bg-info",
  warn: "bg-warn",
  orange: "bg-orange",
  violet: "bg-violet",
  neutral: "bg-neutral",
};

export function Pillola({ tono, children, className }: { tono: Tono; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap", TONI[tono], className)}>
      <span className={cn("size-1.5 rounded-full", PUNTI[tono])} />
      {children}
    </span>
  );
}

export function StatoBadge({ stato, className }: { stato: StatoFamiglia; className?: string }) {
  return (
    <Pillola tono={STATI[stato].tono} className={className}>
      {STATI[stato].etichetta}
    </Pillola>
  );
}

export function RichiamoBadge({ richiamo, className }: { richiamo: Richiamo; className?: string }) {
  return (
    <Pillola tono={RICHIAMI[richiamo].tono} className={className}>
      {RICHIAMI[richiamo].etichetta}
    </Pillola>
  );
}

/** Pallino colorato da solo (liste compatte su telefono). */
export function Punto({ tono, className }: { tono: Tono; className?: string }) {
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", PUNTI[tono], className)} />;
}
