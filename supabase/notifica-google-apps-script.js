// Notifica email con Google Apps Script (alternativa gratuita a Resend, usa il vostro Gmail).
//
// 1. Andate su https://script.google.com con l'account Google che deve mandare le email → "Nuovo progetto".
// 2. Cancellate il contenuto e incollate tutto questo file. Cambiate EMAIL_SPOSI e SEGRETO qui sotto.
// 3. Salvate, poi "Esegui" la funzione `prova` una volta: Google chiede i permessi per inviare email
//    (avviso "app non verificata": Avanzate → Vai al progetto). Vi arriva un'email di prova.
// 4. "Esegui il deployment" → "Nuovo deployment" → tipo "App web":
//      Esegui come: Me · Chi ha accesso: Chiunque → Esegui il deployment → copiate l'URL (finisce con /exec).
// 5. Supabase → Database → Webhooks → Create a new hook:
//      tabella prenotazioni, evento Insert, tipo "HTTP Request", metodo POST,
//      URL = l'URL copiato + "?segreto=" + il vostro SEGRETO   (es. https://script.google.com/.../exec?segreto=abc123)

const EMAIL_SPOSI = "voi@gmail.com"; // anche più indirizzi separati da virgola
const SEGRETO = "cambiami-con-una-parola-segreta";

function doPost(e) {
  if (!e || !e.parameter || e.parameter.segreto !== SEGRETO) {
    return ContentService.createTextOutput("non autorizzato");
  }
  const evento = JSON.parse(e.postData.contents);
  if (evento.type !== "INSERT" || evento.table !== "prenotazioni") {
    return ContentService.createTextOutput("ignorato");
  }
  invia(evento.record);
  return ContentService.createTextOutput("ok");
}

function invia(p) {
  const persone = p.persone === 1 ? "1 persona" : p.persone + " persone";
  const righe = [
    ["Nome", p.nome],
    ["Persone", persone],
    ["Posti", (p.posti || []).join(", ")],
    ["Contatto", p.contatto || "—"],
    ["Note", p.note || "—"],
    ["Supplementi", (p.supplementi || []).join(", ") || "—"],
    ["Totale indicato", p.totale + " €"],
    ["Codice", p.codice],
  ];
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const html =
    '<div style="font-family:Georgia,serif;color:#2B3A31;max-width:520px">' +
    '<h2 style="font-weight:400;margin:0 0 4px">Nuova conferma 🌿</h2>' +
    '<p style="color:#79877C;margin:0 0 16px;font-family:Arial,sans-serif;font-size:13px">' +
    esc(p.nome) + " ha confermato per " + persone + ".</p>" +
    '<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;width:100%">' +
    righe.map(([k, v]) => '<tr><td style="padding:6px 12px 6px 0;color:#79877C;vertical-align:top">' + esc(k) + '</td><td style="padding:6px 0">' + esc(v) + "</td></tr>").join("") +
    "</table></div>";

  MailApp.sendEmail({
    to: EMAIL_SPOSI,
    subject: "Conferma: " + p.nome + " · " + persone,
    htmlBody: html,
    name: "Invito A&R",
  });
}

// Da eseguire una volta a mano per autorizzare l'invio e ricevere un'email di prova.
function prova() {
  invia({ nome: "Famiglia Prova", persone: 2, posti: ["B2-1", "B2-2"], contatto: "", note: "Una seggiolina", supplementi: [], totale: 330, codice: "AR-PROVA1" });
}
