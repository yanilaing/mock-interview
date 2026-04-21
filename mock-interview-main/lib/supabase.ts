import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getPublicEnvValue, getSupabaseEnvError } from './env';

let supabaseClient: SupabaseClient | null = null;

export const getSupabaseClient = () => {
  if (supabaseClient) {
    return supabaseClient;
  }

  const envError = getSupabaseEnvError();
  if (envError) {
    throw new Error(envError);
  }

  supabaseClient = createClient(
    getPublicEnvValue('NEXT_PUBLIC_SUPABASE_URL'),
    getPublicEnvValue('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  );

  return supabaseClient;
};
