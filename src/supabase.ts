import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://tavlrxjnxdndikvwgjfk.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_9K_os7K_9U4gwrQ507VmUg_OQeGDSqi';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const formatSupabaseError = (error: any) => {
  if (!error) return 'Unknown Supabase error';
  if (typeof error === 'string') return error;
  if (typeof error.message === 'string') return `${error.message}${error.details ? ` | ${error.details}` : ''}`;
  return JSON.stringify(error, Object.getOwnPropertyNames(error), 2);
};

export async function syncPODataToCloud(poList: any[]): Promise<boolean> {
  try {
    const payload = poList.map(item => ({
      po_no: item.no,
      supplier_name: item.supplierName,
      order_date: item.date,
      delivery_date: item.deliveryDate,
      status: item.status || 'New',
      lines: item.lines
    }));

    let result = await supabase
      .from('purchase_orders')
      .upsert(payload, { onConflict: 'po_no' });
    let { error } = result;

    if (error) {
      console.warn('Supabase upsert failed, retrying insert if possible:', formatSupabaseError(error));
      result = await supabase.from('purchase_orders').insert(payload);
      error = result.error;
    }

    if (error) {
      console.error('Supabase Sync error:', formatSupabaseError(error), error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('syncPODataToCloud catch:', err);
    return false;
  }
}

export async function fetchPODataFromCloud(): Promise<any[] | null> {
  try {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('*')
      .order('po_no', { ascending: false });

    if (error) {
      console.error('Supabase fetch error:', formatSupabaseError(error), error);
      return null;
    }

    if (data) {
      return data.map((item: any) => ({
        no: item.po_no,
        supplierName: item.supplier_name,
        date: item.order_date,
        deliveryDate: item.delivery_date,
        status: item.status,
        lines: item.lines || [],
        xeDate: '',
        stockOutDate: '',
        stockInDate: '',
        deliveryNote: '',
        supplierNo: '',
        season: '',
        orderNo: '',
        modelNo: '',
        note: '',
        createdBy: '',
        createDate: item.order_date || '',
        verifiedBy: '',
        verifiedDate: '',
        approvedBy: '',
        approveDate: ''
      }));
    }

    return [];
  } catch (err) {
    console.error('fetchPODataFromCloud catch:', err);
    return null;
  }
}
