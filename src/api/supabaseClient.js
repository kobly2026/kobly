// Kobly — cliente Supabase único do app. Lê VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
// do .env (a anon key é pública e pode ir pro bundle). Fallback embutido p/ robustez no demo.
import { createClient } from '@supabase/supabase-js';

const URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://hvkuymprmfrjrgpqaxbw.supabase.co';
const ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2a3V5bXBybWZyanJncHFheGJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NDg0MjgsImV4cCI6MjA5ODAyNDQyOH0.4JR1XTwfXv0x8QAgLd9y6K6nHJem0v_qi0QGUvxs1J4';

export const supabase = createClient(URL, ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // processa o link de recuperação de senha (#type=recovery)
    flowType: 'pkce',
  },
});
