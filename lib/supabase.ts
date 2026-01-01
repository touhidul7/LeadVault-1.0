import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Lead = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  linkedin_url: string;
  company: string;
  title: string;
  website: string;
  location: string;
  country: string;
  notes: string;
  domain: string;
  source_file: string;
  import_id: string | null;
  is_duplicate: boolean;
  duplicate_group_id: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
};

export type Import = {
  id: string;
  file_name: string;
  total_rows: number;
  successful_rows: number;
  failed_rows: number;
  status: string;
  user_id: string;
  created_at: string;
};
