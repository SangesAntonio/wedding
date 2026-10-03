import { toast } from "sonner";
import { useAzioni, useMessaggio } from "../query";
import { useConferma } from "../components/Conferma";
import { linkInvito, testoMessaggio, whatsappInvito, MESSAGGIO_PREDEFINITO, type Invito } from "../inviti";
import type { Famiglia } from "../famiglie";
import type { Prenotazione, Richiamo } from "../dati";

/** Le azioni rapide su una famiglia, con conferme e notifiche. */
export function useAzioniFamiglia() {
  const a = useAzioni();
  const chiedi = useConferma();
  const messaggio = useMessaggio().data ?? MESSAGGIO_PREDEFINITO;

  const segnaInviato = (i: Invito) => !i.inviato_il && a.aggiornaInvito.mutate({ id: i.id, modifiche: { inviato_il: new Date().toISOString() } });

  return {
    messaggio,
    whatsapp(i: Invito) {
      const url = whatsappInvito(messaggio, i);
      if (!url) return;
      window.open(url, "_blank", "noopener");
      segnaInviato(i);
    },
    async copiaLink(i: Invito) {
      try {
        await navigator.clipboard.writeText(linkInvito(i.token));
        toast.success("Link copiato", { description: i.nome });
        segnaInviato(i);
      } catch {
        window.prompt("Copiate il link:", linkInvito(i.token));
      }
    },
    puoCondividere: typeof navigator !== "undefined" && typeof navigator.share === "function",
    async condividi(i: Invito) {
      try {
        await navigator.share({ title: "Invito", text: testoMessaggio(messaggio, i) });
        segnaInviato(i);
      } catch {
        /* annullato */
      }
    },
    cambiaInviato(i: Invito) {
      a.aggiornaInvito.mutate({ id: i.id, modifiche: { inviato_il: i.inviato_il ? null : new Date().toISOString() } });
    },
    async revoca(i: Invito) {
      if (await chiedi({ titolo: `Revocare l'invito di ${i.nome}?`, testo: "Il link personale smetterà di funzionare. Potrete riattivarlo quando volete.", conferma: "Revoca", distruttiva: true }))
        a.aggiornaInvito.mutate({ id: i.id, modifiche: { revocato: true } }, { onSuccess: () => toast.success("Invito revocato") });
    },
    riattiva(i: Invito) {
      a.aggiornaInvito.mutate({ id: i.id, modifiche: { revocato: false } }, { onSuccess: () => toast.success("Invito riattivato") });
    },
    async elimina(f: Famiglia) {
      if (!f.invito) return;
      if (f.prenotazione) {
        if (await chiedi({ titolo: `${f.nome} ha già una prenotazione`, testo: "Invece di eliminarlo, revoco l'invito: il link smette di funzionare e la prenotazione resta.", conferma: "Revoca l'invito" }))
          a.aggiornaInvito.mutate({ id: f.invito.id, modifiche: { revocato: true } });
        return;
      }
      if (await chiedi({ titolo: `Eliminare l'invito di ${f.nome}?`, testo: "Non si può annullare.", conferma: "Elimina", distruttiva: true })) a.eliminaInvito.mutate(f.invito.id);
    },
    richiamo(p: Prenotazione, r: Richiamo) {
      a.aggiornaPrenotazione.mutate({ id: p.id, modifiche: { richiamo: r } });
    },
    async annulla(f: Famiglia) {
      const p = f.prenotazione;
      if (!p) return;
      if (await chiedi({ titolo: `Annullare la presenza di ${f.nome}?`, testo: "La prenotazione resta nello storico come annullata e le sedie si liberano. Si può ripristinare.", conferma: "Annulla presenza", distruttiva: true }))
        a.aggiornaPrenotazione.mutate({ id: p.id, modifiche: { stato: "annullata" } }, { onSuccess: () => toast.success(`${f.nome}: presenza annullata`) });
    },
    ripristina(p: Prenotazione) {
      a.aggiornaPrenotazione.mutate({ id: p.id, modifiche: { stato: "confermata" } }, { onSuccess: () => toast.success("Prenotazione ripristinata") });
    },
    approva(p: Prenotazione, invitoId?: string) {
      a.aggiornaPrenotazione.mutate(
        { id: p.id, modifiche: { stato: "confermata", ...(invitoId ? { invito_id: invitoId } : {}) } },
        { onSuccess: () => toast.success(invitoId ? "Collegata all'invito" : "Prenotazione approvata") },
      );
    },
    async scarta(f: Famiglia) {
      const p = f.prenotazione;
      if (!p) return;
      if (await chiedi({ titolo: `Non conoscete ${f.nome}?`, testo: "La prenotazione viene segnata come annullata (resta visibile tra quelli che non vengono).", conferma: "Scarta", distruttiva: true }))
        a.aggiornaPrenotazione.mutate({ id: p.id, modifiche: { stato: "annullata" } });
    },
    notaSposi(f: Famiglia, testo: string) {
      const t = testo.trim() || null;
      if (f.invito) a.aggiornaInvito.mutate({ id: f.invito.id, modifiche: { nota_sposi: t } }, { onSuccess: () => toast.success("Nota salvata") });
      else if (f.prenotazione) a.aggiornaPrenotazione.mutate({ id: f.prenotazione.id, modifiche: { nota_sposi: t } }, { onSuccess: () => toast.success("Nota salvata") });
    },
  };
}
