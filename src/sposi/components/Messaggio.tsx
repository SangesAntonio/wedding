import { useEffect, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/sposi/ui/button";
import { Textarea } from "@/sposi/ui/textarea";
import { useAzioni, useMessaggio } from "../query";
import { MESSAGGIO_PREDEFINITO, testoMessaggio } from "../inviti";

/** Editor del testo WhatsApp con anteprima (usato nelle Impostazioni). */
export function EditorMessaggio() {
  const { data } = useMessaggio();
  const { salvaMessaggio } = useAzioni();
  const [t, setT] = useState("");
  useEffect(() => setT(data ?? MESSAGGIO_PREDEFINITO), [data]);
  const cambiato = t !== (data ?? MESSAGGIO_PREDEFINITO);
  const manca = !t.includes("{link}");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="grid gap-2">
        <Textarea value={t} onChange={(e) => setT(e.target.value)} rows={7} className="bg-background" />
        <p className="text-xs text-muted-foreground">
          <code className="rounded bg-muted px-1">{"{nome}"}</code> diventa il nome della famiglia, <code className="rounded bg-muted px-1">{"{link}"}</code> il suo link
          personale.
        </p>
        {manca && <p className="text-sm text-destructive">Manca {"{link}"}: senza, la famiglia non riceve il suo invito.</p>}
        <div className="flex gap-2">
          <Button disabled={!cambiato || manca || salvaMessaggio.isPending} onClick={() => salvaMessaggio.mutate(t)}>
            {salvaMessaggio.isPending && <Loader2 className="animate-spin" />} Salva messaggio
          </Button>
          <Button variant="ghost" onClick={() => setT(MESSAGGIO_PREDEFINITO)}>
            <RotateCcw /> Testo iniziale
          </Button>
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">Anteprima</p>
        <div className="rounded-2xl bg-[#efe7dd] p-4 dark:bg-[#0b141a]">
          <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-[#dcf8c6] px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-[#111b21] shadow-sm dark:bg-[#005c4b] dark:text-[#e9edef]">
            {testoMessaggio(t, { nome: "Famiglia Esposito", token: "k7q2mx9p" })}
          </div>
        </div>
      </div>
    </div>
  );
}
