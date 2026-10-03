import { useEffect, useState } from "react";
import { Baby, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/sposi/ui/button";
import { Input } from "@/sposi/ui/input";
import { Textarea } from "@/sposi/ui/textarea";
import { cn } from "@/sposi/lib/utils";
import { Finestra } from "./Pannello";
import { Campo } from "./FormInvito";
import { useAzioni, useFamiglie } from "../query";
import { assegnaPosti, totaleScherzoso, type Famiglia } from "../famiglie";
import type { Ospite } from "../dati";

interface RigaOspite extends Ospite {
  posto?: string; // sedia già assegnata (le nuove persone la ricevono al salvataggio)
}

/**
 * Prenotazione inserita o modificata dagli sposi: famiglia, una riga per persona
 * (nome + bambino), contatto e note. Le sedie si assegnano da sole vicino a quelle già scelte.
 */
export function FormPrenotazione({ aperto, famiglia, onChiudi }: { aperto: boolean; famiglia?: Famiglia; onChiudi: () => void }) {
  const { prenotazioni } = useFamiglie();
  const { aggiornaPrenotazione, creaPrenotazione } = useAzioni();
  const p = famiglia?.prenotazione;
  const modifica = !!p;

  const [nome, setNome] = useState("");
  const [ospiti, setOspiti] = useState<RigaOspite[]>([]);
  const [contatto, setContatto] = useState("");
  const [note, setNote] = useState("");
  const [errore, setErrore] = useState("");
  const [provato, setProvato] = useState(false);
  const [attesa, setAttesa] = useState(false);

  useEffect(() => {
    if (!aperto) return;
    setNome(p?.nome ?? famiglia?.nome ?? "");
    setContatto(p?.contatto ?? famiglia?.telefono ?? "");
    setNote(p?.note ?? "");
    setOspiti(
      p
        ? p.posti.map((posto, i) => ({ posto, nome: p.ospiti[i]?.nome ?? "", bambino: !!p.ospiti[i]?.bambino }))
        : Array.from({ length: Math.max(1, famiglia?.previste ?? 1) }, () => ({ nome: "", bambino: false })),
    );
    setErrore("");
    setProvato(false);
  }, [aperto, p, famiglia]);

  const cambia = (n: number, m: Partial<RigaOspite>) => setOspiti((o) => o.map((x, i) => (i === n ? { ...x, ...m } : x)));

  const salva = async () => {
    setProvato(true);
    setErrore("");
    if (!nome.trim()) return setErrore("Serve il nome della famiglia.");
    if (!ospiti.length) return setErrore("Serve almeno una persona.");
    if (ospiti.some((o) => !o.nome.trim())) return setErrore("Manca il nome di qualche ospite.");
    if (ospiti.length > 12) return setErrore("Al massimo 12 persone per prenotazione.");

    // le persone tolte lasciano la loro sedia; quelle nuove ne ricevono una libera vicino
    const tenute = ospiti.filter((o) => o.posto).map((o) => o.posto!);
    const posti = assegnaPosti(tenute, ospiti.length, prenotazioni, p?.id);
    let k = tenute.length;
    const ordinati = ospiti.map((o) => ({ posto: o.posto ?? posti[k++], o }));
    const dati = {
      nome: nome.trim(),
      contatto: contatto.trim() || null,
      note: note.trim() || null,
      posti: ordinati.map((x) => x.posto),
      ospiti: ordinati.map((x) => ({ nome: x.o.nome.trim(), bambino: x.o.bambino })),
    };
    setAttesa(true);
    try {
      if (p) await aggiornaPrenotazione.mutateAsync({ id: p.id, modifiche: { ...dati, persone: dati.posti.length } });
      else
        await creaPrenotazione.mutateAsync({
          ...dati,
          totale: totaleScherzoso(dati.posti, []),
          invito_id: famiglia?.invito?.id ?? null,
          stato: "confermata",
        });
      onChiudi();
    } catch {
      /* il messaggio d'errore lo mostra la notifica */
    } finally {
      setAttesa(false);
    }
  };

  return (
    <Finestra
      aperto={aperto}
      onChiudi={onChiudi}
      titolo={modifica ? "Modifica prenotazione" : "Prenotazione a mano"}
      descrizione={modifica ? famiglia?.nome : famiglia ? `Per ${famiglia.nome}: vi ha risposto a voce o al telefono.` : "Per chi vi ha risposto a voce o al telefono."}
      piede={
        <>
          <Button variant="outline" onClick={onChiudi}>
            Annulla
          </Button>
          <Button onClick={salva} disabled={attesa}>
            {attesa && <Loader2 className="animate-spin" />} {modifica ? "Salva modifiche" : "Aggiungi prenotazione"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Campo etichetta="Famiglia o gruppo">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Famiglia Esposito" maxLength={120} />
        </Campo>

        <div className="grid gap-2">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium">Chi viene</span>
            <span className="text-xs text-muted-foreground tabular">
              {ospiti.length} {ospiti.length === 1 ? "persona" : "persone"}
              {famiglia?.previste != null && ` · previste ${famiglia.previste}`}
            </span>
          </div>
          <ul className="grid gap-2">
            {ospiti.map((o, n) => (
              <li key={n} className="flex items-center gap-2">
                <Input
                  value={o.nome}
                  onChange={(e) => cambia(n, { nome: e.target.value })}
                  placeholder={`Ospite ${n + 1}`}
                  maxLength={80}
                  aria-invalid={provato && !o.nome.trim()}
                  autoFocus={!modifica && n === 0}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn("h-9 shrink-0", o.bambino && "border-info/40 bg-info-bg text-info hover:bg-info-bg hover:text-info")}
                  aria-pressed={o.bambino}
                  onClick={() => cambia(n, { bambino: !o.bambino })}
                >
                  <Baby /> bimbo
                </Button>
                <Button type="button" variant="ghost" size="icon" className="size-9 shrink-0" aria-label="Togli" disabled={ospiti.length === 1} onClick={() => setOspiti((x) => x.filter((_, i) => i !== n))}>
                  <X />
                </Button>
              </li>
            ))}
          </ul>
          <Button type="button" variant="outline" className="justify-start border-dashed" disabled={ospiti.length >= 12} onClick={() => setOspiti((x) => [...x, { nome: "", bambino: false }])}>
            <Plus /> Aggiungi una persona
          </Button>
          <p className="text-xs text-muted-foreground">Le sedie sono simboliche: chi aggiungete riceve un posto libero vicino agli altri.</p>
        </div>

        <Campo etichetta="Contatto">
          <Input value={contatto} onChange={(e) => setContatto(e.target.value)} placeholder="Telefono o email" maxLength={120} />
        </Campo>
        <Campo etichetta="Allergie, intolleranze">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="resize-none" maxLength={600} />
        </Campo>
        {errore && <p className="text-sm text-destructive">{errore}</p>}
      </div>
    </Finestra>
  );
}
