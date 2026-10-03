import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

/** Finestra in primo piano: a tutto schermo dal basso su telefono, centrata su computer. */
export function Finestra({ titolo, onChiudi, children, larga }: { titolo: string; onChiudi: () => void; children: ReactNode; larga?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onChiudi();
    window.addEventListener("keydown", k);
    const prima = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = prima;
    };
  }, [onChiudi]);

  return (
    <div className="finestra-sfondo" onMouseDown={(e) => e.target === e.currentTarget && onChiudi()}>
      <div className={"finestra" + (larga ? " larga" : "")} role="dialog" aria-modal="true" aria-label={titolo}>
        <div className="finestra-testa">
          <h2>{titolo}</h2>
          <button className="cmd" onClick={onChiudi} aria-label="Chiudi">
            <X size={16} />
          </button>
        </div>
        <div className="finestra-corpo">{children}</div>
      </div>
    </div>
  );
}
