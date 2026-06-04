import { ProductionOrder, MaterialLine, POData, Shipment, DBStoreMeta } from './types';

const DB_NAME = 'f26_unified_v1';
const DB_VER = 1;
const STORE = 'data';
let _db: IDBDatabase | null = null;

export function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (_db) return resolve(_db);
    const r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    r.onsuccess = (e: any) => {
      _db = e.target.result;
      resolve(_db!);
    };
    r.onerror = () => reject(r.error);
  });
}

export async function idbSet(k: string, v: any): Promise<void> {
  try {
    const db = _db || await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(v, k);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (le) {}
  }
}

export async function idbGet(k: string): Promise<any> {
  try {
    const db = _db || await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const r = tx.objectStore(STORE).get(k);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(tx.error);
    });
  } catch (e) {
    try {
      const v = localStorage.getItem(k);
      return v ? JSON.parse(v) : null;
    } catch (le) {
      return null;
    }
  }
}

// ── SERIALIZERS / DESERIALIZERS ──────────────────────────
export function serializeProdOrders(arr: ProductionOrder[]): any[] {
  return arr.map(o => ({
    ...o,
    line_up_date: o.line_up_date ? o.line_up_date.toISOString() : null
  }));
}

export function deserializeProdOrders(arr: any[]): ProductionOrder[] {
  return (arr || []).map(o => ({
    ...o,
    line_up_date: o.line_up_date ? new Date(o.line_up_date) : null
  }));
}

export function serializeMatLines(arr: MaterialLine[]): any[] {
  return arr.map(m => ({
    ...m,
    etd: m.etd ? m.etd.toISOString() : null,
    eta: m.eta ? m.eta.toISOString() : null,
    stock_in_date: m.stock_in_date ? m.stock_in_date.toISOString() : null
  }));
}

export function deserializeMatLines(arr: any[]): MaterialLine[] {
  return (arr || []).map(m => ({
    ...m,
    etd: m.etd ? new Date(m.etd) : null,
    eta: m.eta ? new Date(m.eta) : null,
    stock_in_date: m.stock_in_date ? new Date(m.stock_in_date) : null
  }));
}

export async function saveAppState(
  prodOrders: ProductionOrder[],
  matLines: MaterialLine[],
  matLines2: MaterialLine[],
  poData: POData[],
  shpData: Shipment[]
): Promise<void> {
  await idbSet('prod_orders', serializeProdOrders(prodOrders));
  await idbSet('mat_lines', serializeMatLines(matLines));
  await idbSet('mat_lines2', serializeMatLines(matLines2));
  await idbSet('po_data', poData);
  await idbSet('shp_data', shpData);
  
  const meta: DBStoreMeta = {
    savedAt: Date.now(),
    prod: prodOrders.length,
    mat: matLines.length,
    mat2: matLines2.length,
    po: poData.length,
    shp: shpData.length
  };
  await idbSet('meta', meta);
}

export interface LoadedAppState {
  prodOrders: ProductionOrder[];
  matLines: MaterialLine[];
  matLines2: MaterialLine[];
  poData: POData[];
  shpData: Shipment[];
  meta: DBStoreMeta | null;
}

export async function loadAppState(): Promise<LoadedAppState> {
  const prod = await idbGet('prod_orders');
  const mat = await idbGet('mat_lines');
  const mat2 = await idbGet('mat_lines2');
  const po = await idbGet('po_data');
  const shp = await idbGet('shp_data');
  const meta = await idbGet('meta');

  return {
    prodOrders: deserializeProdOrders(prod),
    matLines: deserializeMatLines(mat),
    matLines2: deserializeMatLines(mat2),
    poData: po || [],
    shpData: shp || [],
    meta: meta || null
  };
}
