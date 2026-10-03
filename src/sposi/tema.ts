import { useEffect, useState } from "react";

export type Tema = "chiaro" | "scuro" | "sistema";
const CHIAVE = "sposi:tema";

const leggi = (): Tema => {
  try {
    return (localStorage.getItem(CHIAVE) as Tema) || "sistema";
  } catch {
    return "sistema";
  }
};

function applica(t: Tema) {
  const scuro = t === "scuro" || (t === "sistema" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", scuro);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", scuro ? "#121814" : "#F7F3E8");
}

export function useTema() {
  const [tema, setTema] = useState<Tema>(leggi);
  useEffect(() => {
    applica(tema);
    try {
      localStorage.setItem(CHIAVE, tema);
    } catch {
      /* ignora */
    }
    if (tema !== "sistema") return;
    const m = window.matchMedia("(prefers-color-scheme: dark)");
    const f = () => applica("sistema");
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, [tema]);
  return [tema, setTema] as const;
}

// applica subito il tema salvato, prima del primo disegno (niente lampo bianco)
applica(leggi());
