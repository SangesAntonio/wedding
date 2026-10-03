import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFieldArray, useForm, useWatch, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, Loader2, MapPin, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/sposi/ui/button";
import { Input } from "@/sposi/ui/input";
import { Label } from "@/sposi/ui/label";
import { Textarea } from "@/sposi/ui/textarea";
import { Switch } from "@/sposi/ui/switch";
import { Skeleton } from "@/sposi/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/sposi/ui/sheet";
import { cn } from "@/sposi/lib/utils";
import { useAzioni, useConfig } from "../query";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { configPredefinita, type ConfigMatrimonio } from "../../lib/configMatrimonio";
import { ORDINE_SETTORI, SETTORI as SETTORI_BASE, type SettoreId } from "../../data/sala";

// ------------------------------------------------------------ date con il fuso di Roma
const FUSO = "Europe/Rome";
function isoRoma(data: string, ora: string) {
  const prova = new Date(`${data}T${ora}:00Z`);
  const nome = new Intl.DateTimeFormat("en-US", { timeZone: FUSO, timeZoneName: "longOffset" }).formatToParts(prova).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const scarto = nome.replace("GMT", "") || "+00:00";
  return `${data}T${ora}:00${scarto}`;
}
function daIso(iso: string) {
  const s = new Intl.DateTimeFormat("sv-SE", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  const [data, ora] = s.split(" ");
  return { data, ora };
}

/** Controllo dell'IBAN (modulo 97): solo un avviso, non blocca il salvataggio. */
export function ibanValido(iban: string) {
  const s = iban.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  const r = (s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let resto = 0;
  for (const cifra of r) resto = (resto * 10 + Number(cifra)) % 97;
  return resto === 1;
}

// ------------------------------------------------------------ schema del modulo
const testo = (max: number, msg = "Obbligatorio") => z.string().trim().min(1, msg).max(max, `Al massimo ${max} caratteri`);
const settore = z.object({ nome: testo(40), tag: testo(40), prezzo: z.number({ message: "Numero" }).min(0, "Almeno 0").max(100000), desc: testo(200) });
const schema = z.object({
  sposi: z.object({ lui: testo(40), lei: testo(40), cognomi: testo(80), iniziali: testo(6), intestatario: testo(120) }),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida"),
  ora: z.string().regex(/^\d{2}:\d{2}$/, "Ora non valida"),
  orario: testo(120),
  durata_ore: z.number({ message: "Numero" }).min(1, "Almeno 1").max(24, "Al massimo 24"),
  luogo: z.object({
    nome: testo(120),
    indirizzo: testo(200),
    citta: testo(80),
    lat: z.number({ message: "Numero" }).min(-90).max(90),
    lng: z.number({ message: "Numero" }).min(-180).max(180),
  }),
  iban: testo(40),
  iban_di_esempio: z.boolean(),
  testi: z.object({ occhiello: testo(60), claim: testo(200), nota_pagamento: testo(400), nota_contanti: testo(600) }),
  settori: z.object(Object.fromEntries(ORDINE_SETTORI.map((k) => [k, settore])) as Record<SettoreId, typeof settore>),
  supplementi: z.array(z.object({ id: z.string(), n: testo(80), d: z.string().max(120), p: z.number({ message: "Numero" }).min(0).max(10000) })).max(12),
  sconto_pct: z.number({ message: "Numero" }).min(0).max(90),
  posti_sempre_liberi: z.number({ message: "Numero" }).int().min(0).max(60),
  giorni_blocco_modifiche: z.number({ message: "Numero" }).int().min(0).max(120),
});
type Valori = z.infer<typeof schema>;

const daConfig = (c: ConfigMatrimonio): Valori => ({
  sposi: { ...c.sposi },
  ...daIso(c.data_evento),
  orario: c.orario,
  durata_ore: c.durata_ore,
  luogo: { ...c.luogo },
  iban: c.iban,
  iban_di_esempio: c.iban_di_esempio,
  testi: { ...c.testi },
  settori: structuredClone(c.settori),
  supplementi: c.supplementi.map((s) => ({ ...s })),
  sconto_pct: Math.round(c.sconto_famiglia * 100),
  posti_sempre_liberi: c.posti_sempre_liberi,
  giorni_blocco_modifiche: c.giorni_blocco_modifiche,
});

const aConfig = (v: Valori): ConfigMatrimonio => ({
  sposi: v.sposi,
  data_evento: isoRoma(v.data, v.ora),
  orario: v.orario,
  durata_ore: v.durata_ore,
  luogo: v.luogo,
  iban: v.iban.trim(),
  iban_di_esempio: v.iban_di_esempio,
  testi: v.testi,
  settori: v.settori,
  supplementi: v.supplementi.map((s, i) => ({ ...s, id: s.id || `s${Date.now().toString(36)}${i}` })),
  sconto_famiglia: v.sconto_pct / 100,
  posti_sempre_liberi: v.posti_sempre_liberi,
  giorni_blocco_modifiche: v.giorni_blocco_modifiche,
});

// ------------------------------------------------------------ componenti di impaginazione
function Sezione({ titolo, descrizione, children }: { titolo: string; descrizione?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="font-medium">{titolo}</h2>
      {descrizione && <p className="mt-1 text-sm text-muted-foreground">{descrizione}</p>}
      <div className="mt-4 grid gap-4">{children}</div>
    </section>
  );
}
function Campo({ etichetta, errore, aiuto, className, children }: { etichetta: string; errore?: string; aiuto?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div className={cn("grid content-start gap-1.5", className)}>
      <Label>{etichetta}</Label>
      {children}
      {errore ? <p className="text-xs text-destructive">{errore}</p> : aiuto ? <p className="text-xs text-muted-foreground">{aiuto}</p> : null}
    </div>
  );
}

// ------------------------------------------------------------ editor
export function EditorMatrimonio() {
  const { data: config, isLoading } = useConfig();
  if (isLoading || !config)
    return (
      <div className="grid gap-4">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  return <Modulo config={config} />;
}

function Modulo({ config }: { config: ConfigMatrimonio }) {
  const { salvaConfig } = useAzioni();
  const iniziali = useMemo(() => daConfig(config), [config]);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isDirty },
  } = useForm<Valori>({ resolver: zodResolver(schema), defaultValues: iniziali, mode: "onBlur" });
  const { fields, append, remove } = useFieldArray({ control, name: "supplementi" });
  const affiancata = useMediaQuery("(min-width: 1280px)");
  const [anteprimaAperta, setAnteprimaAperta] = useState(false);

  useEffect(() => reset(iniziali), [iniziali, reset]);

  const salva = handleSubmit(async (v) => {
    await salvaConfig.mutateAsync(aConfig(v));
    reset(v);
  });

  const num = { valueAsNumber: true } as const;
  const e = errors;
  const v = useWatch({ control });
  const fino = (() => {
    try {
      const d = new Date(isoRoma(v.data ?? "", v.ora ?? "00:00"));
      return new Date(d.getTime() - (v.giorni_blocco_modifiche ?? 0) * 864e5).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
    } catch {
      return "—";
    }
  })();
  const ibanOk = ibanValido(v.iban ?? "");

  return (
    <div className={cn("grid gap-6", affiancata && "grid-cols-[minmax(0,1fr)_400px]")}>
      <form onSubmit={salva} className="grid gap-4 pb-24">
        {!affiancata && (
          <Button type="button" variant="outline" className="justify-self-start" onClick={() => setAnteprimaAperta(true)}>
            <Eye /> Anteprima dell'invito
          </Button>
        )}

        <Sezione titolo="Sposi e data">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etichetta="Lui" errore={e.sposi?.lui?.message}>
              <Input {...register("sposi.lui")} />
            </Campo>
            <Campo etichetta="Lei" errore={e.sposi?.lei?.message}>
              <Input {...register("sposi.lei")} />
            </Campo>
            <Campo etichetta="Cognomi" errore={e.sposi?.cognomi?.message} aiuto="Sotto i nomi, in maiuscoletto">
              <Input {...register("sposi.cognomi")} />
            </Campo>
            <Campo etichetta="Iniziali" errore={e.sposi?.iniziali?.message} aiuto="Sul sigillo della busta">
              <Input {...register("sposi.iniziali")} maxLength={6} />
            </Campo>
            <Campo etichetta="Data" errore={e.data?.message}>
              <Input type="date" {...register("data")} />
            </Campo>
            <Campo etichetta="Ora" errore={e.ora?.message}>
              <Input type="time" {...register("ora")} />
            </Campo>
            <Campo etichetta="Riga sotto la data" errore={e.orario?.message} className="sm:col-span-2">
              <Input {...register("orario")} placeholder="Ore 17:00 · cerimonia, cena e balli fino a tardi" />
            </Campo>
            <Campo etichetta="Durata (ore)" errore={e.durata_ore?.message} aiuto="Per l'evento nel calendario">
              <Input type="number" min={1} max={24} {...register("durata_ore", num)} />
            </Campo>
          </div>
        </Sezione>

        <Sezione titolo="Luogo" descrizione="I navigatori ricevono nome e indirizzo; le coordinate servono per il segnaposto sulla mappa.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etichetta="Nome del luogo" errore={e.luogo?.nome?.message} className="sm:col-span-2">
              <Input {...register("luogo.nome")} />
            </Campo>
            <Campo etichetta="Indirizzo" errore={e.luogo?.indirizzo?.message} className="sm:col-span-2">
              <Input {...register("luogo.indirizzo")} />
            </Campo>
            <Campo etichetta="Città" errore={e.luogo?.citta?.message}>
              <Input {...register("luogo.citta")} />
            </Campo>
            <div />
            <Campo etichetta="Latitudine" errore={e.luogo?.lat?.message}>
              <Input type="number" step="any" {...register("luogo.lat", num)} />
            </Campo>
            <Campo etichetta="Longitudine" errore={e.luogo?.lng?.message}>
              <Input type="number" step="any" {...register("luogo.lng", num)} />
            </Campo>
          </div>
          <TrovaCoordinate control={control} onTrovate={(lat, lng) => (setValue("luogo.lat", lat, { shouldDirty: true }), setValue("luogo.lng", lng, { shouldDirty: true }))} />
        </Sezione>

        <Sezione titolo="Pagamento">
          <Campo etichetta="Intestato a" errore={e.sposi?.intestatario?.message}>
            <Input {...register("sposi.intestatario")} />
          </Campo>
          <Campo etichetta="IBAN" errore={e.iban?.message} aiuto={v.iban && !ibanOk ? <span className="text-warn">Controllate l'IBAN: il codice di controllo non torna.</span> : undefined}>
            <Input {...register("iban")} className="font-mono tracking-wide" />
          </Campo>
          <label className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2.5">
            <span className="text-sm">
              Mostra "IBAN di esempio" in fondo all'invito
              <span className="block text-xs text-muted-foreground">Toglietelo quando l'IBAN è quello vero.</span>
            </span>
            <Switch checked={!!v.iban_di_esempio} onCheckedChange={(c) => setValue("iban_di_esempio", c, { shouldDirty: true })} />
          </label>
        </Sezione>

        <Sezione titolo="Testi dell'invito">
          <Campo etichetta="Sopra i nomi" errore={e.testi?.occhiello?.message}>
            <Input {...register("testi.occhiello")} />
          </Campo>
          <Campo etichetta="Frase principale" errore={e.testi?.claim?.message}>
            <Textarea rows={2} {...register("testi.claim")} />
          </Campo>
          <Campo etichetta="Nota sul pagamento" errore={e.testi?.nota_pagamento?.message} aiuto="Il riquadro dorato sotto l'importo">
            <Textarea rows={2} {...register("testi.nota_pagamento")} />
          </Campo>
          <Campo etichetta="Nota finale" errore={e.testi?.nota_contanti?.message}>
            <Textarea rows={3} {...register("testi.nota_contanti")} />
          </Campo>
        </Sezione>

        <Sezione titolo="Sala e prezzi" descrizione="I quattro settori della sala. Colori e tavoli restano quelli della sala 3D.">
          <div className="grid gap-3">
            {ORDINE_SETTORI.map((k) => (
              <div key={k} className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[1fr_1fr_110px]">
                <div className="flex items-center gap-2 sm:col-span-3">
                  <span className="size-3 rounded-full" style={{ background: SETTORI_BASE[k].col }} />
                  <span className="text-sm font-medium">{v.settori?.[k]?.nome || k}</span>
                </div>
                <Campo etichetta="Nome" errore={e.settori?.[k]?.nome?.message}>
                  <Input {...register(`settori.${k}.nome`)} />
                </Campo>
                <Campo etichetta="Etichetta" errore={e.settori?.[k]?.tag?.message}>
                  <Input {...register(`settori.${k}.tag`)} />
                </Campo>
                <Campo etichetta="Prezzo €" errore={e.settori?.[k]?.prezzo?.message}>
                  <Input type="number" min={0} {...register(`settori.${k}.prezzo`, num)} />
                </Campo>
                <Campo etichetta="Descrizione" errore={e.settori?.[k]?.desc?.message} className="sm:col-span-3">
                  <Input {...register(`settori.${k}.desc`)} />
                </Campo>
              </div>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etichetta="Sconto famiglia %" errore={e.sconto_pct?.message} aiuto="Dal secondo posto in poi">
              <Input type="number" min={0} max={90} {...register("sconto_pct", num)} />
            </Campo>
            <Campo etichetta="Sedie sempre libere" errore={e.posti_sempre_liberi?.message} aiuto="Le sedie sono scenografiche: quante ne restano sempre libere">
              <Input type="number" min={0} max={60} {...register("posti_sempre_liberi", num)} />
            </Campo>
          </div>
        </Sezione>

        <Sezione titolo="Supplementi" descrizione="Le opzioni scherzose del passo «Chi siete». Una volta per prenotazione.">
          <div className="grid gap-2">
            {fields.map((f, i) => (
              <div key={f.id} className="grid grid-cols-[1fr_90px_auto] items-start gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_1.4fr_90px_auto]">
                <Input {...register(`supplementi.${i}.n`)} placeholder="Nome" aria-invalid={!!e.supplementi?.[i]?.n} />
                <Input {...register(`supplementi.${i}.d`)} placeholder="Descrizione" className="col-span-3 row-start-2 sm:col-span-1 sm:row-start-auto" />
                <Input type="number" min={0} {...register(`supplementi.${i}.p`, num)} placeholder="€" />
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)} aria-label="Togli">
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" className="justify-self-start border-dashed" disabled={fields.length >= 12} onClick={() => append({ id: "", n: "", d: "", p: 10 })}>
            <Plus /> Aggiungi supplemento
          </Button>
        </Sezione>

        <Sezione titolo="Modifiche degli invitati">
          <Campo etichetta="Giorni di blocco prima del matrimonio" errore={e.giorni_blocco_modifiche?.message} aiuto={<>Gli invitati possono modificare o annullare fino al <b>{fino}</b>. Dopo, solo voi.</>}>
            <Input type="number" min={0} max={120} {...register("giorni_blocco_modifiche", num)} className="max-w-32" />
          </Campo>
        </Sezione>

        <div className="flex justify-start">
          <Button type="button" variant="ghost" onClick={() => reset(daConfig(configPredefinita()), { keepDefaultValues: true })}>
            <RotateCcw /> Ripristina i valori iniziali
          </Button>
        </div>

        {/* barra di salvataggio */}
        <div
          className={cn(
            "fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 mx-auto flex w-[min(640px,calc(100%-2rem))] items-center gap-2 rounded-2xl border bg-popover p-2 pl-4 shadow-xl transition-all lg:bottom-6 lg:left-64",
            isDirty ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
          )}
        >
          <span className="flex-1 text-sm">Modifiche non salvate</span>
          <Button type="button" variant="ghost" onClick={() => reset(iniziali)}>
            Annulla
          </Button>
          <Button type="submit" disabled={salvaConfig.isPending}>
            {salvaConfig.isPending && <Loader2 className="animate-spin" />} Salva
          </Button>
        </div>
      </form>

      {affiancata ? (
        <aside className="sticky top-6 h-[calc(100dvh-3rem)]">
          <Anteprima control={control} />
        </aside>
      ) : (
        <Sheet open={anteprimaAperta} onOpenChange={setAnteprimaAperta}>
          <SheetContent className="w-full p-0 sm:max-w-md">
            <SheetHeader className="border-b">
              <SheetTitle>Anteprima</SheetTitle>
            </SheetHeader>
            <div className="h-[calc(100dvh-4.5rem)] p-3">{anteprimaAperta && <Anteprima control={control} />}</div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

/** L'invito vero, in un riquadro, con le impostazioni del modulo non ancora salvate. */
function Anteprima({ control }: { control: Control<Valori> }) {
  const valori = useWatch({ control }) as Valori;
  const cornice = useRef<HTMLIFrameElement>(null);
  const [pronta, setPronta] = useState(false);
  const src = useMemo(() => new URL("../?anteprima", window.location.href).toString().split("#")[0], []);

  useEffect(() => {
    const ascolta = (e: MessageEvent) => e.origin === window.location.origin && e.data?.tipo === "invito-anteprima-pronta" && setPronta(true);
    window.addEventListener("message", ascolta);
    return () => window.removeEventListener("message", ascolta);
  }, []);

  useEffect(() => {
    if (!pronta) return;
    const t = setTimeout(() => {
      try {
        cornice.current?.contentWindow?.postMessage({ tipo: "invito-anteprima", config: aConfig(valori) }, window.location.origin);
      } catch {
        /* valori incompleti mentre si scrive */
      }
    }, 250);
    return () => clearTimeout(t);
  }, [valori, pronta]);

  return (
    <div className="flex h-full flex-col gap-2">
      <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">Anteprima dal vivo · non salvata</p>
      <div className="relative mx-auto w-full max-w-[390px] flex-1 overflow-hidden rounded-[2rem] border-8 border-foreground/85 bg-background shadow-xl">
        <iframe ref={cornice} src={src} title="Anteprima dell'invito" className="size-full" />
      </div>
    </div>
  );
}

/** Cerca le coordinate dal nome e dall'indirizzo (Photon/OpenStreetMap, gratuito). */
function TrovaCoordinate({ control, onTrovate }: { control: Control<Valori>; onTrovate: (lat: number, lng: number) => void }) {
  const luogo = useWatch({ control, name: "luogo" });
  const [stato, setStato] = useState<"" | "cerco" | string>("");
  const cerca = async () => {
    setStato("cerco");
    try {
      const q = `${luogo.nome ?? ""} ${luogo.indirizzo ?? ""}`.trim();
      const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1`).then((x) => x.json());
      const f = r.features?.[0];
      if (!f) return setStato("Non trovato: provate a scrivere l'indirizzo in modo diverso, o inserite le coordinate a mano.");
      const [lng, lat] = f.geometry.coordinates as [number, number];
      onTrovate(Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5);
      setStato(`Trovato: ${[f.properties.name, f.properties.street, f.properties.city].filter(Boolean).join(", ")}`);
    } catch {
      setStato("Ricerca non disponibile in questo momento.");
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" variant="outline" onClick={cerca} disabled={stato === "cerco"}>
        {stato === "cerco" ? <Loader2 className="animate-spin" /> : <MapPin />} Trova le coordinate
      </Button>
      <a
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        href={`https://www.openstreetmap.org/?mlat=${luogo.lat}&mlon=${luogo.lng}#map=17/${luogo.lat}/${luogo.lng}`}
        target="_blank"
        rel="noopener"
      >
        Controlla sulla mappa
      </a>
      {stato && stato !== "cerco" && <p className="w-full text-xs text-muted-foreground">{stato}</p>}
    </div>
  );
}
