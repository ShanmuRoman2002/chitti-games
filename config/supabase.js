require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes('your-supabase')) {
  console.error('❌ CRITICAL ERROR: Supabase credentials (SUPABASE_URL / SUPABASE_ANON_KEY) missing from .env!');
  console.error('Offline fallback is disabled. The server must strictly interact with Supabase.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

console.log('⚡ Connected to Supabase at:', SUPABASE_URL);

module.exports = { supabase, SUPABASE_URL, SUPABASE_ANON_KEY };

