import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Prenotazione } from "../dati";

const fmt = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" });

/** Persone confermate cumulate giorno per giorno (le annullate non contano). */
export default function GraficoConferme({ prenotazioni, previste }: { prenotazioni: Prenotazione[]; previste: number }) {
  const dati = useMemo(() => {
    const attive = prenotazioni.filter((p) => p.stato !== "annullata");
    if (!attive.length) return [];
    const perGiorno = new Map<string, number>();
    attive.forEach((p) => {
      const g = p.creata_il.slice(0, 10);
      perGiorno.set(g, (perGiorno.get(g) ?? 0) + p.persone);
    });
    const inizio = new Date([...perGiorno.keys()].sort()[0]);
    inizio.setDate(inizio.getDate() - 1);
    const out: { giorno: string; persone: number }[] = [];
    let somma = 0;
    for (const d = new Date(inizio); d <= new Date(); d.setDate(d.getDate() + 1)) {
      const g = d.toISOString().slice(0, 10);
      somma += perGiorno.get(g) ?? 0;
      out.push({ giorno: fmt.format(d), persone: somma });
    }
    return out;
  }, [prenotazioni]);

  if (!dati.length) return <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">Il grafico si riempie con le prime conferme.</div>;

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={dati} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id="riemp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="giorno" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} minTickGap={24} />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} allowDecimals={false} domain={[0, (max: number) => Math.max(max, previste || 0)]} />
          {previste > 0 && <ReferenceLine y={previste} stroke="var(--oro)" strokeDasharray="4 4" label={{ value: `previste ${previste}`, position: "insideTopRight", fontSize: 11, fill: "var(--oro)" }} />}
          <Tooltip
            cursor={{ stroke: "var(--border)" }}
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12, color: "var(--popover-foreground)" }}
            formatter={(v) => [`${v} persone`, "Confermate"]}
          />
          <Area type="monotone" dataKey="persone" stroke="var(--chart-1)" strokeWidth={2} fill="url(#riemp)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
