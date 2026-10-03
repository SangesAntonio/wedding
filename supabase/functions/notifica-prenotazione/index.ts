// Edge Function di Supabase: riceve il "Database Webhook" su ogni nuova riga di
// `prenotazioni` e manda un'email agli sposi tramite Resend (https://resend.com, piano gratuito).
//
// Segreti da impostare (Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY   chiave di Resend
//   EMAIL_SPOSI      indirizzo (o indirizzi separati da virgola) che riceve le notifiche
//   WEBHOOK_SECRET   una parola segreta qualsiasi, uguale a quella messa nell'header del webhook
//   EMAIL_MITTENTE   facoltativo; senza un dominio verificato su Resend usare "onboarding@resend.dev"

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== Deno.env.get("WEBHOOK_SECRET")) {
    return new Response("non autorizzato", { status: 401 });
  }

  const evento = await req.json();
  if (evento.type !== "INSERT" || evento.table !== "prenotazioni") {
    return new Response("ignorato");
  }
  const p = evento.record;

  const daVerificare = p.stato === "da_verificare";
  const righe: [string, string][] = [
    ["Stato", daVerificare ? "Da verificare (arrivata dal link generico)" : "Confermata dal link personale"],
    ["Nome", p.nome],
    ["Persone", String(p.persone)],
    ["Posti", (p.posti ?? []).join(", ")],
    ["Contatto", p.contatto || "—"],
    ["Note", p.note || "—"],
    ["Supplementi", (p.supplementi ?? []).join(", ") || "—"],
    ["Totale indicato", `${p.totale} €`],
    ["Codice", p.codice],
  ];

  const html = `
    <div style="font-family:Georgia,serif;color:#2B3A31;max-width:520px">
      <h2 style="font-weight:400;margin:0 0 4px">Nuova conferma 🌿</h2>
      <p style="color:#79877C;margin:0 0 16px;font-family:Arial,sans-serif;font-size:13px">
        ${esc(p.nome)} ha confermato per ${esc(p.persone)} ${p.persone === 1 ? "persona" : "persone"}.
      </p>
      <table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;width:100%">
        ${righe
          .map(
            ([k, v]) =>
              `<tr><td style="padding:6px 12px 6px 0;color:#79877C;vertical-align:top">${esc(k)}</td><td style="padding:6px 0">${esc(v)}</td></tr>`,
          )
          .join("")}
      </table>
    </div>`;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `Invito A&R <${Deno.env.get("EMAIL_MITTENTE") ?? "onboarding@resend.dev"}>`,
      to: (Deno.env.get("EMAIL_SPOSI") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      subject: `${daVerificare ? "[Da verificare] " : ""}Conferma: ${p.nome} · ${p.persone} ${p.persone === 1 ? "persona" : "persone"}`,
      html,
    }),
  });

  if (!r.ok) {
    console.error("Resend:", r.status, await r.text());
    return new Response("errore invio email", { status: 502 });
  }
  return new Response("ok");
});
