import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { COLORI, hash } from "../data/sala";
import { riduciMovimento } from "../lib/calendario";

export function Foglia({ size = 14, color = COLORI.salvia, style }: { size?: number; color?: string; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style} aria-hidden="true">
      <path d="M12 22C12 14 6 10 3 3c9 0 18 4 18 12 0 4-4 7-9 7z" fill={color} opacity="0.9" />
      <path d="M12 22C11 16 8 10 3 3" stroke={COLORI.carta} strokeWidth="1.1" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

export function Filigrana({ w = 260 }: { w?: number }) {
  return (
    <svg viewBox="0 0 260 34" width={w} height={34 * (w / 260)} fill="none" className="filigrana" style={{ maxWidth: "100%" }} aria-hidden="true">
      <path className="tratto" d="M4 17h72c10 0 14-9 24-9s14 9 24 9" stroke={COLORI.salvia} strokeWidth="1.1" strokeLinecap="round" />
      <path className="tratto" d="M256 17h-72c-10 0-14 9-24 9s-14-9-24-9" stroke={COLORI.salvia} strokeWidth="1.1" strokeLinecap="round" />
      <path className="tratto" d="M112 17c6-7 12-7 18 0-6 7-12 7-18 0z" stroke={COLORI.oro} strokeWidth="1.1" />
      <circle cx="130" cy="17" r="2.4" fill={COLORI.oro} className="gemma" />
      <path className="tratto" d="M76 17c-5-6-12-6-16 1M184 17c5-6 12-6 16 1" stroke={COLORI.salvia} strokeWidth="1" strokeLinecap="round" opacity=".75" />
    </svg>
  );
}

const ANGOLI = {
  tl: { rot: 0, pos: { top: 10, left: 10 } },
  tr: { rot: 90, pos: { top: 10, right: 10 } },
  br: { rot: 180, pos: { bottom: 10, right: 10 } },
  bl: { rot: 270, pos: { bottom: 10, left: 10 } },
};

export function Angolo({ pos }: { pos: keyof typeof ANGOLI }) {
  const { rot, pos: p } = ANGOLI[pos];
  return (
    <svg
      width="42"
      height="42"
      viewBox="0 0 42 42"
      fill="none"
      aria-hidden="true"
      style={{ position: "absolute", ...p, transform: `rotate(${rot}deg)`, opacity: 0.55, pointerEvents: "none" }}
    >
      <path d="M2 20C2 10 10 2 20 2" stroke={COLORI.salvia} strokeWidth="1" strokeLinecap="round" />
      <path d="M2 32c6-2 10-6 12-12" stroke={COLORI.oro} strokeWidth="1" strokeLinecap="round" opacity=".8" />
      <circle cx="20" cy="2" r="1.8" fill={COLORI.oro} />
      <path d="M8 14c4-1 6-3 7-7" stroke={COLORI.salvia} strokeWidth=".9" strokeLinecap="round" opacity=".7" />
    </svg>
  );
}

export function Stelle({ n = 16 }: { n?: number }) {
  const stelle = useMemo(
    () =>
      Array.from({ length: n }, (_, a) => ({
        l: hash("x" + a) % 100,
        t: hash("y" + a) % 100,
        d: (hash("d" + a) % 40) / 10,
        s: 2 + (hash("s" + a) % 3),
      })),
    [n],
  );
  return (
    <div className="stelle" aria-hidden="true">
      {stelle.map((s, i) => (
        <span key={i} className="stella" style={{ left: `${s.l}%`, top: `${s.t}%`, width: s.s, height: s.s, animationDelay: `${s.d}s` }} />
      ))}
    </div>
  );
}

/** Numero che "scorre" fino al nuovo valore. */
export function useNumeroAnimato(valore: number) {
  const [mostrato, setMostrato] = useState(valore);
  const ultimo = useRef(valore);
  useEffect(() => {
    if (riduciMovimento() || ultimo.current === valore) {
      ultimo.current = valore;
      setMostrato(valore);
      return;
    }
    const da = ultimo.current;
    const diff = valore - da;
    const t0 = performance.now();
    let raf = 0;
    const passo = (t: number) => {
      const f = Math.min(1, (t - t0) / 460);
      setMostrato(Math.round(da + diff * (1 - Math.pow(1 - f, 3))));
      if (f < 1) raf = requestAnimationFrame(passo);
      else ultimo.current = valore;
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [valore]);
  return mostrato;
}
