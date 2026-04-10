import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

// Client-side Supabase client (uses anon key)
export const supabase = createClient(url, anonKey);

// Server-side Supabase client (uses secret key — only import in API routes / server components)
export const supabaseAdmin = createClient(url, secretKey);
