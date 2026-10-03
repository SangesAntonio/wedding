import { useEffect, useState, type ReactNode } from "react";
import {
  Baby,
  Ban,
  Check,
  Copy,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  Share2,
  Trash2,
  TriangleAlert,
  UserX,
} from "lucide-react";
import { linkChiamata, linkEmail, linkWhatsApp, telefonoLeggibile } from "../../lib/contatti";
import { Button } from "@/sposi/ui/button";
import { Textarea } from "@/sposi/ui/textarea";
import { Separator } from "@/sposi/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/sposi/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/sposi/ui/select";
import { cn } from "@/sposi/lib/utils";
import { PannelloLaterale } from "./Pannello";
import { StatoBadge } from "./Stato";
import { useAzioniUi } from "../azioni-ui";
import { useAzioniFamiglia } from "../hooks/useAzioniFamiglia";
import { useFamiglie, useStorico } from "../query";
import { RICHIAMI, settoreDi, type Famiglia } from "../famiglie";
import { ETICHETTE_STATO, dataBreve, giornoBreve, nomeSupplemento, type Richiamo, type VoceStorico } from "../dati";
import { linkInvito } from "../inviti";

export function Dettaglio({ famiglia: f, onChiudi }: { famiglia?: Famiglia; onChiudi: () => void }) {
  // tiene l'ultima famiglia mostrata durante l'animazione di chiusura
  const [ultima, setUltima] = useState(f);
  useEffect(() => {
    if (f) setUltima(f);
  }, [f]);
  const v = f ?? ultima;
  return (
    <PannelloLaterale
      aperto={!!f}
      onChiudi={onChiudi}
      titolo={v?.nome ?? ""}
      descrizione={
        v && (
          <span className="flex flex-wrap items-center gap-2 pt-1">
            <StatoBadge stato={v.stato} />
            {v.persone > 0 && (
              <span className="text-sm text-muted-foreground tabular">
                {v.persone} {v.persone === 1 ? "persona" : "persone"}
                {v.previste != null && ` · previste ${v.previste}`}
              </span>
            )}
            {!v.persone && v.previste != null && <span className="text-sm text-muted-foreground">previste {v.previste}</span>}
          </span>
        )
      }
      piede={v && <Piede f={v} />}
    >
      {v && <Contenuto f={v} />}
    </PannelloLaterale>
  );
}

function Sezione({ titolo, azione, children }: { titolo: string; azione?: ReactNode; children: ReactNode }) {
  return (
    <section className="py-4 first:pt-0">
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">{titolo}</h3>
        {azione}
      </div>
      {children}
    </section>
  );
}

function Riga({ etichetta, children }: { etichetta: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 py-1 text-sm">
      <span className="text-muted-foreground">{etichetta}</span>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

function Contenuto({ f }: { f: Famiglia }) {
  const az = useAzioniFamiglia();
  const { apri } = useAzioniUi();
  const p = f.prenotazione;
  const i = f.invito;
  const attiva = p && p.stato !== "annullata";

  return (
    <div className="divide-y">
      {/* contatti rapidi */}
      {(f.telefono || f.email) && (
        <div className="flex flex-wrap gap-2 pb-4">
          {f.telefono && (
            <>
              <Button variant="outline" size="sm" asChild>
                <a href={linkChiamata(f.telefono)}>
                  <Phone /> {telefonoLeggibile(f.telefono)}
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={linkWhatsApp(f.telefono)} target="_blank" rel="noopener">
                  <MessageCircle /> Chat
                </a>
              </Button>
            </>
          )}
          {f.email && (
            <Button variant="outline" size="sm" asChild>
              <a href={linkEmail(f.email)}>
                <Mail /> Email
              </a>
            </Button>
          )}
        </div>
      )}

      {/* da verificare */}
      {p?.stato === "da_verificare" && <Verifica f={f} />}

      {/* seconda conferma */}
      {p?.stato === "confermata" && (
        <Sezione titolo="Seconda conferma" azione={p.richiamo_il && <span className="text-xs text-muted-foreground">segnata {giornoBreve(p.richiamo_il)}</span>}>
          <ToggleGroup
            type="single"
            variant="outline"
            value={p.richiamo}
            onValueChange={(v) => v && az.richiamo(p, v as Richiamo)}
            className="grid w-full grid-cols-2 sm:grid-cols-4"
          >
            {(Object.keys(RICHIAMI) as Richiamo[]).map((r) => (
              <ToggleGroupItem key={r} value={r} className="h-10 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                {RICHIAMI[r].etichetta}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Sezione>
      )}

      {/* ospiti */}
      {p && (
        <Sezione
          titolo={attiva ? "Chi viene" : "Prenotazione annullata"}
          azione={
            <Button variant="ghost" size="sm" className="h-7" onClick={() => apri({ tipo: "prenotazione", famiglia: f })}>
              <Pencil /> Modifica
            </Button>
          }
        >
          {f.nomiMancanti && (
            <p className="mb-2 flex items-center gap-2 rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn">
              <TriangleAlert className="size-4" /> Nomi da completare: premete Modifica.
            </p>
          )}
          <ul className={cn("divide-y rounded-lg border", !attiva && "opacity-60")}>
            {p.posti.map((posto, n) => {
              const o = p.ospiti[n];
              const s = settoreDi(posto);
              return (
                <li key={posto} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="size-2 rounded-full" style={{ background: s?.col }} />
                  <span className={cn("flex-1 truncate", !o && "text-muted-foreground italic")}>{o?.nome ?? "Nome da completare"}</span>
                  {o?.bambino && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-info-bg px-2 text-[11px] text-info">
                      <Baby className="size-3" /> bimbo
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground tabular">{posto}</span>
                </li>
              );
            })}
          </ul>
        </Sezione>
      )}

      {/* dettagli prenotazione */}
      {p && (
        <Sezione titolo="Prenotazione">
          {p.note && (
            <p className="mb-2 flex gap-2 rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {p.note}
            </p>
          )}
          <Riga etichetta="Stato">{ETICHETTE_STATO[p.stato]}</Riga>
          <Riga etichetta="Codice">
            <span className="font-mono tracking-wider">{p.codice}</span>
          </Riga>
          <Riga etichetta="Confermata">{dataBreve(p.creata_il)}</Riga>
          {p.contatto && <Riga etichetta="Contatto">{p.contatto}</Riga>}
          {p.supplementi.length > 0 && <Riga etichetta="Supplementi">{p.supplementi.map(nomeSupplemento).join(", ")}</Riga>}
          <Riga etichetta="Totale indicato">{p.totale} €</Riga>
          {p.nome !== f.nome && <Riga etichetta="Nome scelto">{p.nome}</Riga>}
        </Sezione>
      )}

      {!p && (
        <Sezione titolo="Prenotazione">
          <p className="mb-3 text-sm text-muted-foreground">Non ha ancora confermato. Se vi ha risposto a voce, potete inserire voi la prenotazione.</p>
          <Button variant="outline" onClick={() => apri({ tipo: "prenotazione", famiglia: f })}>
            <Plus /> Prenotazione a mano
          </Button>
        </Sezione>
      )}

      {/* nota privata */}
      <NotaPrivata f={f} />

      {/* invito */}
      {i && (
        <Sezione
          titolo="Invito"
          azione={
            <Button variant="ghost" size="sm" className="h-7" onClick={() => apri({ tipo: "modifica-invito", invito: i })}>
              <Pencil /> Modifica
            </Button>
          }
        >
          <Riga etichetta="Persone previste">{i.persone_previste ?? "—"}</Riga>
          <Riga etichetta="Telefono">{i.telefono ? telefonoLeggibile(i.telefono) : "—"}</Riga>
          {i.email && <Riga etichetta="Email">{i.email}</Riga>}
          <Riga etichetta="Link">
            <span className="font-mono text-xs break-all text-muted-foreground">{linkInvito(i.token).replace(/^https?:\/\//, "")}</span>
          </Riga>
          {!i.revocato && (
            <div className="mt-3 flex flex-wrap gap-2">
              {i.telefono && (
                <Button size="sm" onClick={() => az.whatsapp(i)}>
                  <MessageCircle /> Manda su WhatsApp
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => az.copiaLink(i)}>
                <Copy /> Copia link
              </Button>
              {az.puoCondividere && (
                <Button size="sm" variant="outline" onClick={() => az.condividi(i)}>
                  <Share2 /> Condividi
                </Button>
              )}
            </div>
          )}
        </Sezione>
      )}

      <Storico f={f} />
    </div>
  );
}

function Verifica({ f }: { f: Famiglia }) {
  const az = useAzioniFamiglia();
  const { inviti } = useFamiglie();
  const [invito, setInvito] = useState("");
  const liberi = inviti.filter((i) => !i.revocato);
  return (
    <Sezione titolo="Da verificare">
      <p className="mb-3 text-sm text-muted-foreground">È arrivata dal link generico. Se la conoscete approvatela, o collegatela all'invito giusto.</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => az.approva(f.prenotazione!)}>
          <Check /> Approva
        </Button>
        <Select value={invito} onValueChange={(v) => (setInvito(v), az.approva(f.prenotazione!, v))}>
          <SelectTrigger size="sm" className="w-52">
            <SelectValue placeholder="Collega a un invito…" />
          </SelectTrigger>
          <SelectContent>
            {liberi.map((i) => (
              <SelectItem key={i.id} value={i.id}>
                {i.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => az.scarta(f)}>
          <UserX /> Non la conosciamo
        </Button>
      </div>
    </Sezione>
  );
}

function NotaPrivata({ f }: { f: Famiglia }) {
  const az = useAzioniFamiglia();
  const [testo, setTesto] = useState(f.notaSposi ?? "");
  useEffect(() => setTesto(f.notaSposi ?? ""), [f.chiave, f.notaSposi]);
  const cambiata = testo.trim() !== (f.notaSposi ?? "");
  return (
    <Sezione titolo="Nota privata" azione={cambiata && <span className="text-xs text-muted-foreground">si salva uscendo dal campo</span>}>
      <Textarea
        value={testo}
        onChange={(e) => setTesto(e.target.value)}
        onBlur={() => cambiata && az.notaSposi(f, testo)}
        placeholder="Solo per voi: es. richiamare dopo il 15, portano la torta…"
        rows={2}
        maxLength={600}
        className="resize-none bg-background"
      />
    </Sezione>
  );
}

const AZIONI: Record<string, string> = {
  creata: "ha confermato",
  confermata: "approvata / ripristinata",
  annullata: "segnata: non viene",
  da_verificare: "da verificare",
  modificata: "modificata",
  "richiamo:confermato": "seconda conferma: riconfermato",
  "richiamo:non_viene": "seconda conferma: non viene",
  "richiamo:non_risponde": "seconda conferma: non risponde",
  "richiamo:da_sentire": "seconda conferma: da risentire",
};

function descrivi(v: VoceStorico) {
  if (v.azione === "modificata" && v.prima && v.dopo) {
    const cambi: string[] = [];
    if (v.prima.persone !== v.dopo.persone) cambi.push(`persone ${v.prima.persone} → ${v.dopo.persone}`);
    if (JSON.stringify(v.prima.ospiti) !== JSON.stringify(v.dopo.ospiti)) cambi.push("nomi degli ospiti");
    if (v.prima.note !== v.dopo.note) cambi.push("note");
    if (v.prima.contatto !== v.dopo.contatto) cambi.push("contatto");
    if (v.prima.nota_sposi !== v.dopo.nota_sposi) cambi.push("nota privata");
    if (v.prima.nome !== v.dopo.nome) cambi.push("nome");
    if (v.prima.invito_id !== v.dopo.invito_id) cambi.push("collegata a un invito");
    return cambi.length ? "modificata: " + cambi.join(", ") : "modificata";
  }
  if (v.azione === "creata" && v.chi === "sposi") return "inserita da voi";
  return AZIONI[v.azione] ?? v.azione;
}

function Storico({ f }: { f: Famiglia }) {
  const { data: voci = [] } = useStorico(f.prenotazione?.id);
  const i = f.invito;
  const eventi = [
    ...voci.map((v) => ({ quando: v.quando, testo: descrivi(v), chi: v.chi })),
    ...(i?.aperto_il ? [{ quando: i.aperto_il, testo: "ha aperto il link", chi: "invitato" as const }] : []),
    ...(i?.inviato_il ? [{ quando: i.inviato_il, testo: "invito inviato", chi: "sposi" as const }] : []),
    ...(i ? [{ quando: i.creato_il, testo: "invito creato", chi: "sposi" as const }] : []),
  ].sort((a, b) => b.quando.localeCompare(a.quando));
  if (!eventi.length) return null;
  return (
    <Sezione titolo="Storico">
      <ol className="relative ml-1.5 border-l pl-4">
        {eventi.map((e, n) => (
          <li key={n} className="relative pb-3 last:pb-0">
            <span className={cn("absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-card", e.chi === "invitato" ? "bg-oro" : "bg-primary")} />
            <p className="text-sm">
              <span className="text-muted-foreground">{e.chi === "invitato" ? f.nome : "Voi"}</span> · {e.testo}
            </p>
            <p className="text-xs text-muted-foreground">{dataBreve(e.quando)}</p>
          </li>
        ))}
      </ol>
    </Sezione>
  );
}

function Piede({ f }: { f: Famiglia }) {
  const az = useAzioniFamiglia();
  const p = f.prenotazione;
  const i = f.invito;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {p && p.stato !== "annullata" && (
        <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => az.annulla(f)}>
          <UserX /> Annulla presenza
        </Button>
      )}
      {p?.stato === "annullata" && (
        <Button variant="outline" onClick={() => az.ripristina(p)}>
          <RotateCcw /> Ripristina prenotazione
        </Button>
      )}
      <Separator orientation="vertical" className="mx-1 h-6" />
      {i &&
        (i.revocato ? (
          <Button variant="ghost" onClick={() => az.riattiva(i)}>
            <RotateCcw /> Riattiva link
          </Button>
        ) : (
          <Button variant="ghost" onClick={() => az.revoca(i)}>
            <Ban /> Revoca link
          </Button>
        ))}
      {i && (
        <Button variant="ghost" size="icon" className="ml-auto text-destructive hover:text-destructive" onClick={() => az.elimina(f)} aria-label="Elimina invito">
          <Trash2 />
        </Button>
      )}
    </div>
  );
}
