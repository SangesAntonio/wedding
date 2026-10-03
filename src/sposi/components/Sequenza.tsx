import { useEffect, useState } from "react";
import { CheckCircle2, MessageCircle, SkipForward } from "lucide-react";
import { telefonoLeggibile } from "../../lib/contatti";
import { Button } from "@/sposi/ui/button";
import { Finestra } from "./Pannello";
import { useAzioni, useFamiglie, useMessaggio } from "../query";
import { MESSAGGIO_PREDEFINITO, testoMessaggio, whatsappInvito, type Invito } from "../inviti";

/** Un tocco per famiglia: si apre WhatsApp con il messaggio pronto, si torna e c'è già la successiva. */
export function Sequenza({ aperto, scelti, onChiudi }: { aperto: boolean; scelti?: Invito[]; onChiudi: () => void }) {
  const { famiglie = [] } = useFamiglie();
  const { aggiornaInvito } = useAzioni();
  const messaggio = useMessaggio().data ?? MESSAGGIO_PREDEFINITO;
  const [lista, setLista] = useState<Invito[]>([]);
  const [n, setN] = useState(0);
  const [inviati, setInviati] = useState(0);

  // la coda si "congela" all'apertura: non cambia mentre si invia
  useEffect(() => {
    if (!aperto) return;
    setLista(scelti ?? famiglie.filter((f) => f.stato === "da_inviare" && f.invito?.telefono).map((f) => f.invito!));
    setN(0);
    setInviati(0);
  }, [aperto]);

  const i = lista[n];
  const avanti = () => setN((x) => x + 1);

  return (
    <Finestra
      aperto={aperto}
      onChiudi={onChiudi}
      titolo="Invio in sequenza"
      descrizione={lista.length ? `${Math.min(n + 1, lista.length)} di ${lista.length}` : undefined}
      piede={
        i ? (
          <>
            <Button variant="ghost" className="mr-auto" onClick={avanti}>
              <SkipForward /> Salta
            </Button>
            <Button
              onClick={() => {
                window.open(whatsappInvito(messaggio, i)!, "_blank", "noopener");
                aggiornaInvito.mutate({ id: i.id, modifiche: { inviato_il: new Date().toISOString() } });
                setInviati((x) => x + 1);
                setTimeout(avanti, 350);
              }}
            >
              <MessageCircle /> Apri WhatsApp e vai avanti
            </Button>
          </>
        ) : (
          <Button onClick={onChiudi}>Chiudi</Button>
        )
      }
    >
      {!lista.length ? (
        <p className="text-sm text-muted-foreground">Nessun invito da inviare con un numero di telefono. Per gli altri usate "Copia link".</p>
      ) : i ? (
        <div className="grid gap-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(n / lista.length) * 100}%` }} />
          </div>
          <div>
            <p className="font-serif text-3xl">{i.nome}</p>
            <p className="text-sm text-muted-foreground tabular">{telefonoLeggibile(i.telefono!)}</p>
          </div>
          <div className="rounded-2xl rounded-bl-sm bg-[#dcf8c6] px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-[#111b21] dark:bg-[#005c4b] dark:text-[#e9edef]">
            {testoMessaggio(messaggio, i)}
          </div>
          <p className="text-xs text-muted-foreground">In WhatsApp premete Invia, poi tornate qui: trovate già la famiglia successiva.</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <CheckCircle2 className="size-10 text-ok" />
          <p className="font-serif text-2xl">Fatto!</p>
          <p className="text-sm text-muted-foreground">
            {inviati} {inviati === 1 ? "invito aperto" : "inviti aperti"} su WhatsApp.
          </p>
        </div>
      )}
    </Finestra>
  );
}
