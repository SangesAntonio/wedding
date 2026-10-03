// Riconosce telefono ed email in un testo libero ("333 1234567", "mario@x.it", "+39 333…")
// e prepara i link per chiamare, scrivere su WhatsApp o mandare un'email.

export interface Contatto {
  telefono: string | null; // formato internazionale senza spazi, es. +393331234567
  email: string | null;
}

/** "333 123 4567" → "+393331234567"; "0039…" → "+39…"; numeri esteri con + restano tali. */
export function normalizzaTelefono(testo: string): string | null {
  const t = testo.trim();
  if (!t) return null;
  let cifre = t.replace(/[^\d+]/g, "");
  if (cifre.startsWith("00")) cifre = "+" + cifre.slice(2);
  if (!cifre.startsWith("+")) {
    // numeri italiani: cellulari (3…) e fissi (0…)
    if (/^[03]\d{5,10}$/.test(cifre)) cifre = "+39" + cifre;
    else return null;
  }
  const solo = cifre.slice(1).replace(/\+/g, "");
  return solo.length >= 8 && solo.length <= 15 ? "+" + solo : null;
}

export function leggiContatto(testo: string | null | undefined): Contatto {
  const t = (testo ?? "").trim();
  const email = /[^\s@]+@[^\s@]+\.[^\s@]+/.exec(t)?.[0] ?? null;
  const resto = email ? t.replace(email, " ") : t;
  const candidato = /\+?[\d][\d\s./-]{6,}\d/.exec(resto)?.[0] ?? "";
  return { telefono: normalizzaTelefono(candidato), email };
}

/** Per mostrarlo: +393331234567 → +39 333 123 4567 */
export function telefonoLeggibile(tel: string) {
  const m = /^\+39(\d{3})(\d{3})(\d+)$/.exec(tel);
  return m ? `+39 ${m[1]} ${m[2]} ${m[3]}` : tel;
}

export const linkChiamata = (tel: string) => `tel:${tel}`;
export const linkWhatsApp = (tel: string, testo?: string) =>
  `https://wa.me/${tel.replace(/^\+/, "")}${testo ? `?text=${encodeURIComponent(testo)}` : ""}`;
export const linkEmail = (email: string) => `mailto:${email}`;
