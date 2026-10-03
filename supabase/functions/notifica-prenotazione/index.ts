// Edge Function di Supabase: riceve i "Database Webhook" su `prenotazioni` e manda un'email agli sposi
// tramite Resend (https://resend.com, piano gratuito).
//   INSERT  → nuova conferma
//   UPDATE  → solo se a modificare è stato l'invitato: modifica, annullamento, ripensamento
//
// Segreti da impostare (Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY   chiave di Resend
//   EMAIL_SPOSI      indirizzo (o indirizzi separati da virgola) che riceve le notifiche
//   WEBHOOK_SECRET   una parola segreta qualsiasi, uguale a quella messa nell'header del webhook
//   EMAIL_MITTENTE   facoltativo; senza un dominio verificato su Resend usare "onboarding@resend.dev"

interface Ospite {
  nome: string;
  bambino?: boolean;
}
interface Riga {
  nome: string;
  persone: number;
  posti?: string[];
  ospiti?: Ospite[];
  contatto?: string | null;
  note?: string | null;
  supplementi?: string[];
  totale: number;
  codice: string;
  stato: string;
  modificata_da?: string | null;
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const persone = (n: number) => `${n} ${n === 1 ? "persona" : "persone"}`;
const nomi = (o?: Ospite[]) => (o ?? []).map((x) => x.nome + (x.bambino ? " (bimbo)" : "")).join(", ") || "—";

function tabella(righe: [string, string][]) {
  return `<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;width:100%">${righe
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#79877C;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:6px 0">${esc(v)}</td></tr>`,
    )
    .join("")}</table>`;
}

function corpo(titolo: string, sotto: string, righe: [string, string][]) {
  return `<div style="font-family:Georgia,serif;color:#2B3A31;max-width:560px">
    <h2 style="font-weight:400;margin:0 0 4px">${esc(titolo)}</h2>
    <p style="color:#79877C;margin:0 0 16px;font-family:Arial,sans-serif;font-size:13px">${esc(sotto)}</p>
    ${tabella(righe)}
  </div>`;
}

function dettagli(p: Riga): [string, string][] {
  return [
    ["Persone", String(p.persone)],
    ["Ospiti", nomi(p.ospiti)],
    ["Posti", (p.posti ?? []).join(", ")],
    ["Contatto", p.contatto || "—"],
    ["Note", p.note || "—"],
    ["Supplementi", (p.supplementi ?? []).join(", ") || "—"],
    ["Totale indicato", `${p.totale} €`],
    ["Codice", p.codice],
  ];
}

function componi(tipo: string, p: Riga, o?: Riga): { oggetto: string; html: string } | null {
  if (tipo === "INSERT") {
    const daVerificare = p.stato === "da_verificare";
    return {
      oggetto: `${daVerificare ? "[Da verificare] " : ""}Conferma: ${p.nome} · ${persone(p.persone)}`,
      html: corpo("Nuova conferma 🌿", `${p.nome} ha confermato per ${persone(p.persone)}.`, [
        ["Stato", daVerificare ? "Da verificare (arrivata dal link generico)" : "Confermata dal link personale"],
        ["Nome", p.nome],
        ...dettagli(p),
      ]),
    };
  }
  if (tipo !== "UPDATE" || !o || p.modificata_da !== "invitato") return null;

  if (p.stato === "annullata" && o.stato !== "annullata")
    return {
      oggetto: `[Annullata] ${p.nome} non viene più`,
      html: corpo("Presenza annullata", `${p.nome} ha annullato la prenotazione (${persone(o.persone)}).`, [
        ["Erano", nomi(o.ospiti)],
        ["Codice", p.codice],
      ]),
    };
  if (o.stato === "annullata" && p.stato !== "annullata")
    return {
      oggetto: `[Ci ripensa] ${p.nome} · ${persone(p.persone)}`,
      html: corpo("Ci hanno ripensato 🌿", `${p.nome} aveva annullato e ora conferma di nuovo.`, dettagli(p)),
    };

  const cambi: [string, string][] = [];
  if (o.persone !== p.persone) cambi.push(["Persone", `${o.persone} → ${p.persone}`]);
  if (nomi(o.ospiti) !== nomi(p.ospiti)) cambi.push(["Ospiti", `${nomi(o.ospiti)}  →  ${nomi(p.ospiti)}`]);
  if ((o.note ?? "") !== (p.note ?? "")) cambi.push(["Note", `${o.note || "—"} → ${p.note || "—"}`]);
  if ((o.contatto ?? "") !== (p.contatto ?? "")) cambi.push(["Contatto", `${o.contatto || "—"} → ${p.contatto || "—"}`]);
  if (!cambi.length) return null; // es. ha cambiato solo le sedie: nessuna email
  return {
    oggetto: `[Modifica] ${p.nome}${o.persone !== p.persone ? `: da ${o.persone} a ${p.persone} persone` : ""}`,
    html: corpo("Prenotazione modificata", `${p.nome} ha cambiato la sua prenotazione.`, [...cambi, ["Codice", p.codice]]),
  };
}

Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== Deno.env.get("WEBHOOK_SECRET")) {
    return new Response("non autorizzato", { status: 401 });
  }
  const evento = await req.json();
  if (evento.table !== "prenotazioni") return new Response("ignorato");

  const email = componi(evento.type, evento.record as Riga, evento.old_record as Riga | undefined);
  if (!email) return new Response("nessuna email");

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `Invito A&R <${Deno.env.get("EMAIL_MITTENTE") ?? "onboarding@resend.dev"}>`,
      to: (Deno.env.get("EMAIL_SPOSI") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      subject: email.oggetto,
      html: email.html,
    }),
  });

  if (!r.ok) {
    console.error("Resend:", r.status, await r.text());
    return new Response("errore invio email", { status: 502 });
  }
  return new Response("ok");
});
