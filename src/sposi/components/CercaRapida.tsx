import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { FileSpreadsheet, LayoutDashboard, Plus, Send, Settings, UserPlus, Users } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/sposi/ui/command";
import { useAzioniUi } from "../azioni-ui";
import { useFamiglie } from "../query";
import { cercaFamiglia } from "../famiglie";
import { StatoBadge } from "./Stato";

export function CercaRapida() {
  const { cercaAperta, setCercaAperta, apri, mostraFamiglia } = useAzioniUi();
  const { famiglie = [] } = useFamiglie();
  const [q, setQ] = useState("");
  const naviga = useNavigate();

  // la ricerca la facciamo noi (nomi degli ospiti, telefono, codice), non cmdk
  const trovate = useMemo(() => (q.trim() ? famiglie.filter((f) => cercaFamiglia(f, q.trim())).slice(0, 8) : famiglie.slice(0, 0)), [famiglie, q]);

  const esegui = (f: () => void) => {
    setCercaAperta(false);
    setQ("");
    f();
  };

  return (
    <CommandDialog open={cercaAperta} onOpenChange={setCercaAperta} title="Cerca" description="Cerca una famiglia o un'azione" shouldFilter={false}>
      <CommandInput placeholder="Famiglia, ospite, telefono, codice…" value={q} onValueChange={setQ} />
      <CommandList>
        <CommandEmpty>Nessun risultato.</CommandEmpty>
        {trovate.length > 0 && (
          <CommandGroup heading="Famiglie">
            {trovate.map((f) => (
              <CommandItem key={f.chiave} value={f.chiave} onSelect={() => esegui(() => mostraFamiglia(f.chiave))}>
                <Users className="text-muted-foreground" />
                <span className="truncate">{f.nome}</span>
                {f.persone > 0 && <span className="text-xs text-muted-foreground tabular">{f.persone}</span>}
                <StatoBadge stato={f.stato} className="ml-auto" />
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandSeparator />
        <CommandGroup heading="Azioni">
          <CommandItem value="nuovo invito" onSelect={() => esegui(() => apri({ tipo: "nuovo-invito" }))}>
            <UserPlus /> Nuovo invito
          </CommandItem>
          <CommandItem value="prenotazione a mano" onSelect={() => esegui(() => apri({ tipo: "prenotazione" }))}>
            <Plus /> Prenotazione a mano
          </CommandItem>
          <CommandItem value="carica excel" onSelect={() => esegui(() => apri({ tipo: "importa" }))}>
            <FileSpreadsheet /> Carica Excel
          </CommandItem>
          <CommandItem value="invia in sequenza" onSelect={() => esegui(() => apri({ tipo: "sequenza" }))}>
            <Send /> Invia gli inviti in sequenza
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Vai a">
          <CommandItem value="panoramica" onSelect={() => esegui(() => naviga("/"))}>
            <LayoutDashboard /> Panoramica
          </CommandItem>
          <CommandItem value="ospiti" onSelect={() => esegui(() => naviga("/ospiti"))}>
            <Users /> Ospiti
          </CommandItem>
          <CommandItem value="impostazioni" onSelect={() => esegui(() => naviga("/impostazioni"))}>
            <Settings /> Impostazioni
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
