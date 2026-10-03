import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { normalizzaTelefono, telefonoLeggibile } from "../../lib/contatti";
import { Button } from "@/sposi/ui/button";
import { Input } from "@/sposi/ui/input";
import { Label } from "@/sposi/ui/label";
import { Textarea } from "@/sposi/ui/textarea";
import { Finestra } from "./Pannello";
import { useAzioni } from "../query";
import type { Invito } from "../inviti";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const schema = z.object({
  nome: z.string().trim().min(1, "Serve il nome della famiglia").max(120, "Al massimo 120 caratteri"),
  telefono: z.string().trim().refine((t) => !t || !!normalizzaTelefono(t), "Numero non riconosciuto"),
  email: z.string().trim().refine((t) => !t || EMAIL.test(t), "Email non valida"),
  persone: z.string().trim().refine((t) => !t || (/^\d+$/.test(t) && +t >= 1 && +t <= 30), "Da 1 a 30"),
  nota: z.string().max(600, "Al massimo 600 caratteri"),
});
type Valori = z.infer<typeof schema>;

const daInvito = (i?: Invito): Valori => ({
  nome: i?.nome ?? "",
  telefono: i?.telefono ? telefonoLeggibile(i.telefono) : "",
  email: i?.email ?? "",
  persone: i?.persone_previste ? String(i.persone_previste) : "",
  nota: i?.nota_sposi ?? "",
});

export function FormInvito({ aperto, invito, onChiudi }: { aperto: boolean; invito?: Invito; onChiudi: () => void }) {
  const { creaInviti, aggiornaInvito } = useAzioni();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Valori>({ resolver: zodResolver(schema), defaultValues: daInvito(invito) });

  useEffect(() => {
    if (aperto) reset(daInvito(invito));
  }, [aperto, invito, reset]);

  const salva = handleSubmit(async (v) => {
    const dati = {
      nome: v.nome.trim(),
      telefono: v.telefono ? normalizzaTelefono(v.telefono) : null,
      email: v.email.trim() || null,
      persone_previste: v.persone ? Number(v.persone) : null,
      nota_sposi: v.nota.trim() || null,
    };
    if (invito) await aggiornaInvito.mutateAsync({ id: invito.id, modifiche: dati });
    else await creaInviti.mutateAsync([dati]);
    onChiudi();
  });

  return (
    <Finestra
      aperto={aperto}
      onChiudi={onChiudi}
      titolo={invito ? "Modifica invito" : "Nuovo invito"}
      descrizione={invito ? undefined : "Ogni invito ha il suo link personale da mandare alla famiglia."}
      piede={
        <>
          <Button variant="outline" onClick={onChiudi}>
            Annulla
          </Button>
          <Button onClick={salva} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />} Salva
          </Button>
        </>
      }
    >
      <form onSubmit={salva} className="grid gap-4">
        <Campo etichetta="Famiglia o nome" errore={errors.nome?.message}>
          <Input {...register("nome")} placeholder="Famiglia Esposito" autoFocus aria-invalid={!!errors.nome} />
        </Campo>
        <div className="grid grid-cols-[1fr_130px] gap-3">
          <Campo etichetta="Telefono" errore={errors.telefono?.message}>
            <Input {...register("telefono")} placeholder="333 123 4567" inputMode="tel" aria-invalid={!!errors.telefono} />
          </Campo>
          <Campo etichetta="Persone previste" errore={errors.persone?.message}>
            <Input {...register("persone")} placeholder="4" inputMode="numeric" aria-invalid={!!errors.persone} />
          </Campo>
        </div>
        <Campo etichetta="Email" errore={errors.email?.message}>
          <Input {...register("email")} placeholder="facoltativa" inputMode="email" aria-invalid={!!errors.email} />
        </Campo>
        <Campo etichetta="Nota privata">
          <Textarea {...register("nota")} placeholder="es. cugini di Rosa" rows={2} className="resize-none" />
        </Campo>
        <p className="text-xs text-muted-foreground">Il numero di persone è indicativo: la famiglia può confermarne di più o di meno.</p>
        <button type="submit" hidden />
      </form>
    </Finestra>
  );
}

export function Campo({ etichetta, errore, children }: { etichetta: string; errore?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{etichetta}</Label>
      {children}
      {errore && <p className="text-xs text-destructive">{errore}</p>}
    </div>
  );
}
