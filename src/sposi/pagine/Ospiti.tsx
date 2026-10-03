import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Baby,
  Ban,
  ChevronRight,
  Columns3,
  Copy,
  Download,
  FileSpreadsheet,
  MessageCircle,
  MoreHorizontal,
  NotebookPen,
  Plus,
  RotateCcw,
  Rows3,
  Rows4,
  Search,
  Send,
  Share2,
  Trash2,
  TriangleAlert,
  UserPlus,
  X,
} from "lucide-react";
import { telefonoLeggibile } from "../../lib/contatti";
import { Button } from "@/sposi/ui/button";
import { Input } from "@/sposi/ui/input";
import { Checkbox } from "@/sposi/ui/checkbox";
import { Skeleton } from "@/sposi/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/sposi/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/sposi/ui/dropdown-menu";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/sposi/ui/table";
import { cn } from "@/sposi/lib/utils";
import { useAzioni, useFamiglie } from "../query";
import { useAzioniUi } from "../azioni-ui";
import { useAzioniFamiglia } from "../hooks/useAzioniFamiglia";
import { useLargo, useMediaQuery } from "../hooks/useMediaQuery";
import { FILTRI, RICHIAMI, STATI, cercaFamiglia, esportaExcel, type Famiglia, type Filtro } from "../famiglie";
import { dataRelativa, type Richiamo } from "../dati";
import { Punto, RichiamoBadge, StatoBadge } from "../components/Stato";
import { Dettaglio } from "../components/Dettaglio";
import { useConferma } from "../components/Conferma";

const col = createColumnHelper<Famiglia>();
type Densita = "comoda" | "compatta";

const leggiLocale = <T,>(k: string, d: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : d;
  } catch {
    return d;
  }
};
const salvaLocale = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* ignora */
  }
};

const NOMI_COLONNE: Record<string, string> = {
  stato: "Stato",
  persone: "Persone",
  telefono: "Telefono",
  richiamo: "Seconda conferma",
  note: "Note",
  aggiornato: "Aggiornato",
};

export function Ospiti() {
  const { famiglie, caricamento, inviti } = useFamiglie();
  const [params, setParams] = useSearchParams();
  const filtro = (params.get("filtro") as Filtro) || "tutti";
  const aperta = params.get("f");
  const [q, setQ] = useState("");
  const [densita, setDensita] = useState<Densita>(() => leggiLocale("sposi:densita", "compatta"));
  const [sorting, setSorting] = useState<SortingState>([{ id: "famiglia", desc: false }]);
  const [visibili, setVisibili] = useState<VisibilityState>(() => leggiLocale("sposi:colonne", {}));
  const [selezione, setSelezione] = useState<RowSelectionState>({});
  const largo = useLargo();
  const ampio = useMediaQuery("(min-width: 1280px)");
  const medio = useMediaQuery("(min-width: 1120px)");
  const { apri } = useAzioniUi();
  const az = useAzioniFamiglia();
  const chiedi = useConferma();
  const { aggiornaInvito } = useAzioni();

  useEffect(() => salvaLocale("sposi:densita", densita), [densita]);
  useEffect(() => salvaLocale("sposi:colonne", visibili), [visibili]);

  const impostaParam = (k: string, v: string | null) =>
    setParams((p) => {
      if (v) p.set(k, v);
      else p.delete(k);
      return p;
    });

  const conteggi = useMemo(() => Object.fromEntries(FILTRI.map((f) => [f.id, (famiglie ?? []).filter(f.test).length])), [famiglie]);
  const righe = useMemo(() => {
    const test = FILTRI.find((f) => f.id === filtro)?.test ?? FILTRI[0].test;
    return (famiglie ?? []).filter((f) => test(f) && cercaFamiglia(f, q.trim()));
  }, [famiglie, filtro, q]);

  const famigliaAperta = famiglie?.find((f) => f.chiave === aperta);
  const compatta = densita === "compatta";

  const colonne = useMemo(
    () => [
      col.display({
        id: "seleziona",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllRowsSelected() || (table.getIsSomeRowsSelected() && "indeterminate")}
            onCheckedChange={(v) => table.toggleAllRowsSelected(!!v)}
            aria-label="Seleziona tutte"
          />
        ),
        cell: ({ row }) => <Checkbox checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)} aria-label="Seleziona" onClick={(e) => e.stopPropagation()} />,
        enableSorting: false,
        enableHiding: false,
      }),
      col.accessor("nome", {
        id: "famiglia",
        header: "Famiglia",
        sortingFn: (a, b) => a.original.nome.localeCompare(b.original.nome, "it"),
        enableHiding: false,
        cell: ({ row: { original: f } }) => (
          <div className="min-w-0">
            <div className="truncate font-medium">{f.nome}</div>
            {!compatta && (
              <div className="truncate text-xs text-muted-foreground">
                {f.nomiMancanti ? (
                  <span className="text-warn">Nomi da completare</span>
                ) : f.ospiti.length ? (
                  f.ospiti.map((o) => o.nome.split(" ")[0]).join(", ")
                ) : f.invito && !f.prenotazione ? (
                  f.invito.nota_sposi ?? "—"
                ) : (
                  "—"
                )}
              </div>
            )}
          </div>
        ),
      }),
      col.accessor("stato", {
        header: "Stato",
        sortingFn: (a, b) => STATI[a.original.stato].ordine - STATI[b.original.stato].ordine,
        cell: ({ getValue }) => <StatoBadge stato={getValue()} />,
      }),
      col.accessor("persone", {
        header: "Persone",
        cell: ({ row: { original: f } }) => <Persone f={f} />,
      }),
      col.accessor("telefono", {
        header: "Telefono",
        enableSorting: false,
        cell: ({ getValue }) => <span className="text-muted-foreground tabular">{getValue() ? telefonoLeggibile(getValue()!) : "—"}</span>,
      }),
      col.accessor("richiamo", {
        header: "Seconda conferma",
        sortingFn: (a, b) => (a.original.richiamo ?? "").localeCompare(b.original.richiamo ?? ""),
        cell: ({ row: { original: f } }) => (f.richiamo && f.prenotazione ? <RichiamoRapido f={f} onCambia={(r) => az.richiamo(f.prenotazione!, r)} /> : <span className="text-muted-foreground">—</span>),
      }),
      col.display({
        id: "note",
        header: "Note",
        cell: ({ row: { original: f } }) => (
          <div className="flex items-center gap-1.5">
            {f.note && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <TriangleAlert className="size-4 text-warn" />
                </TooltipTrigger>
                <TooltipContent className="max-w-64">{f.note}</TooltipContent>
              </Tooltip>
            )}
            {f.notaSposi && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <NotebookPen className="size-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-64">{f.notaSposi}</TooltipContent>
              </Tooltip>
            )}
          </div>
        ),
      }),
      col.accessor("aggiornato", {
        header: "Aggiornato",
        cell: ({ getValue }) => <span className="text-xs whitespace-nowrap text-muted-foreground">{getValue() ? dataRelativa(getValue()) : "—"}</span>,
      }),
      col.display({
        id: "azioni",
        header: () => <span className="sr-only">Azioni</span>,
        cell: ({ row: { original: f } }) => <MenuRiga f={f} />,
        enableHiding: false,
      }),
    ],
    [compatta],
  );

  const tabella = useReactTable({
    data: righe,
    columns: colonne,
    // su schermi meno ampi alcune colonne si nascondono da sole (si possono riattivare dal menu Colonne)
    state: {
      sorting,
      columnVisibility: { ...(!ampio && { aggiornato: false }), ...(!medio && { telefono: false }), ...visibili },
      rowSelection: selezione,
    },
    getRowId: (f) => f.chiave,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setVisibili,
    onRowSelectionChange: setSelezione,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // solo le righe selezionate ancora visibili con il filtro attuale
  const selezionate = righe.filter((f) => selezione[f.chiave]);
  const invitiSelezionati = selezionate.map((f) => f.invito).filter((i): i is NonNullable<typeof i> => !!i && !i.revocato);
  const conTelefono = invitiSelezionati.filter((i) => i.telefono);

  return (
    <div className={cn("mx-auto max-w-7xl", selezionate.length > 0 && "pb-20")}>
      <div className="mb-5 hidden items-end justify-between gap-4 lg:flex">
        <div>
          <h1 className="font-serif text-4xl">Ospiti</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {inviti.length} inviti · {(famiglie ?? []).filter((f) => f.stato === "confermato").reduce((s, f) => s + f.persone, 0)} persone confermate
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => apri({ tipo: "importa" })}>
            <FileSpreadsheet /> Carica Excel
          </Button>
          <Button variant="outline" onClick={() => famiglie && esportaExcel(famiglie)} disabled={!famiglie?.length}>
            <Download /> Esporta
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus /> Aggiungi
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuItem onClick={() => apri({ tipo: "nuovo-invito" })}>
                <UserPlus /> Nuovo invito
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => apri({ tipo: "prenotazione" })}>
                <Plus /> Prenotazione a mano
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => apri({ tipo: "sequenza" })}>
                <Send /> Invia gli inviti in sequenza
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ricerca e strumenti */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca famiglia, ospite, telefono, codice…" className="h-10 bg-card pl-9" aria-label="Cerca" />
          {q && (
            <button className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground" onClick={() => setQ("")} aria-label="Cancella">
              <X className="size-4" />
            </button>
          )}
        </div>
        {largo ? (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="size-10" aria-label="Densità">
                  {compatta ? <Rows4 /> : <Rows3 />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Densità</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={densita} onValueChange={(v) => setDensita(v as Densita)}>
                  <DropdownMenuRadioItem value="compatta">Compatta</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="comoda">Comoda (con i nomi)</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="size-10" aria-label="Colonne">
                  <Columns3 />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Colonne</DropdownMenuLabel>
                {tabella
                  .getAllLeafColumns()
                  .filter((c) => c.getCanHide())
                  .map((c) => (
                    <DropdownMenuCheckboxItem key={c.id} checked={c.getIsVisible()} onCheckedChange={(v) => c.toggleVisibility(!!v)} onSelect={(e) => e.preventDefault()}>
                      {NOMI_COLONNE[c.id] ?? c.id}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="size-10" aria-label="Altro">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => apri({ tipo: "sequenza" })}>
                <Send /> Invia in sequenza
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => apri({ tipo: "importa" })}>
                <FileSpreadsheet /> Carica Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => famiglie && esportaExcel(famiglie)}>
                <Download /> Esporta Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* filtri rapidi */}
      <div className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0">
        {FILTRI.filter((f) => f.id === "tutti" || conteggi[f.id] > 0 || f.id === filtro).map((f) => (
          <button
            key={f.id}
            onClick={() => impostaParam("filtro", f.id === "tutti" ? null : f.id)}
            className={cn(
              "flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors",
              filtro === f.id ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground/80 hover:border-ring/60",
            )}
          >
            {f.etichetta}
            <span className={cn("text-xs tabular", filtro === f.id ? "text-primary-foreground/75" : "text-muted-foreground")}>{conteggi[f.id]}</span>
          </button>
        ))}
      </div>

      {/* elenco */}
      <div className="mt-4">
        {caricamento ? (
          <div className="grid gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full rounded-lg" />
            ))}
          </div>
        ) : righe.length === 0 ? (
          <Vuoto haDati={!!famiglie?.length} onTogli={() => (setQ(""), impostaParam("filtro", null))} />
        ) : largo ? (
          <div className="overflow-clip rounded-xl border bg-card">
            <table className="w-full text-sm">
              <TableHeader className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
                {tabella.getHeaderGroups().map((g) => (
                  <TableRow key={g.id} className="hover:bg-transparent">
                    {g.headers.map((h) => (
                      <TableHead key={h.id} className={cn("h-10 px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase", larghezza(h.column.id))}>
                        {h.column.getCanSort() ? (
                          <button className="-ml-1 inline-flex items-center gap-1 rounded px-1 hover:text-foreground" onClick={h.column.getToggleSortingHandler()}>
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            {h.column.getIsSorted() === "asc" ? <ArrowUp className="size-3" /> : h.column.getIsSorted() === "desc" ? <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-40" />}
                          </button>
                        ) : (
                          flexRender(h.column.columnDef.header, h.getContext())
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {tabella.getRowModel().rows.map((r) => (
                  <TableRow
                    key={r.id}
                    data-state={r.getIsSelected() ? "selected" : undefined}
                    className={cn("cursor-pointer", r.original.stato === "revocato" && "opacity-55", aperta === r.id && "bg-accent")}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("button,a,[role=checkbox],[role=menuitem]")) return;
                      impostaParam("f", r.id);
                    }}
                  >
                    {r.getVisibleCells().map((c) => (
                      <TableCell key={c.id} className={cn("px-3", compatta ? "py-1.5" : "py-2.5", larghezza(c.column.id))}>
                        {flexRender(c.column.columnDef.cell, c.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </table>
          </div>
        ) : (
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {tabella.getRowModel().rows.map(({ original: f }) => (
              <li key={f.chiave}>
                <button className={cn("flex w-full items-center gap-3 px-3.5 py-3 text-left active:bg-accent", f.stato === "revocato" && "opacity-55")} onClick={() => impostaParam("f", f.chiave)}>
                  <Punto tono={STATI[f.stato].tono} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium">{f.nome}</span>
                      {f.note && <TriangleAlert className="size-3.5 shrink-0 text-warn" />}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{STATI[f.stato].etichetta}</span>
                      {(f.persone > 0 || f.previste) && (
                        <>
                          <span>·</span>
                          <span className="tabular">{f.persone > 0 ? `${f.persone} pers.` : `${f.previste} previste`}</span>
                        </>
                      )}
                      {f.richiamo && f.richiamo !== "da_sentire" && (
                        <>
                          <span>·</span>
                          <span>{RICHIAMI[f.richiamo].etichetta}</span>
                        </>
                      )}
                      {f.nomiMancanti && <span className="text-warn">· nomi mancanti</span>}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {righe.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground tabular">
            {righe.length} {righe.length === 1 ? "famiglia" : "famiglie"} · {righe.reduce((s, f) => s + (f.persone || 0), 0)} persone confermate ·{" "}
            {righe.reduce((s, f) => s + (f.previste ?? 0), 0)} previste
          </p>
        )}
      </div>

      {/* azioni sulle righe selezionate */}
      {selezionate.length > 0 && largo && (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-2xl border bg-popover p-1.5 pl-4 shadow-xl lg:ml-32">
          <span className="mr-2 text-sm font-medium tabular">{selezionate.length} selezionate</span>
          <Button size="sm" variant="ghost" disabled={!conTelefono.length} onClick={() => apri({ tipo: "sequenza", inviti: conTelefono })}>
            <Send /> Invia ({conTelefono.length})
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!invitiSelezionati.some((i) => !i.inviato_il)}
            onClick={() => {
              invitiSelezionati.filter((i) => !i.inviato_il).forEach((i) => az.cambiaInviato(i));
              setSelezione({});
            }}
          >
            Segna inviati
          </Button>
          <Button size="sm" variant="ghost" onClick={() => esportaExcel(selezionate)}>
            <Download /> Esporta
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            disabled={!invitiSelezionati.length}
            onClick={async () => {
              if (await chiedi({ titolo: `Revocare ${invitiSelezionati.length} inviti?`, testo: "I link personali smetteranno di funzionare.", conferma: "Revoca", distruttiva: true }))
              {
                invitiSelezionati.forEach((i) => aggiornaInvito.mutate({ id: i.id, modifiche: { revocato: true } }));
                setSelezione({});
              }
            }}
          >
            <Ban /> Revoca
          </Button>
          <Button size="icon" variant="ghost" className="size-8" onClick={() => setSelezione({})} aria-label="Deseleziona">
            <X />
          </Button>
        </div>
      )}

      <Dettaglio famiglia={famigliaAperta} onChiudi={() => impostaParam("f", null)} />
    </div>
  );
}

/** La colonna del nome prende lo spazio libero e accorcia il testo; le altre si stringono al contenuto. */
const larghezza = (id: string) => (id === "famiglia" ? "w-full max-w-0" : "w-px whitespace-nowrap");

function Persone({ f }: { f: Famiglia }) {
  const diff = f.persone && f.previste ? f.persone - f.previste : 0;
  if (!f.persone && !f.previste) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 tabular">
      {f.persone > 0 ? <span className="font-medium">{f.persone}</span> : <span className="text-muted-foreground">–</span>}
      {f.previste != null && <span className="text-xs text-muted-foreground">/ {f.previste}</span>}
      {diff !== 0 && <span className={cn("rounded px-1 text-[11px] font-medium", diff > 0 ? "bg-orange-bg text-orange" : "bg-info-bg text-info")}>{diff > 0 ? `+${diff}` : diff}</span>}
      {f.bambini > 0 && (
        <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground" title={`${f.bambini} bambini`}>
          <Baby className="size-3.5" />
          {f.bambini}
        </span>
      )}
    </span>
  );
}

function RichiamoRapido({ f, onCambia }: { f: Famiglia; onCambia: (r: Richiamo) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Seconda conferma">
          <RichiamoBadge richiamo={f.richiamo!} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Seconda conferma</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={f.richiamo!} onValueChange={(v) => onCambia(v as Richiamo)}>
          {(Object.keys(RICHIAMI) as Richiamo[]).map((r) => (
            <DropdownMenuRadioItem key={r} value={r}>
              {RICHIAMI[r].etichetta}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MenuRiga({ f }: { f: Famiglia }) {
  const az = useAzioniFamiglia();
  const { apri } = useAzioniUi();
  const i = f.invito;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label={`Azioni per ${f.nome}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {i && !i.revocato && (
          <>
            {i.telefono && (
              <DropdownMenuItem onClick={() => az.whatsapp(i)}>
                <MessageCircle /> Manda su WhatsApp
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => az.copiaLink(i)}>
              <Copy /> Copia link
            </DropdownMenuItem>
            {az.puoCondividere && (
              <DropdownMenuItem onClick={() => az.condividi(i)}>
                <Share2 /> Condividi…
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => az.cambiaInviato(i)}>{i.inviato_il ? "Segna da inviare" : "Segna come inviato"}</DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {i && (
          <DropdownMenuItem onClick={() => apri({ tipo: "modifica-invito", invito: i })}>
            <NotebookPen /> Modifica invito
          </DropdownMenuItem>
        )}
        {f.prenotazione ? (
          <DropdownMenuItem onClick={() => apri({ tipo: "prenotazione", famiglia: f })}>
            <NotebookPen /> Modifica prenotazione
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => apri({ tipo: "prenotazione", famiglia: f })}>
            <Plus /> Prenotazione a mano
          </DropdownMenuItem>
        )}
        {i && (
          <>
            <DropdownMenuSeparator />
            {i.revocato ? (
              <DropdownMenuItem onClick={() => az.riattiva(i)}>
                <RotateCcw /> Riattiva il link
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => az.revoca(i)}>
                <Ban /> Revoca il link
              </DropdownMenuItem>
            )}
            <DropdownMenuItem variant="destructive" onClick={() => az.elimina(f)}>
              <Trash2 /> Elimina invito
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Vuoto({ haDati, onTogli }: { haDati: boolean; onTogli: () => void }) {
  const { apri } = useAzioniUi();
  return (
    <div className="rounded-xl border border-dashed bg-card/60 px-6 py-14 text-center">
      <p className="font-serif text-2xl">{haDati ? "Nessuna famiglia con questi filtri" : "Nessun invitato ancora"}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        {haDati ? "Provate a togliere i filtri o a cercare in un altro modo." : "Aggiungete le famiglie a mano o caricate il file Excel con la lista."}
      </p>
      <div className="mt-5 flex justify-center gap-2">
        {haDati ? (
          <Button variant="outline" onClick={onTogli}>
            Togli i filtri
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={() => apri({ tipo: "importa" })}>
              <FileSpreadsheet /> Carica Excel
            </Button>
            <Button onClick={() => apri({ tipo: "nuovo-invito" })}>
              <UserPlus /> Nuovo invito
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
