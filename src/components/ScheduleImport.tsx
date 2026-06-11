import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { ProductionOrder, MaterialLine, DBStoreMeta } from '../types';
import { parseERPMatName, stripSuffix, parseNum, fixDate } from '../utils';

interface ScheduleImportProps {
  prodOrders: ProductionOrder[];
  setProdOrders: React.Dispatch<React.SetStateAction<ProductionOrder[]>>;
  matLines: MaterialLine[];
  setMatLines: React.Dispatch<React.SetStateAction<MaterialLine[]>>;
  matLines2: MaterialLine[];
  setMatLines2: React.Dispatch<React.SetStateAction<MaterialLine[]>>;
  meta: DBStoreMeta | null;
  saveData: (
    prod: ProductionOrder[],
    mat1: MaterialLine[],
    mat2: MaterialLine[]
  ) => void;
  buildCoordination: () => void;
}

const FAC_MAP: Record<string, string> = {
  '底部排期2厂': '二厂',
  '底部排期3厂 ': '三厂',
  '底部排期3厂': '三厂',
  '底部排期4厂 ': '四厂',
  '底部排期4厂': '四厂',
  '底部排期5厂+板房': '五厂+板房',
  '底部排期5厂+板房 ': '五厂+板房'
};

export const ScheduleImport: React.FC<ScheduleImportProps> = ({
  prodOrders,
  setProdOrders,
  matLines,
  setMatLines,
  matLines2,
  setMatLines2,
  meta,
  saveData,
  buildCoordination
}) => {
  const [logs, setLogs] = useState<Record<string, string[]>>({ prod: [], mat: [], mat2: [] });
  const [dragActive, setDragActive] = useState<Record<string, boolean>>({ prod: false, mat: false, mat2: false });
  const [yeFrom, setYeFrom] = useState<string>('');
  const [yeTo, setYeTo] = useState<string>('');
  const [yeScope, setYeScope] = useState<string>('all');
  const [yeResult, setYeResult] = useState<{ text: string; color: string }>({ text: '', color: '' });

  const addLog = (type: string, message: string) => {
    setLogs(prev => ({
      ...prev,
      [type]: [...prev[type], message]
    }));
  };

  const handleDrag = (e: React.DragEvent, type: string, active: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(prev => ({ ...prev, [type]: active }));
  };

  const handleDrop = async (e: React.DragEvent, type: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(prev => ({ ...prev, [type]: false }));
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file, type);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file, type);
    }
  };

  const processFile = async (file: File, type: string) => {
    setLogs(prev => ({ ...prev, [type]: [] }));
    addLog(type, `📂 Đang đọc: ${file.name} (${(file.size / 1024).toFixed(0)} KB)...`);
    
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true, dateNF: 'yyyy-mm-dd' });
      
      if (type === 'prod') {
        parseProdSchedule(wb, file.name);
      } else {
        parseMaterialTracking(wb, file.name, type as 'mat' | 'mat2');
      }
    } catch (err: any) {
      console.error(err);
      addLog(type, `❌ Lỗi đọc file: ${err.message || err}`);
    }
  };

  // ── PARSE 1: PRODUCTION SCHEDULE ────────────────────────
  const parseProdSchedule = (wb: XLSX.WorkBook, fname: string) => {
    const orders: ProductionOrder[] = [];
    let sheetsOk = 0;
    
    const gv = (ws: XLSX.WorkSheet, r: number, c: number): string => {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (!cell) return '';
      return String(cell.v ?? '').trim();
    };

    const isDateRow = (ws: XLSX.WorkSheet, r: number, nc: number): boolean => {
      let cnt = 0;
      for (let c = 0; c < nc; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (cell && typeof cell.v === 'number' && cell.v >= 1 && cell.v <= 31) cnt++;
      }
      return cnt >= 18;
    };

    const parseQty = (s: string): number => {
      if (!s) return 0;
      const m = String(s).match(/(\d+)PRS/i);
      if (m) return parseInt(m[1]);
      const m2 = String(s).match(/=(\d+)/);
      if (m2) return parseInt(m2[1]);
      const n = parseInt(s);
      return isNaN(n) ? 0 : n;
    };

    const getMonthAndLine = (h: string) => {
      const m = h.match(/(\d+)月/);
      const l = h.match(/[厂房]\s*([AB])\s*\)/);
      return {
        month: m ? parseInt(m[1]) : null,
        line: l ? l[1] : 'A'
      };
    };

    for (const shName of wb.SheetNames) {
      const factory = FAC_MAP[shName] || FAC_MAP[shName.trim()];
      if (!factory) {
        addLog('prod', `⬜ Bỏ qua sheet: ${shName}`);
        continue;
      }
      const ws = wb.Sheets[shName];
      if (!ws || !ws['!ref']) continue;
      
      const range = XLSX.utils.decode_range(ws['!ref']);
      const nrows = range.e.r + 1;
      const ncols = range.e.c + 1;
      
      addLog('prod', `📄 Đang xử lý: ${shName} → ${factory}...`);
      sheetsOk++;
      
      for (let r = 0; r < nrows; r++) {
        if (!isDateRow(ws, r, ncols)) continue;
        
        let monthHdr = '';
        let year = 2026; // Default year
        
        // Find month header row
        for (let k = r - 1; k >= Math.max(0, r - 20); k--) {
          for (let c = 0; c < Math.min(ncols, 10); c++) {
            const v = gv(ws, k, c);
            if (v.includes('月') && (v.includes('厂') || v.includes('板房')) && /\d+月（/.test(v)) {
              monthHdr = v;
              break;
            }
          }
          if (monthHdr) break;
        }
        
        if (!monthHdr) continue;
        const { month } = getMonthAndLine(monthHdr);
        if (!month) continue;
        
        // Col -> day mapping
        const colDay: Record<number, number> = {};
        for (let c = 0; c < ncols; c++) {
          const cell = ws[XLSX.utils.encode_cell({ r, c })];
          if (cell && typeof cell.v === 'number' && cell.v >= 1 && cell.v <= 31) {
            colDay[c] = cell.v;
          }
        }
        
        const R = { o: r + 1, s: r + 2, n: r + 3, l: r + 4, q: r + 5, x: r + 6, t: r + 7 };
        for (const [cStr, day] of Object.entries(colDay)) {
          const c = parseInt(cStr);
          const oid = gv(ws, R.o, c);
          if (!oid || !/^V[A-Z]{2}\d/.test(oid)) continue;
          
          const qty = parseQty(gv(ws, R.q, c));
          const d = String(day).padStart(2, '0');
          const mo = String(month).padStart(2, '0');
          
          orders.push({
            factory,
            order_id: oid,
            order_id_norm: stripSuffix(oid),
            style_code: gv(ws, R.s, c),
            shoe_name: gv(ws, R.n, c),
            qty,
            delivery_date: gv(ws, R.x, c),
            new_old: gv(ws, R.t, c),
            line_up_day: day,
            month,
            year,
            line_up_date: new Date(year, month - 1, day),
            line_up_str: `${d}/${mo}/${year}`
          });
        }
      }
    }
    
    setProdOrders(orders);
    addLog('prod', `✅ Xử lý thành công! Nhận ${orders.length} đơn sản xuất từ ${sheetsOk} sheets.`);
    saveData(orders, matLines, matLines2);
  };

  // ── PARSE 2: MATERIAL TRACKING ──────────────────────────
  const parseMaterialTracking = (wb: XLSX.WorkBook, fname: string, slot: 'mat' | 'mat2') => {
    const lines: MaterialLine[] = [];
    let sheetsOk = 0;
    const ACCEPTED = ['outlet', 'mainline', 'cutup'];
    
    for (const shName of wb.SheetNames) {
      if (!ACCEPTED.includes(shName.toLowerCase().trim())) {
        addLog(slot, `⬜ Bỏ qua sheet: ${shName}`);
        continue;
      }
      const ws = wb.Sheets[shName];
      if (!ws || !ws['!ref']) continue;
      
      addLog(slot, `📄 Đang xử lý: ${shName}...`);
      sheetsOk++;
      
      let dataStartRow = 4;
      for (let ri = 3; ri <= 8; ri++) {
        const cell = ws[XLSX.utils.encode_cell({ r: ri, c: 1 })];
        if (cell && /^V[A-Z]{2}\d/.test(String(cell.v || ''))) {
          dataStartRow = ri;
          break;
        }
      }
      
      const testCell5 = ws[XLSX.utils.encode_cell({ r: dataStartRow, c: 5 })];
      const testVal5 = testCell5 ? String(testCell5.v || '').trim() : '';
      const isVersion03 = testVal5.length > 5 && !testVal5.startsWith('=') && testVal5.includes('/');
      
      const C = {
        ORDER_NO: 1,
        MODEL_NO: 2,
        COLOR_NO: 3,
        MAT_NO: 4,
        MAT_NAME: isVersion03 ? 5 : 6,
        UNIT: isVersion03 ? 6 : 7,
        PURCHASE_QTY: isVersion03 ? 9 : 10,
        STOCK_IN_QTY: isVersion03 ? 14 : 15,
        LACKING_QTY: isVersion03 ? 15 : 16,
        PO_NO: isVersion03 ? 18 : 19,
        PART_CN: isVersion03 ? 19 : 20,
        PART_VN: isVersion03 ? 20 : 21,
        CLASS_NO: isVersion03 ? 27 : 28,
        SUPPLIER_NO: isVersion03 ? 32 : 33,
        SUPPLIER: isVersion03 ? 33 : 34,
        ETD1: isVersion03 ? 34 : 35,
        ETA1: isVersion03 ? 35 : 36,
        ETD2: isVersion03 ? 36 : -1,
        ETA2: isVersion03 ? 37 : -1,
        ETD3: isVersion03 ? 38 : -1,
        ETA3: isVersion03 ? 39 : -1,
        IMPORT_QTY: isVersion03 ? 50 : (shName.toUpperCase() === 'CUTUP' ? 44 : 50),
        INV_NO: isVersion03 ? 53 : -1,
        ACTUAL_IMPORT: isVersion03 ? 54 : -1,
      };
      
      const range = XLSX.utils.decode_range(ws['!ref']);
      const nrows = range.e.r + 1;
      
      const getVal = (r: number, c: number): any => {
        if (c < 0) return null;
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        return cell ? cell.v : null;
      };
      const strVal = (r: number, c: number, fallback = ''): string => {
        const val = getVal(r, c);
        return val !== null && val !== undefined ? String(val).trim() : fallback;
      };
      
      for (let r = dataStartRow; r < nrows; r++) {
        const oNo = strVal(r, C.ORDER_NO);
        if (!oNo || !/^V[A-Z]{2}\d/.test(oNo)) continue;
        
        const matNo = strVal(r, C.MAT_NO);
        const matName = strVal(r, C.MAT_NAME);
        const purchaseQty = parseNum(getVal(r, C.PURCHASE_QTY));
        
        // Handle dates (supporting multiple ETD/ETA columns)
        let latestEtd: Date | null = null;
        let latestEta: Date | null = null;
        
        const etds = [C.ETD1, C.ETD2, C.ETD3].filter(c => c >= 0).map(c => fixDate(getVal(r, c))).filter(Boolean);
        const etas = [C.ETA1, C.ETA2, C.ETA3].filter(c => c >= 0).map(c => fixDate(getVal(r, c))).filter(Boolean);
        
        if (etds.length) {
          latestEtd = new Date(etds[etds.length - 1]);
        }
        if (etas.length) {
          latestEta = new Date(etas[etas.length - 1]);
        }
        
        const shipped = parseNum(getVal(r, C.IMPORT_QTY));
        const stockIn = parseNum(getVal(r, C.STOCK_IN_QTY));
        const effectiveStockIn = shipped > 0 ? shipped : stockIn;
        const parsed = parseERPMatName(matName, matNo);
        
        // Class code based material type detection fallback
        const classCode = strVal(r, C.CLASS_NO);
        let matType = parsed.matType || 'UNKNOWN';
        if (matType === 'UNKNOWN' && classCode) {
          if (/^APU/i.test(classCode)) matType = 'PU';
          else if (/^APV/i.test(classCode)) matType = 'PVC';
          else if (/^ABL|^ATX|^ATH/i.test(classCode)) matType = 'FABRIC';
          else if (/^ANP|^AYP|^ACP/i.test(classCode)) matType = 'LEATHER';
        }
        
        lines.push({
          order_no: oNo,
          model_no: strVal(r, C.MODEL_NO),
          color_no: strVal(r, C.COLOR_NO),
          mat_no: matNo,
          mat_name: matName,
          mat_type: matType,
          mat_cn: parsed.matCN || matName,
          mat_en: parsed.matEN || '',
          color_cn: parsed.colorCN || '',
          color_en: parsed.colorEN || '',
          thickness: parsed.thickness || '',
          width: parsed.width || '',
          size_range: parsed.sizeRange || '',
          color_str: [parsed.colorCN, parsed.colorEN].filter(Boolean).join(' / '),
          unit: parsed.unit || strVal(r, C.UNIT, 'SF'),
          purchase_qty: purchaseQty,
          stock_in_qty: effectiveStockIn,
          lacking_qty: effectiveStockIn - purchaseQty,
          po_no: strVal(r, C.PO_NO),
          part_cn: strVal(r, C.PART_CN),
          part_vn: strVal(r, C.PART_VN),
          supplier: strVal(r, C.SUPPLIER),
          supplier_no: strVal(r, C.SUPPLIER_NO),
          etd: latestEtd,
          eta: latestEta,
          stock_in_date: latestEta,
          inv_no: strVal(r, C.INV_NO),
          actual_import_qty: (C.ACTUAL_IMPORT >= 0 && parseNum(getVal(r, C.ACTUAL_IMPORT)) > 0)
            ? parseNum(getVal(r, C.ACTUAL_IMPORT))
            : effectiveStockIn,
          sheet: shName
        });
      }
    }
    
    if (slot === 'mat') {
      setMatLines(lines);
      saveData(prodOrders, lines, matLines2);
    } else {
      setMatLines2(lines);
      saveData(prodOrders, matLines, lines);
    }
    
    addLog(slot, `✅ Xử lý thành công! Nhận ${lines.length} dòng vật tư từ ${sheetsOk} sheets.`);
  };

  // ── YEAR EDITOR ───────────────────────────────────────────
  const years = useMemo(() => {
    return [...new Set(prodOrders.map(o => o.year))].sort();
  }, [prodOrders]);

  const factories = useMemo(() => {
    return [...new Set(prodOrders.map(o => o.factory))].sort();
  }, [prodOrders]);

  const applyYearEdit = () => {
    setYeResult({ text: '', color: '' });
    const fromY = parseInt(yeFrom);
    const toY = parseInt(yeTo);
    
    if (!fromY) {
      setYeResult({ text: '⚠ Chọn năm gốc', color: 'var(--red)' });
      return;
    }
    if (!toY || toY < 2020 || toY > 2035) {
      setYeResult({ text: '⚠ Nhập năm hợp lệ (2020-2035)', color: 'var(--red)' });
      return;
    }
    if (fromY === toY) {
      setYeResult({ text: '⚠ Năm gốc giống năm mới', color: 'var(--amber)' });
      return;
    }
    
    let count = 0;
    const updated = prodOrders.map(o => {
      let match = false;
      if (yeScope === 'all') match = o.year === fromY;
      else if (yeScope.startsWith('fac:')) match = o.year === fromY && o.factory === yeScope.slice(4);
      else if (yeScope.startsWith('month:')) match = o.year === fromY; // simpler month grouping
      
      if (match) {
        count++;
        const newD = String(o.line_up_day).padStart(2, '0');
        const newMo = String(o.month).padStart(2, '0');
        return {
          ...o,
          year: toY,
          line_up_date: new Date(toY, o.month - 1, o.line_up_day),
          line_up_str: `${newD}/${newMo}/${toY}`
        };
      }
      return o;
    });
    
    if (count === 0) {
      setYeResult({ text: `Không tìm thấy đơn năm ${fromY}`, color: 'var(--amber)' });
      return;
    }
    
    setProdOrders(updated);
    saveData(updated, matLines, matLines2);
    setYeResult({ text: `✅ Đã sửa năm ${count} đơn`, color: 'var(--green)' });
  };

  const isReadyToAnalyze = prodOrders.length > 0 && (matLines.length > 0 || matLines2.length > 0);

  return (
    <div className="page active" id="pg-schedule">
      <div className="topbar">
        <div className="pg-title">📅 Lịch Lên Chuyền &amp; Vật Tư</div>
        <div>
          <button
            className="btn btn-p btn-sm"
            disabled={!isReadyToAnalyze}
            onClick={buildCoordination}
          >
            ⚙ Kết hợp &amp; Phân tích tiến độ →
          </button>
        </div>
      </div>
      
      <div className="import-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        {/* Card 1: Production Schedule */}
        <div className="import-card">
          <div className="ic-head">
            <div className="ic-icon" style={{ backgroundColor: 'rgba(0,212,170,.2)' }}>📅</div>
            <div>
              <div className="ic-title">File 1 — Lịch lên chuyền (排期表)</div>
              <div className="ic-sub">TIẾN ĐỘ SẢN XUẤT — sheet 底部排期</div>
            </div>
          </div>
          <div className="ic-body">
            <div
              className={`drop-zone ${dragActive.prod ? 'drag' : ''} ${prodOrders.length > 0 ? 'dz-loaded' : ''}`}
              onDragOver={e => handleDrag(e, 'prod', true)}
              onDragLeave={e => handleDrag(e, 'prod', false)}
              onDrop={e => handleDrop(e, 'prod')}
            >
              <input type="file" accept=".xlsx,.xls" onChange={e => handleFileChange(e, 'prod')} />
              <span className="dz-icon">📂</span>
              <div className="dz-title">Kéo thả hoặc click</div>
              <div className="dz-sub">排期表 .xlsx — Tất cả sheet nhà máy</div>
            </div>
            <div className="status-row">
              <div className={`dot-status ${prodOrders.length > 0 ? 'ok' : 'err'}`}></div>
              <span>
                {prodOrders.length > 0 ? `${prodOrders.length} đơn hàng đã nạp` : 'Chưa import lịch lên chuyền'}
              </span>
            </div>
            <div className="log-box">
              {logs.prod.map((l, i) => (
                <div key={i} className={`log-line ${l.includes('✅') ? 'ok' : l.includes('❌') ? 'err' : ''}`}>{l}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 2: Leather Material Tracking */}
        <div className="import-card">
          <div className="ic-head">
            <div className="ic-icon" style={{ backgroundColor: 'rgba(74,158,255,.2)' }}>🐄</div>
            <div>
              <div className="ic-title">File 2 — Material Tracking Da</div>
              <div className="ic-sub">LEATHER — Outlet / Mainline (ANP/AYP)</div>
            </div>
          </div>
          <div className="ic-body">
            <div
              className={`drop-zone ${dragActive.mat ? 'drag' : ''} ${matLines.length > 0 ? 'dz-loaded' : ''}`}
              onDragOver={e => handleDrag(e, 'mat', true)}
              onDragLeave={e => handleDrag(e, 'mat', false)}
              onDrop={e => handleDrop(e, 'mat')}
            >
              <input type="file" accept=".xlsx,.xls" onChange={e => handleFileChange(e, 'mat')} />
              <span className="dz-icon">📂</span>
              <div className="dz-title">Kéo thả hoặc click</div>
              <div className="dz-sub">GENERAL_MATERIAL_TRACKING_LEATHER.xlsx</div>
            </div>
            <div className="status-row">
              <div className={`dot-status ${matLines.length > 0 ? 'ok' : 'err'}`}></div>
              <span>
                {matLines.length > 0 ? `${matLines.length} dòng đã nạp` : 'Chưa import material da'}
              </span>
            </div>
            <div className="log-box">
              {logs.mat.map((l, i) => (
                <div key={i} className={`log-line ${l.includes('✅') ? 'ok' : l.includes('❌') ? 'err' : ''}`}>{l}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 3: PU/PVC/Fabric Material Tracking */}
        <div className="import-card">
          <div className="ic-head">
            <div className="ic-icon" style={{ backgroundColor: 'rgba(167,139,250,.2)' }}>🧵</div>
            <div>
              <div className="ic-title">File 3 — Material Tracking PU / PVC / Vải</div>
              <div className="ic-sub">Sheet OUTLET / CUTUP / MAINLINE</div>
            </div>
          </div>
          <div className="ic-body">
            <div
              className={`drop-zone ${dragActive.mat2 ? 'drag' : ''} ${matLines2.length > 0 ? 'dz-loaded' : ''}`}
              onDragOver={e => handleDrag(e, 'mat2', true)}
              onDragLeave={e => handleDrag(e, 'mat2', false)}
              onDrop={e => handleDrop(e, 'mat2')}
            >
              <input type="file" accept=".xlsx,.xls" onChange={e => handleFileChange(e, 'mat2')} />
              <span className="dz-icon">📂</span>
              <div className="dz-title">Kéo thả hoặc click</div>
              <div className="dz-sub">GENERAL_MATERIAL_TRACKING_PU_PVC_FABRIC.xlsx</div>
            </div>
            <div className="status-row">
              <div className={`dot-status ${matLines2.length > 0 ? 'ok' : 'err'}`}></div>
              <span>
                {matLines2.length > 0 ? `${matLines2.length} dòng đã nạp` : 'Chưa import material PU/PVC/Vải'}
              </span>
            </div>
            <div className="log-box">
              {logs.mat2.map((l, i) => (
                <div key={i} className={`log-line ${l.includes('✅') ? 'ok' : l.includes('❌') ? 'err' : ''}`}>{l}</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Year Editor */}
      {prodOrders.length > 0 && (
        <div id="year-editor" style={{
          background: 'var(--s1)',
          border: '1px solid var(--acc3)',
          borderRadius: '10px',
          padding: '14px 16px',
          marginBottom: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '14px' }}>✏️</span>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--acc3)' }}>Sửa năm lên chuyền</div>
              <div style={{ fontSize: '11px', color: 'var(--txt3)', marginTop: '2px' }}>
                Năm trong file chưa chắc đúng — kiểm tra và chỉnh trước khi kết nối phân tích
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '10px', color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Đổi năm</span>
                <select value={yeFrom} onChange={e => setYeFrom(e.target.value)} style={{ minWidth: '100px' }}>
                  <option value="">— Chọn —</option>
                  {years.map((y: number, idx: number) => (
                    <option key={idx} value={y}>{y} ({prodOrders.filter(o => o.year === y).length} đơn)</option>
                  ))}
                </select>
              </div>
              <span style={{ color: 'var(--acc3)', fontSize: '18px', fontWeight: 700, paddingTop: '16px' }}>→</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '10px', color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Thành năm</span>
                <input
                  type="number"
                  min="2020"
                  max="2035"
                  placeholder="VD: 2026"
                  value={yeTo}
                  onChange={e => setYeTo(e.target.value)}
                  style={{ width: '90px' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '10px', color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Phạm vi</span>
                <select value={yeScope} onChange={e => setYeScope(e.target.value)} style={{ minWidth: '130px' }}>
                  <option value="all">Tất cả đơn</option>
                  {factories.map((f: string, idx: number) => (
                    <option key={idx} value={`fac:${f}`}>{f}</option>
                  ))}
                  {years.map((y: number, idx: number) => (
                    <option key={idx} value={`month:${y}`}>Tháng trong năm {y}</option>
                  ))}
                </select>
              </div>
              <button
                className="btn"
                onClick={applyYearEdit}
                style={{
                  marginTop: '16px',
                  backgroundColor: 'var(--acc3)',
                  border: 'none',
                  borderRadius: '7px',
                  padding: '7px 16px',
                  fontFamily: 'var(--sans)',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#000',
                  cursor: 'pointer'
                }}
              >
                Áp dụng
              </button>
              {yeResult.text && (
                <span style={{ marginTop: '16px', fontSize: '12px', fontWeight: 600, color: yeResult.color }}>
                  {yeResult.text}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <button
        className="connect-btn"
        disabled={!isReadyToAnalyze}
        onClick={buildCoordination}
      >
        ⚙ Kết hợp &amp; Phân tích tiến độ
      </button>
    </div>
  );
};
