import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { COLORI, ORDINE_SETTORI, POSTI, SETTORI, TAVOLI, liberiAlTavolo, type Occupati, type Posto, type SettoreId } from "../data/sala";
import { Foglia } from "./Ornamenti";

interface Props {
  occupati: Occupati;
  selezione: Posto[];
  onToggle: (id: string) => void;
  onAvviso: (msg: string) => void;
}

/** Alternativa alla sala 3D: settori a fisarmonica con la griglia dei posti. */
export function ElencoPosti({ occupati, selezione, onToggle, onAvviso }: Props) {
  const [aperto, setAperto] = useState<SettoreId | null>("vicino");
  const [tavolo, setTavolo] = useState("A1");
  const scelti = new Set(selezione.map((p) => p.id));

  const apri = (s: SettoreId) => {
    const nuovo = aperto === s ? null : s;
    setAperto(nuovo);
    if (nuovo) setTavolo(TAVOLI.filter((t) => t.set === s)[0].cod);
  };

  return (
    <div className="colonna">
      {ORDINE_SETTORI.map((k) => {
        const s = SETTORI[k];
        const tavoli = TAVOLI.filter((t) => t.set === k);
        const liberi = POSTI.filter((p) => p.set === k && !p.sposo && !occupati.has(p.id)).length;
        const sceltiQui = selezione.filter((p) => p.set === k).length;
        const isAperto = aperto === k;
        const postiTavolo = POSTI.filter((p) => p.tav === tavolo);
        return (
          <div key={k} className="card" style={{ borderColor: isAperto ? s.col : COLORI.linea, padding: 0, overflow: "hidden" }}>
            <button onClick={() => apri(k)} className="riga-settore" aria-expanded={isAperto}>
              <Foglia size={17} color={s.col} />
              <span className="riga-settore-tx">
                <span className="n">{s.nome}</span>
                <span className="s">
                  {liberi} liberi{sceltiQui ? ` · ${sceltiQui} scelti` : ""}
                </span>
              </span>
              <span className="prezzo-set" style={{ color: s.col }}>
                {s.prezzo} €
              </span>
              <ChevronDown size={18} style={{ color: COLORI.soft, transform: isAperto ? "rotate(180deg)" : "none", transition: "transform .25s" }} />
            </button>
            {isAperto && (
              <div className="pannello anim-entra">
                <p className="desc">{s.desc}</p>
                {tavoli.length > 1 && (
                  <div className="chips">
                    {tavoli.map((t) => {
                      const on = tavolo === t.cod;
                      return (
                        <button
                          key={t.cod}
                          onClick={() => setTavolo(t.cod)}
                          className="chip"
                          style={{ background: on ? s.col : s.soft, color: on ? COLORI.carta : s.col, borderColor: on ? s.col : "transparent" }}
                        >
                          Tavolo {t.cod} <span style={{ opacity: 0.7 }}>· {liberiAlTavolo(t.cod, occupati)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="griglia-posti">
                  {postiTavolo.map((p) => {
                    if (p.sposo)
                      return (
                        <div key={p.id} className="posto" style={{ background: COLORI.oro, borderColor: COLORI.oro, color: COLORI.carta }}>
                          <span className="pn">{p.iniziale}</span>
                          <span className="ps">sposi</span>
                        </div>
                      );
                    const on = scelti.has(p.id);
                    const chi = occupati.get(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => (chi ? onAvviso(`Posto già scelto da ${chi}. Chiedete di spostarsi, se avete coraggio.`) : onToggle(p.id))}
                        className={"posto" + (on ? " posto-on" : "")}
                        aria-pressed={on}
                        aria-label={`Tavolo ${p.tav}, posto ${p.num}: ${on ? "scelto" : chi ? "preso" : "libero"}`}
                        style={{
                          background: on ? "#8B8B85" : chi ? "#FFFFFF" : s.soft,
                          borderColor: on ? "#8B8B85" : chi ? COLORI.linea : s.col,
                          color: on ? "#FFFFFF" : chi ? "#C2BDB0" : s.col,
                        }}
                      >
                        <span className="pn">{p.num}</span>
                        <span className="ps">{on ? "scelto" : chi ? "preso" : "libero"}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
