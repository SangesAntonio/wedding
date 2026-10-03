import { supabase } from "../lib/supabase";
import { CHIAVE_DEMO_INVITI } from "../lib/prenotazioni";
import { linkWhatsApp } from "../lib/contatti";

export interface Invito {
  id: string;
  token: string;
  nome: string;
  telefono: string | null;
  email: string | null;
  persone_previste: number | null;
  nota_sposi: string | null;
  inviato_il: string | null;
  aperto_il: string | null;
  revocato: boolean;
  creato_il: string;
}

export type NuovoInvito = Pick<Invito, "nome" | "telefono" | "email" | "persone_previste" | "nota_sposi">;

const CAMPI = "id, token, nome, telefono, email, persone_previste, nota_sposi, inviato_il, aperto_il, revocato, creato_il";

export const MESSAGGIO_PREDEFINITO =
  "Ciao {nome}! 💍\nAntonio e Rosa si sposano martedì 20 luglio 2027.\nQui trovate il vostro invito, potete scegliere i posti e confermare: {link}";

// ------------------------------------------------------------ modalità demo (localStorage, condiviso con l'invito)
const leggiDemo = (): Invito[] => {
  try {
    return JSON.parse(localStorage.getItem(CHIAVE_DEMO_INVITI) || "[]");
  } catch {
    return [];
  }
};
const scriviDemo = (v: Invito[]) => localStorage.setItem(CHIAVE_DEMO_INVITI, JSON.stringify(v));
const tokenDemo = () => Array.from({ length: 8 }, () => "23456789abcdefghjkmnpqrstuvwxyz"[Math.floor(Math.random() * 31)]).join("");
const CHIAVE_DEMO_MSG = "invito-ar:demo-messaggio";

// ------------------------------------------------------------ lettura e scrittura
export async function caricaInviti(matrimonioId: string): Promise<Invito[]> {
  if (!supabase) return leggiDemo();
  const { data, error } = await supabase.from("inviti").select(CAMPI).eq("matrimonio_id", matrimonioId).order("nome");
  if (error) throw error;
  return (data ?? []) as Invito[];
}

export async function creaInviti(matrimonioId: string, nuovi: NuovoInvito[]): Promise<Invito[]> {
  if (!supabase) {
    const creati = nuovi.map((n) => ({
      ...n,
      id: crypto.randomUUID(),
      token: tokenDemo(),
      inviato_il: null,
      aperto_il: null,
      revocato: false,
      creato_il: new Date().toISOString(),
    }));
    scriviDemo([...leggiDemo(), ...creati]);
    return creati;
  }
  const { data, error } = await supabase
    .from("inviti")
    .insert(nuovi.map((n) => ({ ...n, matrimonio_id: matrimonioId })))
    .select(CAMPI);
  if (error) throw error;
  return (data ?? []) as Invito[];
}

export async function aggiornaInvito(id: string, modifiche: Partial<Invito>): Promise<void> {
  if (!supabase) {
    scriviDemo(leggiDemo().map((i) => (i.id === id ? { ...i, ...modifiche } : i)));
    return;
  }
  const { error } = await supabase.from("inviti").update(modifiche).eq("id", id);
  if (error) throw error;
}

export async function eliminaInvito(id: string): Promise<void> {
  if (!supabase) {
    scriviDemo(leggiDemo().filter((i) => i.id !== id));
    return;
  }
  const { error } = await supabase.from("inviti").delete().eq("id", id);
  if (error) throw error;
}

export const segnaInviato = (id: string) => aggiornaInvito(id, { inviato_il: new Date().toISOString() });

// ------------------------------------------------------------ messaggio WhatsApp
export async function leggiMessaggio(matrimonioId: string): Promise<string> {
  if (!supabase) return localStorage.getItem(CHIAVE_DEMO_MSG) || MESSAGGIO_PREDEFINITO;
  const { data, error } = await supabase.from("matrimoni").select("config").eq("id", matrimonioId).single();
  if (error) throw error;
  return (data?.config?.messaggio_invito as string | undefined) || MESSAGGIO_PREDEFINITO;
}

export async function salvaMessaggio(matrimonioId: string, testo: string): Promise<void> {
  if (!supabase) {
    localStorage.setItem(CHIAVE_DEMO_MSG, testo);
    return;
  }
  const { data, error } = await supabase.from("matrimoni").select("config").eq("id", matrimonioId).single();
  if (error) throw error;
  const { error: e2 } = await supabase
    .from("matrimoni")
    .update({ config: { ...(data?.config ?? {}), messaggio_invito: testo } })
    .eq("id", matrimonioId);
  if (e2) throw e2;
}

/** L'indirizzo dell'invito è la cartella sopra /sposi/. */
export const linkInvito = (token: string) => new URL(`../?i=${token}`, window.location.href).toString();

export const testoMessaggio = (modello: string, invito: Pick<Invito, "nome" | "token">) =>
  modello.replace(/\{nome\}/g, invito.nome).replace(/\{link\}/g, linkInvito(invito.token));

export const whatsappInvito = (modello: string, invito: Invito) =>
  invito.telefono ? linkWhatsApp(invito.telefono, testoMessaggio(modello, invito)) : null;
