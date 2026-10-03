import { useRef, useState } from "react";
import { Check, Download, FileSpreadsheet, Loader2, TriangleAlert, X } from "lucide-react";
import { telefonoLeggibile } from "../../lib/contatti";
import { Button } from "@/sposi/ui/button";
import { cn } from "@/sposi/lib/utils";
import { Finestra } from "./Pannello";
import { leggiFile, scaricaModello, type RigaImport } from "../excel";
import { useAzioni, useFamiglie } from "../query";

export function Importa({ aperto, onChiudi }: { aperto: boolean; onChiudi: () => void }) {
  const { inviti } = useFamiglie();
  const { creaInviti } = useAzioni();
  const [righe, setRighe] = useState<RigaImport[] | null>(null);
  const [file, setFile] = useState("");
  const [errore, setErrore] = useState("");
  const [sopra, setSopra] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const chiudi = () => {
    setRighe(null);
    setFile("");
    setErrore("");
    onChiudi();
  };
  const scegli = async (f?: File) => {
    if (!f) return;
    setErrore("");
    setFile(f.name);
    try {
      setRighe(await leggiFile(f, inviti));
    } catch (e) {
      setRighe(null);
      setErrore(e instanceof Error ? e.message : "File non leggibile.");
    }
  };

  const buone = (righe ?? []).filter((r) => !r.errori.length);
  const scartate = (righe?.length ?? 0) - buone.length;

  return (
    <Finestra
      aperto={aperto}
      onChiudi={chiudi}
      titolo="Carica la lista invitati"
      descrizione="Excel (.xlsx, .xls) o CSV. Colonne: Famiglia (obbligatoria), Telefono, Email, Persone previste, Note."
      className="sm:max-w-3xl"
      piede={
        <>
          <Button variant="ghost" className="mr-auto" onClick={() => scaricaModello()}>
            <Download /> Modello Excel
          </Button>
          <Button variant="outline" onClick={chiudi}>
            Annulla
          </Button>
          <Button
            disabled={!buone.length || creaInviti.isPending}
            onClick={async () => {
              await creaInviti.mutateAsync(buone.map((r) => r.dati));
              chiudi();
            }}
          >
            {creaInviti.isPending && <Loader2 className="animate-spin" />} {buone.length === 1 ? "Aggiungi 1 invito" : `Aggiungi ${buone.length || ""} inviti`}
          </Button>
        </>
      }
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && input.current?.click()}
        onDragOver={(e) => (e.preventDefault(), setSopra(true))}
        onDragLeave={() => setSopra(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSopra(false);
          scegli(e.dataTransfer.files[0]);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center text-sm text-muted-foreground transition-colors hover:border-ring/60 hover:text-foreground",
          sopra && "border-ring bg-accent",
        )}
      >
        <FileSpreadsheet className="size-7" />
        <span className="font-medium text-foreground">{file || "Scegliete il file o trascinatelo qui"}</span>
        {!file && <span className="text-xs">Le intestazioni possono anche chiamarsi "Cellulare", "E-mail", "Persone"…</span>}
        <input ref={input} type="file" accept=".xlsx,.xls,.csv,.ods" hidden onChange={(e) => scegli(e.target.files?.[0])} />
      </div>
      {errore && <p className="mt-3 text-sm text-destructive">{errore}</p>}

      {righe && (
        <>
          <p className="mt-4 text-sm">
            <b className="tabular">{buone.length}</b> pronti da aggiungere
            {scartate > 0 && (
              <>
                , <b className="tabular">{scartate}</b> saltati
              </>
            )}
            .
          </p>
          <div className="mt-2 max-h-[46vh] overflow-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="w-8" />
                  <th className="px-2 py-2 text-left font-medium">Famiglia</th>
                  <th className="px-2 py-2 text-left font-medium">Telefono</th>
                  <th className="px-2 py-2 text-right font-medium">Pers.</th>
                  <th className="hidden px-2 py-2 text-left font-medium sm:table-cell">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {righe.map((r) => (
                  <tr key={r.riga} className={cn(r.errori.length ? "bg-destructive/8" : r.avvisi.length && "bg-warn-bg/60")}>
                    <td className="pl-2.5">
                      {r.errori.length ? <X className="size-4 text-destructive" /> : r.avvisi.length ? <TriangleAlert className="size-4 text-warn" /> : <Check className="size-4 text-ok" />}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="font-medium">{r.dati.nome || <i className="text-muted-foreground">senza nome</i>}</div>
                      {[...r.errori, ...r.avvisi].length > 0 && (
                        <div className={cn("text-xs", r.errori.length ? "text-destructive" : "text-warn")}>
                          riga {r.riga}: {[...r.errori, ...r.avvisi].join(" · ")}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap tabular">
                      {r.dati.telefono ? telefonoLeggibile(r.dati.telefono) : r.telefonoScritto ? <s className="text-muted-foreground">{r.telefonoScritto}</s> : ""}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular">{r.dati.persone_previste ?? ""}</td>
                    <td className="hidden px-2 py-1.5 text-muted-foreground sm:table-cell">{r.dati.nota_sposi ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Finestra>
  );
}
