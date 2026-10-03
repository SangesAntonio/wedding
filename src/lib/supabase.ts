import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Client condiviso da invito e area sposi; null in modalità demo (nessuna variabile configurata). */
export const supabase: SupabaseClient | null = SUPA_URL && SUPA_KEY ? createClient(SUPA_URL, SUPA_KEY) : null;
export const MODALITA_DEMO = !supabase;
