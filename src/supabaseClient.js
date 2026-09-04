import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// Accepte la nouvelle "Publishable key" (sb_publishable_...) ou, à défaut,
// l'ancienne "anon key" si votre projet Supabase utilise encore la terminologie précédente.
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  // eslint-disable-next-line no-console
  console.error(
    "Variables Supabase manquantes. Vérifiez votre fichier .env (VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY)."
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);
