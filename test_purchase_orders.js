import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tavlrxjnxdndikvwgjfk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_9K_os7K_9U4gwrQ507VmUg_OQeGDSqi';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
  const { data, error } = await supabase.from('purchase_orders').select('*').limit(1);
  if (error) {
    console.error('Error fetching purchase_orders:', error);
  } else {
    console.log('Success fetching purchase_orders:', data);
  }
}

check();
