import { MaterialType, MaterialLine, RiskStatus } from './types';

export function fixDate(d: any): string {
  if (!d) return '';
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  
  const num = Number(d);
  if (!isNaN(num) && num > 30000 && num < 60000) {
    const date = new Date((num - 25569) * 86400 * 1000);
    if (!isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
  }
  
  let s = String(d).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  
  // Handle DD-MMM (e.g. 28-May)
  const m = s.match(/^(\d{1,2})-(\w{3})$/);
  if (m) {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const mon = months.indexOf(m[2].toLowerCase());
    if (mon !== -1) {
      return new Date(new Date().getFullYear(), mon, parseInt(m[1])).toISOString().slice(0, 10);
    }
  }
  
  // Handle DD/MM/YYYY
  const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m2) return `${m2[3]}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`;
  
  try {
    const dt = new Date(s);
    if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  } catch (e) {}
  
  return '';
}

export function fDate(d: any): string {
  if (!d) return '—';
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return String(d).slice(0, 10);
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
}

export function parseNum(v: any): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

export function stripSuffix(id: string): string {
  return id ? id.replace(/-[A-Z]$/, '').trim() : '';
}

export function daysBetween(a: any, b: any): number | null {
  if (!a || !b) return null;
  const da = a instanceof Date ? a : new Date(a);
  const db = b instanceof Date ? b : new Date(b);
  if (isNaN(da.getTime()) || isNaN(db.getTime())) return null;
  return Math.round((da.getTime() - db.getTime()) / 86400000);
}

// ── MATERIAL TYPE DETECTION ───────────────────────────────
export function detectMatType(matNo: string): MaterialType {
  if (!matNo) return 'UNKNOWN';
  const p = String(matNo).substring(0, 3).toUpperCase();
  if (p === 'ANP' || p === 'AYP' || p === 'ACP') return 'LEATHER';
  if (p === 'APU') return 'PU';
  if (p === 'APV') return 'PVC';
  if (p === 'ABL' || p === 'ATX' || p === 'ATH') return 'FABRIC';
  return 'UNKNOWN';
}

export function detectMatTypeFromContent(s: string): MaterialType {
  if (!s) return 'UNKNOWN';
  if (/\dMM\s+[\d.±]+-?[\d.]*CM/i.test(s) || /[\d.]+-[\d.]+CM\s/i.test(s) || /\d+CM\s+[\u4e00-\u9fff]/i.test(s)) {
    if (/PVC/i.test(s)) return 'PVC';
    if (/PU/i.test(s)) return 'PU';
  }
  if (/SF$/i.test(s) || /\d+-\d+SF/i.test(s)) return 'LEATHER';
  if (/''+|"|\bYDS\b/i.test(s)) return 'FABRIC';
  return 'UNKNOWN';
}

// ── COLOR EXTRACTION HELPERS ──────────────────────────────
export function extractColorFromEnd(s: string) {
  const m = s.match(/\s+([\u4e00-\u9fff\uff00-\uffef]+(?:\s*[\u4e00-\u9fff\uff00-\uffef]+)*)\s*$/);
  if (m) return { colorCN: m[1].trim(), article: s.slice(0, m.index).trim() };
  return { colorCN: '', article: s.trim() };
}

export function cleanColorEN(s: string): string {
  if (!s) return '';
  s = s.trim();
  s = s.replace(/\s+[\d.]+-[\d.]+SF\b.*$/i, '');
  s = s.replace(/\s+[\u4e00-\u9fff].*$/, '');
  s = s.replace(/\s+\d+%.*$/, '');
  s = s.replace(/\s+A\/B.*$/i, '');
  s = s.trim();
  const GRADE_ONLY = /^(PUMP GRADE|BOOT GRADE|SANDAL GRADE|PUMP GRADE \d+%|BOOT GRADE \d+%)$/i;
  if (GRADE_ONLY.test(s)) return '';
  return s;
}

// ── LEATHER SPLIT ─────────────────────────────────────────
export function leatherSplit(s: string) {
  let sizeRange = '';
  const szM = s.match(/([\d.]+-[\d.]+SF)\b/i);
  if (szM) {
    sizeRange = szM[1];
    s = s.slice(0, szM.index).trim();
  }
  const fi = s.indexOf('/');
  if (fi < 0) return { matCN: s, matEN: '', colorCN: '', colorEN: '', sizeRange };
  const matCN = s.slice(0, fi).trim();
  const rest = s.slice(fi + 1).trim();
  const li = rest.lastIndexOf('/');
  if (li < 0) {
    const { colorCN, article } = extractColorFromEnd(rest);
    return { matCN, matEN: article, colorCN, colorEN: '', sizeRange };
  }
  const left = rest.slice(0, li).trim();
  const colorEN_raw = rest.slice(li + 1).trim();
  const colorEN = cleanColorEN(colorEN_raw);
  const { colorCN, article } = extractColorFromEnd(left);
  return { matCN, matEN: article, colorCN, colorEN, sizeRange };
}

// ── WIDTH EXTRACTION ──────────────────────────────────────
export function extractWidthFromStart(s: string) {
  const patterns = [
    /^([\d.±+\-]+CM[（(][^)）]*[)）])/,
    /^([\d.±+\-]+-[\d.±+\-]+CM)/,
    /^([\d.±+\-]+CM)/,
    /^([\d.]+''+)/,
    /^([\d.]+")/,
    /^([\d.]+'')/,
  ];
  for (const p of patterns) {
    const m = s.match(p);
    if (m) return { width: m[1], rest: s.slice(m[1].length).trim() };
  }
  return { width: '', rest: s };
}

export function extractPartsWithColor(s: string) {
  const parts = s.split('/');
  if (!parts.length) return { matCN: '', matEN: '', colorCN: '', colorEN: '' };
  const matCN = parts[0].trim();
  if (parts.length === 1) return { matCN, matEN: '', colorCN: '', colorEN: '' };
  const colorEN_raw = parts[parts.length - 1].trim();
  const middle = parts.slice(1, parts.length - 1).join('/').trim();
  const colorEN = cleanColorEN(colorEN_raw);
  if (!middle) {
    const { colorCN, article } = extractColorFromEnd(colorEN_raw);
    if (colorCN && /[a-zA-Z]/.test(article)) return { matCN, matEN: article, colorCN, colorEN: '' };
    return { matCN, matEN: cleanColorEN(colorEN_raw) || colorEN_raw, colorCN, colorEN: '' };
  }
  const { colorCN, article } = extractColorFromEnd(middle);
  return { matCN, matEN: article, colorCN, colorEN };
}

function parseLeatherPart(s: string, res: any) {
  const r = leatherSplit(s);
  res.matCN = r.matCN;
  res.matEN = r.matEN;
  res.colorCN = r.colorCN;
  res.colorEN = r.colorEN;
  if (r.sizeRange) res.sizeRange = r.sizeRange;
}

function parsePUPart(s: string, res: any) {
  res.unit = 'SQM';
  const { width, rest } = extractWidthFromStart(s);
  if (width) res.width = width;
  const { matCN, matEN, colorCN, colorEN } = extractPartsWithColor(rest);
  res.matCN = matCN;
  res.matEN = matEN;
  res.colorCN = colorCN;
  res.colorEN = colorEN;
}

function parsePVCPart(s: string, res: any) {
  res.unit = 'M';
  const firstSlash = s.indexOf('/');
  if (firstSlash > -1) {
    res.width = s.slice(0, firstSlash).trim();
    s = s.slice(firstSlash + 1).trim();
  }
  const widthENM = s.match(/^([0-9.+\-\/]+CM\s*(?:\([^)]+\))?)\s*/i);
  if (widthENM) s = s.slice(widthENM[0].length);
  const { matCN, matEN, colorCN, colorEN } = extractPartsWithColor(s);
  res.matCN = matCN;
  res.matEN = matEN;
  res.colorCN = colorCN;
  res.colorEN = colorEN;
}

function parseFabricPart(s: string, res: any) {
  res.unit = 'YDS';
  const { width, rest } = extractWidthFromStart(s);
  if (width) res.width = width;
  const { matCN, matEN, colorCN, colorEN } = extractPartsWithColor(rest);
  res.matCN = matCN;
  res.matEN = matEN;
  res.colorCN = colorCN;
  res.colorEN = colorEN;
}

export function parseERPMatName(s: string, matNo = '') {
  if (!s) return { matType: 'UNKNOWN', matCN: '', matEN: '', colorCN: '', colorEN: '', thickness: '', sizeRange: '', width: '', unit: '' };
  s = String(s).trim();
  const res: any = { matCN: '', matEN: '', colorCN: '', colorEN: '', thickness: '', sizeRange: '', width: '', unit: '', matType: 'UNKNOWN' };
  
  const matType = detectMatType(matNo) || detectMatTypeFromContent(s);
  res.matType = matType;
  
  const thickM = s.match(/^([\d.]+(?:[±][.\d]+)?(?:-[\d.]+)?[Mm][Mm])\s+/);
  if (thickM) {
    res.thickness = thickM[1];
    s = s.slice(thickM[0].length);
  }
  
  if (matType === 'LEATHER') {
    parseLeatherPart(s, res);
    if (!res.unit) res.unit = 'SF';
  } else if (matType === 'PU') {
    parsePUPart(s, res);
  } else if (matType === 'PVC') {
    parsePVCPart(s, res);
  } else if (matType === 'FABRIC') {
    parseFabricPart(s, res);
  } else {
    const { width, rest } = extractWidthFromStart(s);
    if (width) {
      res.width = width;
      const { matCN, matEN, colorCN, colorEN } = extractPartsWithColor(rest);
      res.matCN = matCN;
      res.matEN = matEN;
      res.colorCN = colorCN;
      res.colorEN = colorEN;
    } else {
      parseLeatherPart(s, res);
    }
    if (!res.unit) res.unit = 'SF';
  }
  return res;
}

// ── RISK LEVEL CALCULATION ────────────────────────────────
export function calcMatRisk(m: MaterialLine, lineUpDate: Date | null): RiskStatus {
  // If we have enough stock, lacking_qty is positive or zero (lacking_qty = stock_in - purchase)
  if (m.purchase_qty > 0 && m.lacking_qty >= 0) return 'stocked';
  if (!m.eta) {
    return m.purchase_qty > 0 ? 'warn' : 'ok';
  }
  const gap = daysBetween(lineUpDate, m.eta);
  if (gap === null) return 'warn';
  if (gap < 0) return 'risk';
  if (gap < 7) return 'warn';
  return 'ok';
}
export function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}
