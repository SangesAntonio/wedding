import type { ReactNode } from "react";
import { Copy, ExternalLink, LogOut, Monitor, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { MODALITA_DEMO } from "../../lib/supabase";
import { Button } from "@/sposi/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/sposi/ui/toggle-group";
import { useTema, type Tema } from "../tema";
import { EditorMessaggio } from "../components/Messaggio";

function Blocco({ titolo, descrizione, children }: { titolo: string; descrizione?: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 rounded-2xl border bg-card p-5 lg:grid-cols-[260px_1fr] lg:gap-8">
      <div>
        <h2 className="font-medium">{titolo}</h2>
        {descrizione && <p className="mt-1 text-sm text-muted-foreground">{descrizione}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export function Impostazioni({ email, esci }: { email?: string; esci: () => void }) {
  const [tema, setTema] = useTema();
  const linkGenerico = new URL("../", window.location.href).toString().split("#")[0];
  return (
    <div className="mx-auto grid max-w-5xl gap-4">
      <h1 className="hidden font-serif text-4xl lg:block">Impostazioni</h1>

      <Blocco titolo="Messaggio WhatsApp" descrizione="Il testo che parte con ogni invito. Lo usano il pulsante WhatsApp e l'invio in sequenza.">
        <EditorMessaggio />
      </Blocco>

      <Blocco titolo="Link generico" descrizione="Per chi non ha un invito personale. Le conferme da qui arrivano come «da verificare».">
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg border bg-muted px-3 py-2 text-sm">{linkGenerico}</code>
          <Button
            variant="outline"
            onClick={() => {
              navigator.clipboard?.writeText(linkGenerico);
              toast.success("Link copiato");
            }}
          >
            <Copy /> Copia
          </Button>
          <Button variant="outline" asChild>
            <a href={linkGenerico} target="_blank" rel="noopener">
              <ExternalLink /> Apri
            </a>
          </Button>
        </div>
      </Blocco>

      <Blocco titolo="Aspetto" descrizione="Il tema dell'area sposi su questo dispositivo.">
        <ToggleGroup type="single" variant="outline" value={tema} onValueChange={(v) => v && setTema(v as Tema)}>
          <ToggleGroupItem value="chiaro" className="px-4">
            <Sun /> Chiaro
          </ToggleGroupItem>
          <ToggleGroupItem value="scuro" className="px-4">
            <Moon /> Scuro
          </ToggleGroupItem>
          <ToggleGroupItem value="sistema" className="px-4">
            <Monitor /> Automatico
          </ToggleGroupItem>
        </ToggleGroup>
      </Blocco>

      <Blocco titolo="Account" descrizione="Gli account degli sposi si gestiscono da Supabase (vedi docs/LOGIN-SPOSI.md).">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm">{MODALITA_DEMO ? "Modalità demo: nessun account" : email}</span>
          {!MODALITA_DEMO && (
            <Button variant="outline" onClick={esci}>
              <LogOut /> Esci
            </Button>
          )}
        </div>
      </Blocco>

      <section className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">In arrivo: personalizzazione del matrimonio</p>
        <p className="mt-1">Data e orario, luogo, IBAN, testi dell'invito, prezzi e supplementi, posti sempre liberi e scadenza delle modifiche, con anteprima dal vivo.</p>
      </section>
    </div>
  );
}
