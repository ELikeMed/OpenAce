/**
 * Supabase client — shared instance for auth, database, and storage.
 * Configure via environment variables:
 *   SUPABASE_URL=https://your-project.supabase.co
 *   SUPABASE_ANON_KEY=eyJ...
 *   SUPABASE_SERVICE_KEY=eyJ... (server-side only, bypasses RLS)
 */

import { createClient } from '@supabase/supabase-js';

let supabase = null;
let supabaseAdmin = null;

export function getSupabase() {
  if (!supabase) {
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!url || !anonKey) return null;
    supabase = createClient(url, anonKey);
  }
  return supabase;
}

export function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !serviceKey) return null;
    supabaseAdmin = createClient(url, serviceKey);
  }
  return supabaseAdmin;
}

export function isCloudMode() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}
