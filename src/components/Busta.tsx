import { useEffect, useState } from "react";
import { DATA_ROMANA, SPOSI } from "../config";
import { riduciMovimento, vibra } from "../lib/calendario";
import { Filigrana, Stelle } from "./Ornamenti";

/** La busta con il sigillo di ceralacca che si apre all'avvio. */
export function Busta({ onFine }: { onFine: () => void }) {
  const [stato, setStato] = useState<"chiusa" | "aperta" | "via">("chiusa");

  const apri = () => {
    if (stato !== "chiusa") return;
    vibra([8, 40, 14]);
    setStato("aperta");
    setTimeout(() => setStato("via"), 1150);
    setTimeout(onFine, 1850);
  };

  useEffect(() => {
    if (riduciMovimento()) onFine();
  }, [onFine]);

  // Blocca lo scroll della pagina sotto la busta
  useEffect(() => {
    const prima = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prima;
    };
  }, []);

  return (
    <div
      className={"busta-scena " + stato}
      onClick={apri}
      role="button"
      tabIndex={0}
      autoFocus
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && apri()}
      aria-label="Aprite l'invito"
    >
      <Stelle n={22} />
      <div className="busta">
        <div className="lettera">
          <Filigrana w={150} />
          <p className="lettera-nomi">
            {SPOSI.lui} &amp; {SPOSI.lei}
          </p>
          <p className="lettera-data">{DATA_ROMANA}</p>
        </div>
        <div className="busta-fronte" />
        <div className="busta-lembo" />
        <div className="sigillo-grande">
          <span className="meta sx" />
          <span className="meta dx" />
          <span className="cifra">{SPOSI.iniziali}</span>
        </div>
      </div>
      <p className="busta-invito">Toccate il sigillo</p>
    </div>
  );
}
