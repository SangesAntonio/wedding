import { DATA_EVENTO, DURATA_ORE, LUOGO, SPOSI } from "../config";

const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Scarica un file .ics che si apre in Calendario (iOS), Google Calendar, Outlook. */
export function scaricaEventoCalendario(dettagli: string) {
  const fine = new Date(DATA_EVENTO.getTime() + DURATA_ORE * 3600_000);
  const esc = (s: string) => s.replace(/[\\,;]/g, (c) => "\\" + c).replace(/\n/g, "\\n");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Invito A&R//IT",
    "BEGIN:VEVENT",
    `UID:matrimonio-${fmt(DATA_EVENTO)}@invito`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(DATA_EVENTO)}`,
    `DTEND:${fmt(fine)}`,
    `SUMMARY:${esc(`Matrimonio ${SPOSI.lui} & ${SPOSI.lei}`)}`,
    `LOCATION:${esc(`${LUOGO.nome}, ${LUOGO.indirizzo}`)}`,
    `GEO:${LUOGO.lat};${LUOGO.lng}`,
    `DESCRIPTION:${esc(dettagli)}`,
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    "DESCRIPTION:Domani si sposano!",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "matrimonio-antonio-rosa.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const vibra = (p: number | number[]) => {
  if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(p);
};

export const riduciMovimento = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
