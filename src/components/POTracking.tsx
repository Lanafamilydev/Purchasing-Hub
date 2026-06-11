import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Download, Cloud, FileSpreadsheet, Plus, Settings, Check, Mail, Printer, Trash, Info } from 'lucide-react';
import { POData, Shipment, ShipmentLine, POLine, ImportRaw, ImportHist } from '../types';
import { fDate, getTodayString, parseNum, fixDate, detectMatType, parseERPMatName } from '../utils';
import { syncPODataToCloud, fetchPODataFromCloud } from '../supabase';

interface POTrackingProps {
  poData: POData[];
  setPoData: React.Dispatch<React.SetStateAction<POData[]>>;
  shpData: Shipment[];
  setShpData: React.Dispatch<React.SetStateAction<Shipment[]>>;
  saveData: (po: POData[], shp: Shipment[]) => void;
  triggerToast: (msg: string) => void;
}

const PO_FIELDS = [
  { key: 'no', label: 'PO No', req: true, hints: ['po no', 'po number', 'purchase order', 'po.'] },
  { key: 'date', label: 'PO Date', req: false, hints: ['po date', 'purchase date', 'order date', 'date'] },
  { key: 'deliveryDate', label: 'Delivery Date', req: false, hints: ['delivery date', 'required date', 'deliver', 'due date'] },
  { key: 'supplierNo', label: 'Supplier No', req: false, hints: ['supplier no', 'vendor no', 'supplier code', 'vendor code'] },
  { key: 'supplierName', label: 'Supplier Name', req: true, hints: ['supplier name', 'vendor name', 'supplier', 'vendor', 'ncc'] },
  { key: 'orderNo', label: 'Order No', req: false, hints: ['order no', 'order number', 'style no', 'season', '订单'] },
  { key: 'status', label: 'Status', req: false, hints: ['purchase status', 'status', '样品'] },
  { key: 'note', label: 'Note', req: false, hints: ['note', 'remark', 'purpose', '备注'] },
  { key: 'matNo', label: 'Mat No', req: false, hints: ['material no', 'mat no', 'material number', '物料'] },
  { key: 'matName', label: 'Material Name', req: false, hints: ['material name', 'material', '品名', 'desc'] },
  { key: 'colorEN', label: 'Color EN', req: false, hints: ['color en', 'color english', 'colour en'] },
  { key: 'colorCN', label: 'Color CN', req: false, hints: ['color cn', 'color chinese', '颜色'] },
  { key: 'poQty', label: 'PO Qty', req: true, hints: ['purchase qty', 'po qty', '数量', 'qty', 'quantity'] },
  { key: 'allowQty', label: 'Allowance', req: false, hints: ['allowance', 'allow', '余量'] },
  { key: 'unit', label: 'Unit', req: false, hints: ['unit', '单位'] },
  { key: 'unitPrice', label: 'Unit Price', req: false, hints: ['unit price', 'price', '单价'] },
  { key: 'amount', label: 'Amount', req: false, hints: ['amount', 'total', '金额'] }
];

const SHP_FIELDS = [
  { key: 'pono', label: 'PO No', req: true, hints: ['po no', 'purchase order', 'po number', 'po.'] },
  { key: 'invno', label: 'Invoice No', req: true, hints: ['invoice no', 'inv no', 'invoice number', 'invoice'] },
  { key: 'blno', label: 'B/L No', req: false, hints: ['b/l no', 'bl no', 'bill of lading'] },
  { key: 'carrier', label: 'Carrier', req: false, hints: ['carrier', 'vessel', 'ship'] },
  { key: 'etd', label: 'ETD', req: false, hints: ['etd', 'departure', 'estimated departure'] },
  { key: 'eta', label: 'ETA', req: false, hints: ['eta', 'arrival', 'estimated arrival'] },
  { key: 'status', label: 'Status', req: false, hints: ['status', 'shipment status'] },
  { key: 'material', label: 'Material', req: false, hints: ['material', 'material name', 'item'] },
  { key: 'color', label: 'Color', req: false, hints: ['color', 'colour', '颜色'] },
  { key: 'invQty', label: 'Invoice Qty', req: true, hints: ['qty', 'quantity', 'invoice qty', 'inv qty'] },
  { key: 'invUnit', label: 'Unit', req: false, hints: ['unit', '单位'] },
  { key: 'invPrice', label: 'Price', req: false, hints: ['price', 'unit price'] }
];

const MRP_FIELDS = [
  { key: 'orderNo', label: 'Order No', req: true, hints: ['order no', 'mo no', 'mk no', 'style', 'season'] },
  { key: 'matNo', label: 'Mat No', req: true, hints: ['mat no', 'material no', 'item code'] },
  { key: 'matName', label: 'Material Name', req: true, hints: ['material name', 'material', '品名'] },
  { key: 'colorCN', label: 'Color CN', req: false, hints: ['color cn', '颜色'] },
  { key: 'colorEN', label: 'Color EN', req: false, hints: ['color en'] },
  { key: 'purchaseQty', label: 'Purchase Qty', req: true, hints: ['purchase qty', 'qty', '数量'] },
  { key: 'poNo', label: 'PO No', req: false, hints: ['po no', 'purchase order'] },
  { key: 'supplierName', label: 'Supplier', req: false, hints: ['supplier', 'vendor', 'ncc'] },
  { key: 'deliveryDate', label: 'Delivery Date', req: false, hints: ['delivery', 'due date', 'etd'] },
];

export const POTracking: React.FC<POTrackingProps> = ({
  poData,
  setPoData,
  shpData,
  setShpData,
  saveData,
  triggerToast
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'list' | 'shp' | 'import' | 'report'>('overview');
  
  // Search & Filter
  const [dfSt, setDfSt] = useState('');
  const [dfSp, setDfSp] = useState('');
  const [shpQ, setShpQ] = useState('');
  const [shpFs, setShpFs] = useState('');
  const [shpFp, setShpFp] = useState('');
  const [poQ, setPoQ] = useState('');
  const [poFs, setPoFs] = useState('');
  const [poFp, setPoFp] = useState('');
  
  // Bulk selection
  const [selectedPOs, setSelectedPOs] = useState<Record<number, boolean>>({});
  const [selectedShps, setSelectedShps] = useState<Record<number, boolean>>({});
  
  // Modals state
  const [selectedPONo, setSelectedPONo] = useState('');
  const [detModalOpen, setDetModalOpen] = useState(false);
  const [poModalOpen, setPoModalOpen] = useState(false);
  const [editingPOIndex, setEditingPOIndex] = useState(-1);
  const [shpModalOpen, setShpModalOpen] = useState(false);
  const [editingShpIndex, setEditingShpIndex] = useState(-1);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [confModalOpen, setConfModalOpen] = useState(false);
  const [confAction, setConfAction] = useState<{ type: 'po' | 'shp'; idx: number; isBulk?: boolean } | null>(null);

  // Edit PO Form States
  const [pofNo, setPofNo] = useState('');
  const [pofDate, setPofDate] = useState('');
  const [pofDel, setPofDel] = useState('');
  const [pofSupNo, setPofSupNo] = useState('');
  const [pofSupName, setPofSupName] = useState('');
  const [pofOrderNo, setPofOrderNo] = useState('');
  const [pofModelNo, setPofModelNo] = useState('');
  const [pofStatus, setPofStatus] = useState('Sample (样品)');
  const [pofCreatedBy, setPofCreatedBy] = useState('');
  const [pofXeDate, setPofXeDate] = useState('');
  const [pofNote, setPofNote] = useState('');
  const [pofLines, setPofLines] = useState<POLine[]>([]);

  // Edit Shipment Form States
  const [shfPono, setShfPono] = useState('');
  const [shfInvNo, setShfInvNo] = useState('');
  const [shfBlNo, setShfBlNo] = useState('');
  const [shfCarrier, setShfCarrier] = useState('');
  const [shfEtd, setShfEtd] = useState('');
  const [shfEta, setShfEta] = useState('');
  const [shfPol, setShfPol] = useState('');
  const [shfPod, setShfPod] = useState('');
  const [shfFwd, setShfFwd] = useState('');
  const [shfStatus, setShfStatus] = useState('Pending');
  const [shfPic, setShfPic] = useState('');
  const [shfAcc, setShfAcc] = useState('');
  const [shfRemark, setShfRemark] = useState('');
  const [shfDocs, setShfDocs] = useState<string[]>(['Commercial Invoice']);
  const [shfLines, setShfLines] = useState<ShipmentLine[]>([]);
  const [showPoLinesPanel, setShowPoLinesPanel] = useState(false);
  const [selectedPoLinesToAdd, setSelectedPoLinesToAdd] = useState<Record<number, boolean>>({});
  const [selectedPoLinesQtys, setSelectedPoLinesQtys] = useState<Record<number, number>>({});

  // Email Notification States
  const [emTo, setEmTo] = useState('warehouse@properwell.com.vn; purchase@properwell.com.vn');
  const [emSubject, setEmSubject] = useState('');
  const [emMsg, setEmMsg] = useState('');

  // Column Mapper (Import) States
  const [showMapper, setShowMapper] = useState(false);
  const [importType, setImportType] = useState<'po' | 'shp' | 'mrp'>('po');
  const [rawImport, setRawImport] = useState<ImportRaw>({ headers: [], rows: [], fname: '' });
  const [colMappings, setColMappings] = useState<Record<string, number>>({});
  const [poImportHist, setPoImportHist] = useState<ImportHist[]>([]);
  const [poSheetSelOpen, setPoSheetSelOpen] = useState(false);
  const [sheetsList, setSheetsList] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [tempWorkBook, setTempWorkBook] = useState<XLSX.WorkBook | null>(null);

  // Reports tab states
  const [rptType, setRptType] = useState('full');
  const [rptSup, setRptSup] = useState('');
  const [rptSt, setRptSt] = useState('');
  const [rptGroup, setRptGroup] = useState('po');
  const [rptDate, setRptDate] = useState(getTodayString());
  const [rptBy, setRptBy] = useState('Purchase Dept');

  // Supabase operations
  const handleCloudSync = async () => {
    triggerToast('⏳ Đang đồng bộ dữ liệu PO lên Cloud...');
    const ok = await syncPODataToCloud(poData);
    if (ok) triggerToast('✅ Đồng bộ đám mây thành công!');
    else triggerToast('❌ Đồng bộ thất bại, vui lòng kiểm tra kết nối.');
  };

  const handleCloudFetch = async () => {
    triggerToast('⏳ Đang tải dữ liệu PO từ Cloud...');
    const data = await fetchPODataFromCloud();
    if (data) {
      setPoData(data);
      saveData(data, shpData);
      triggerToast(`✅ Đã tải ${data.length} POs mẫu từ Cloud!`);
    } else {
      triggerToast('❌ Không thể tải dữ liệu.');
    }
  };

  // PO & Shipment helpers
  const poTotalQty = (po: POData) => po.lines.reduce((a, l) => a + l.poQty, 0);
  const poTotalAmt = (po: POData) => po.lines.reduce((a, l) => a + l.amount, 0);
  const poTotalAllow = (po: POData) => po.lines.reduce((a, l) => a + l.allowanceQty, 0);
  const poStockIn = (po: POData) => po.lines.reduce((a, l) => a + (l.stockInQty || 0), 0);
  const shpByPO = (pono: string) => shpData.filter(s => s.pono === pono);
  const shpTotalQty = (s: Shipment) => s.invLines.reduce((a, l) => a + l.qty, 0);
  const shpTotalAmt = (s: Shipment) => s.invLines.reduce((a, l) => a + l.qty * (l.price || 0), 0);
  const poShipTotal = (pono: string) => shpByPO(pono).reduce((a, s) => a + shpTotalQty(s), 0);
  const latestETA = (pono: string) => {
    const ss = shpData.filter(s => s.pono === pono && s.eta);
    return ss.length ? ss.reduce((a, b) => (a.eta > b.eta ? a : b)).eta : null;
  };
  const latestETD = (pono: string) => {
    const ss = shpData.filter(s => s.pono === pono && s.etd);
    return ss.length ? ss.reduce((a, b) => (a.etd > b.etd ? a : b)).etd : null;
  };
  
  const poStatus = (po: POData) => {
    const ss = shpData.filter(s => s.pono === po.no);
    if (!ss.length) return po.status;
    if (ss.every(s => s.status === 'Delivered')) return 'Completed';
    if (ss.some(s => ['Arrived', 'Customs'].includes(s.status))) return 'Arrived';
    if (ss.some(s => s.status === 'In Transit')) return 'In Transit';
    return po.status;
  };

  const getDaysFromToday = (s: string) => {
    if (!s) return null;
    return Math.round((new Date(s).getTime() - new Date().getTime()) / 86400000);
  };

  // Unique lists for filtering
  const suppliersList = useMemo(() => {
    return [...new Set(poData.map(p => p.supplierName).filter(Boolean))].sort();
  }, [poData]);

  // Filtered lists
  const filteredPOOverview = useMemo(() => {
    return poData.filter(p => {
      if (dfSt && poStatus(p) !== dfSt) return false;
      if (dfSp && p.supplierName !== dfSp) return false;
      return true;
    });
  }, [poData, dfSt, dfSp, shpData]);

  const filteredPOList = useMemo(() => {
    return poData.filter(p => {
      if (poFs && poStatus(p) !== poFs) return false;
      if (poFp && p.supplierName !== poFp) return false;
      if (poQ) {
        const q = poQ.toLowerCase();
        return [
          p.no,
          p.supplierName,
          ...p.lines.map(l => l.matNo),
          ...p.lines.map(l => l.matEN),
          ...p.lines.map(l => l.colorEN)
        ].some(v => String(v || '').toLowerCase().includes(q));
      }
      return true;
    });
  }, [poData, poFs, poFp, poQ, shpData]);

  const filteredShps = useMemo(() => {
    return shpData.filter(s => {
      const po = poData.find(p => p.no === s.pono);
      if (shpFs && s.status !== shpFs) return false;
      if (shpFp && (!po || po.supplierName !== shpFp)) return false;
      if (shpQ) {
        const q = shpQ.toLowerCase();
        return [s.no, s.invno, s.pono, s.blno || '', po ? po.supplierName : ''].some(v =>
          String(v || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [shpData, shpFs, shpFp, shpQ, poData]);

  // Shipment lines from selection PO change
  const poLinesAlreadyShipped = (pono: string) => {
    const m: Record<string, number> = {};
    shpData.filter(s => s.pono === pono).forEach(s =>
      s.invLines.forEach(l => {
        if (l.matNo) m[l.matNo] = (m[l.matNo] || 0) + l.qty;
      })
    );
    return m;
  };

  const handlePOSelectAll = (checked: boolean) => {
    const sel: Record<number, boolean> = {};
    if (checked) {
      filteredPOList.forEach(p => {
        sel[poData.indexOf(p)] = true;
      });
    }
    setSelectedPOs(sel);
  };

  const handleShpSelectAll = (checked: boolean) => {
    const sel: Record<number, boolean> = {};
    if (checked) {
      filteredShps.forEach(s => {
        sel[shpData.indexOf(s)] = true;
      });
    }
    setSelectedShps(sel);
  };

  // Modals operations
  const openPOModal = (idx = -1) => {
    setEditingPOIndex(idx);
    if (idx >= 0 && poData[idx]) {
      const p = poData[idx];
      setPofNo(p.no);
      setPofDate(p.date);
      setPofDel(p.deliveryDate || '');
      setPofSupNo(p.supplierNo);
      setPofSupName(p.supplierName);
      setPofOrderNo(p.orderNo || '');
      setPofModelNo(p.modelNo || '');
      setPofStatus(p.status);
      setPofCreatedBy(p.createdBy || '');
      setPofXeDate(p.xeDate || '');
      setPofNote(p.note || '');
      setPofLines([...p.lines]);
    } else {
      setPofNo('');
      setPofDate(getTodayString());
      setPofDel('');
      setPofSupNo('');
      setPofSupName('');
      setPofOrderNo('');
      setPofModelNo('');
      setPofStatus('Sample (样品)');
      setPofCreatedBy('');
      setPofXeDate('');
      setPofNote('');
      setPofLines([{ matNo: '', matFull: '', thickness: '', matCN: '', matEN: '', colorCN: '', colorEN: '', sizeRange: '', specNotes: '', unit: 'SF', poQty: 0, allowanceQty: 0, amount: 0, currency: 'USD', stockInQty: 0 }]);
    }
    setPoModalOpen(true);
  };

  const addPOLineRow = () => {
    setPofLines(prev => [
      ...prev,
      { matNo: '', matFull: '', thickness: '', matCN: '', matEN: '', colorCN: '', colorEN: '', sizeRange: '', specNotes: '', unit: 'SF', poQty: 0, allowanceQty: 0, amount: 0, currency: 'USD', stockInQty: 0 }
    ]);
  };

  const removePOLineRow = (idx: number) => {
    setPofLines(prev => prev.filter((_, i) => i !== idx));
  };

  const savePO = () => {
    if (!pofNo || !pofSupName) {
      triggerToast('⚠ Vui lòng điền mã PO và Nhà cung cấp!');
      return;
    }
    const cleanLines = pofLines.filter(l => l.poQty > 0);
    if (!cleanLines.length) {
      triggerToast('⚠ PO phải có ít nhất 1 dòng vật liệu!');
      return;
    }
    const newPO: POData = {
      no: pofNo,
      date: pofDate,
      deliveryDate: pofDel,
      xeDate: pofXeDate,
      stockOutDate: '',
      stockInDate: '',
      deliveryNote: '',
      status: pofStatus,
      supplierNo: pofSupNo,
      supplierName: pofSupName,
      season: '',
      orderNo: pofOrderNo,
      modelNo: pofModelNo,
      note: pofNote,
      createdBy: pofCreatedBy,
      createDate: pofDate,
      verifiedBy: '',
      verifiedDate: '',
      approvedBy: '',
      approveDate: '',
      lines: cleanLines
    };

    const updated = [...poData];
    if (editingPOIndex >= 0) {
      updated[editingPOIndex] = newPO;
      triggerToast(`✓ Đã cập nhật PO ${pofNo}`);
    } else {
      updated.unshift(newPO);
      triggerToast(`✓ Đã tạo PO ${pofNo}`);
    }
    setPoData(updated);
    saveData(updated, shpData);
    setPoModalOpen(false);
  };

  const openShpModal = (idx = -1, defaultPono = '') => {
    setEditingShpIndex(idx);
    setShowPoLinesPanel(false);
    setSelectedPoLinesToAdd({});
    setSelectedPoLinesQtys({});
    
    if (idx >= 0 && shpData[idx]) {
      const s = shpData[idx];
      setShfPono(s.pono);
      setShfInvNo(s.invno);
      setShfBlNo(s.blno || '');
      setShfCarrier(s.carrier || '');
      setShfEtd(s.etd);
      setShfEta(s.eta);
      setShfPol(s.pol || '');
      setShfPod(s.pod || '');
      setShfFwd(s.fwd || '');
      setShfStatus(s.status);
      setShfPic(s.pic || '');
      setShfAcc(s.acc || '');
      setShfRemark(s.remark || '');
      setShfDocs(s.docs || []);
      setShfLines([...s.invLines]);
    } else {
      setShfPono(defaultPono || '');
      setShfInvNo('');
      setShfBlNo('');
      setShfCarrier('');
      setShfEtd('');
      setShfEta('');
      setShfPol('');
      setShfPod('');
      setShfFwd('');
      setShfStatus('Pending');
      setShfPic('');
      setShfAcc('');
      setShfRemark('');
      setShfDocs(['Commercial Invoice']);
      setShfLines([]);
    }
    setShpModalOpen(true);
  };

  const addShpLineRow = () => {
    setShfLines(prev => [
      ...prev,
      { matNo: '', material: '', color: '', qty: 0, unit: 'SF', price: 0 }
    ]);
  };

  const removeShpLineRow = (idx: number) => {
    setShfLines(prev => prev.filter((_, i) => i !== idx));
  };

  const saveShp = (notify = false) => {
    if (!shfPono || !shfInvNo || !shfEtd || !shfEta) {
      triggerToast('⚠ Vui lòng điền đủ các trường bắt buộc (*)!');
      return;
    }
    if (!shfLines.length) {
      triggerToast('⚠ Lô hàng phải có ít nhất 1 dòng Invoice!');
      return;
    }
    const newShp: Shipment = {
      no: editingShpIndex >= 0 ? shpData[editingShpIndex].no : `SHP-${String(shpData.length + 1).padStart(3, '0')}`,
      pono: shfPono,
      invno: shfInvNo,
      blno: shfBlNo,
      carrier: shfCarrier,
      etd: shfEtd,
      eta: shfEta,
      pol: shfPol,
      pod: shfPod,
      fwd: shfFwd,
      status: shfStatus,
      invLines: shfLines,
      docs: shfDocs,
      pic: shfPic,
      acc: shfAcc,
      remark: shfRemark,
      notified: notify
    };

    const updated = [...shpData];
    if (editingShpIndex >= 0) {
      updated[editingShpIndex] = newShp;
      triggerToast('✓ Đã cập nhật Shipment');
    } else {
      updated.unshift(newShp);
      triggerToast(notify ? '✓ Đã tạo lô hàng và gửi thông báo 📢' : '✓ Đã tạo Shipment');
    }
    setShpData(updated);
    saveData(poData, updated);
    setShpModalOpen(false);
    
    if (notify) {
      handleNotify(newShp);
    }
  };

  const handleNotify = (s: Shipment) => {
    const po = poData.find(p => p.no === s.pono);
    const linesStr = s.invLines.map(l => `  - ${l.material}/${l.color}: ${l.qty.toLocaleString()} ${l.unit}`).join('\n');
    const msg = `SHIPMENT ARRIVAL NOTIFICATION\nPO: ${s.pono}\nSupplier: ${po ? po.supplierName : '—'}\nInvoice: ${s.invno}\nB/L: ${s.blno || '—'}\nETA: ${fDate(s.eta)}\n\n${linesStr}\n\nDocs: ${s.docs.join(', ')}\nRemark: ${s.remark || '—'}`;
    
    setEmSubject(`SHIPMENT ARRIVAL: PO ${s.pono} · Invoice ${s.invno}`);
    setEmMsg(msg);
    setEmailModalOpen(true);
  };

  const copyEmailText = () => {
    navigator.clipboard.writeText(emMsg).then(() => triggerToast('✓ Đã copy Text vào Clipboard!'));
  };

  const copyEmailHtml = () => {
    // Basic styled HTML table representation of the shipment
    const po = poData.find(p => p.no === shfPono);
    const html = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; border: 1px solid #ddd; padding: 15px; border-radius: 8px;">
        <h3 style="color: #0b1220; border-bottom: 2px solid #00d4aa; padding-bottom: 8px;">Shipment Arrival Notification</h3>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px;">
          <tr><td style="font-weight: bold; width: 120px;">PO No:</td><td>${shfPono}</td></tr>
          <tr><td style="font-weight: bold;">Supplier:</td><td>${po ? po.supplierName : '—'}</td></tr>
          <tr><td style="font-weight: bold;">Invoice No:</td><td>${shfInvNo}</td></tr>
          <tr><td style="font-weight: bold;">ETA Date:</td><td>${fDate(shfEta)}</td></tr>
          <tr><td style="font-weight: bold;">Carrier:</td><td>${shfCarrier || '—'}</td></tr>
          <tr><td style="font-weight: bold;">Docs:</td><td>${shfDocs.join(', ')}</td></tr>
        </table>
        <h4 style="margin-top: 15px; border-bottom: 1px solid #ddd; padding-bottom: 4px;">Items list</h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 5px;">
          <tr style="background: #f4f4f4;">
            <th style="border: 1px solid #ddd; padding: 6px;">Material</th>
            <th style="border: 1px solid #ddd; padding: 6px;">Color</th>
            <th style="border: 1px solid #ddd; padding: 6px; text-align: right;">Qty</th>
            <th style="border: 1px solid #ddd; padding: 6px; text-align: center;">Unit</th>
          </tr>
          ${shfLines.map(l => `
            <tr>
              <td style="border: 1px solid #ddd; padding: 6px;">${l.material}</td>
              <td style="border: 1px solid #ddd; padding: 6px;">${l.color}</td>
              <td style="border: 1px solid #ddd; padding: 6px; text-align: right;">${l.qty.toLocaleString()}</td>
              <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${l.unit}</td>
            </tr>
          `).join('')}
        </table>
        ${shfRemark ? `<p style="font-size: 11px; color: #666; margin-top: 15px;"><strong>Remark:</strong> ${shfRemark}</p>` : ''}
      </div>
    `;
    const blob = new Blob([html], { type: 'text/html' });
    const data = [new ClipboardItem({ 'text/html': blob })];
    navigator.clipboard.write(data).then(() => triggerToast('✓ Đã copy HTML thành công!'));
  };

  const handleOpenMailClient = () => {
    const sub = encodeURIComponent(emSubject);
    const body = encodeURIComponent(emMsg + '\n\n(Please paste HTML table here if needed)');
    window.open(`mailto:${emTo}?subject=${sub}&body=${body}`);
  };

  // Delete confirmations
  const confirmDelete = (type: 'po' | 'shp', idx: number, isBulk = false) => {
    setConfAction({ type, idx, isBulk });
    setConfModalOpen(true);
  };

  const executeDelete = () => {
    if (!confAction) return;
    const { type, idx, isBulk } = confAction;
    
    if (isBulk) {
      if (type === 'po') {
        const sorted = Object.keys(selectedPOs).map(Number).sort((a, b) => b - a);
        const updated = [...poData];
        sorted.forEach(i => updated.splice(i, 1));
        setPoData(updated);
        saveData(updated, shpData);
        setSelectedPOs({});
      } else {
        const sorted = Object.keys(selectedShps).map(Number).sort((a, b) => b - a);
        const updated = [...shpData];
        sorted.forEach(i => updated.splice(i, 1));
        setShpData(updated);
        saveData(poData, updated);
        setSelectedShps({});
      }
    } else {
      if (type === 'po') {
        const updated = [...poData];
        updated.splice(idx, 1);
        setPoData(updated);
        saveData(updated, shpData);
      } else {
        const updated = [...shpData];
        updated.splice(idx, 1);
        setShpData(updated);
        saveData(poData, updated);
      }
    }
    setConfModalOpen(false);
    triggerToast('✓ Đã xóa dữ liệu thành công.');
  };

  // Select PO lines to add to shipment
  const handleShfPOChange = (pono: string) => {
    setShfPono(pono);
    const po = poData.find(p => p.no === pono);
    if (!po) return;
    
    const alrMap = poLinesAlreadyShipped(pono);
    const checks: Record<number, boolean> = {};
    const qtys: Record<number, number> = {};
    
    po.lines.forEach((l, i) => {
      const alr = alrMap[l.matNo] || 0;
      const lineRem = Math.max(0, l.poQty - alr);
      checks[i] = lineRem > 0;
      qtys[i] = lineRem;
    });
    
    setSelectedPoLinesToAdd(checks);
    setSelectedPoLinesQtys(qtys);
    setShowPoLinesPanel(true);
  };

  const applySelectedPoLinesToShipment = () => {
    const po = poData.find(p => p.no === shfPono);
    if (!po) return;
    
    const alrMap = poLinesAlreadyShipped(shfPono);
    const newLines = [...shfLines];
    
    Object.entries(selectedPoLinesToAdd).forEach(([idxStr, checked]) => {
      if (!checked) return;
      const i = parseInt(idxStr);
      const l = po.lines[i];
      if (!l) return;
      
      const qty = selectedPoLinesQtys[i] || 0;
      const up = l.amount && l.poQty ? l.amount / l.poQty : 0;
      const exists = newLines.some(sl => sl.matNo === l.matNo);
      
      if (!exists) {
        newLines.push({
          matNo: l.matNo,
          material: l.matEN || l.matCN,
          color: l.colorEN || l.colorCN,
          qty,
          unit: l.unit,
          price: up
        });
      }
    });
    
    setShfLines(newLines);
    setShowPoLinesPanel(false);
    triggerToast('✓ Đã tải các dòng từ PO vào Invoice!');
  };

  // ERP Column Mapping Import logic
  const handlePoFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true, dateNF: 'yyyy-mm-dd' });
      setTempWorkBook(wb);
      setSheetsList(wb.SheetNames);
      
      const defaultSheet = wb.SheetNames[0];
      setSelectedSheet(defaultSheet);
      setRawImport(prev => ({ ...prev, fname: file.name }));

      // If workbook has only one sheet, bypass sheet selection modal
      if (wb.SheetNames.length === 1) {
        const ws = wb.Sheets[defaultSheet];
        const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'yyyy-mm-dd', defval: '' });
        
        if (data.length === 0) {
          triggerToast('⚠ Sheet này rỗng!');
          return;
        }
        
        const headers = data[0].map(h => String(h || '').trim());
        const rows = data.slice(1);
        
        setRawImport({ headers, rows, fname: file.name });
        
        // Auto mappings
        const mappings: Record<string, number> = {};
        const fields = importType === 'po' ? PO_FIELDS : importType === 'shp' ? SHP_FIELDS : MRP_FIELDS;
        
        fields.forEach(f => {
          const foundIdx = headers.findIndex(h =>
            f.hints.some(hint => h.toLowerCase().includes(hint))
          );
          if (foundIdx !== -1) {
            mappings[f.key] = foundIdx;
          }
        });
        
        setColMappings(mappings);
        setShowMapper(true);
        setPoSheetSelOpen(false);
      } else {
        setPoSheetSelOpen(true);
      }
    } catch (err: any) {
      triggerToast(`❌ Lỗi đọc file: ${err.message}`);
    }
  };

  const loadExcelSheetData = () => {
    if (!tempWorkBook || !selectedSheet) return;
    const ws = tempWorkBook.Sheets[selectedSheet];
    const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'yyyy-mm-dd', defval: '' });
    
    if (data.length === 0) {
      triggerToast('⚠ Sheet này rỗng!');
      return;
    }
    
    const headers = data[0].map(h => String(h || '').trim());
    const rows = data.slice(1);
    
    setRawImport({ headers, rows, fname: rawImport.fname });
    setPoSheetSelOpen(false);
    
    // Auto mappings
    const mappings: Record<string, number> = {};
    const fields = importType === 'po' ? PO_FIELDS : importType === 'shp' ? SHP_FIELDS : MRP_FIELDS;
    
    fields.forEach(f => {
      const foundIdx = headers.findIndex(h =>
        f.hints.some(hint => h.toLowerCase().includes(hint))
      );
      if (foundIdx !== -1) {
        mappings[f.key] = foundIdx;
      }
    });
    
    setColMappings(mappings);
    setShowMapper(true);
  };

  const doImport = () => {
    const fields = importType === 'po' ? PO_FIELDS : importType === 'shp' ? SHP_FIELDS : MRP_FIELDS;
    const reqFields = fields.filter(f => f.req);
    const missing = reqFields.filter(f => colMappings[f.key] === undefined);
    
    if (missing.length > 0) {
      triggerToast(`⚠ Điền ánh xạ các cột bắt buộc: ${missing.map(f => f.label).join(', ')}`);
      return;
    }

    const todayStr = getTodayString();
    let newCount = 0;
    let updCount = 0;
    
    if (importType === 'po') {
      const posMap: Record<string, POData> = {};
      poData.forEach(p => { posMap[p.no] = p; });

      rawImport.rows.forEach(row => {
        const getV = (key: string, fb = ''): string => {
          const idx = colMappings[key];
          return idx !== undefined && row[idx] !== undefined ? String(row[idx]).trim() : fb;
        };
        const getN = (key: string, fb = 0): number => {
          const idx = colMappings[key];
          return idx !== undefined && row[idx] !== undefined ? parseNum(row[idx]) : fb;
        };

        const pono = getV('no');
        if (!pono) return;

        if (!posMap[pono]) {
          newCount++;
          posMap[pono] = {
            no: pono,
            date: fixDate(getV('date', todayStr)),
            deliveryDate: fixDate(getV('deliveryDate')),
            xeDate: fixDate(getV('xeDate')),
            stockOutDate: '',
            stockInDate: '',
            deliveryNote: '',
            status: getV('status', 'Sample (样品)'),
            supplierNo: getV('supplierNo'),
            supplierName: getV('supplierName'),
            season: '',
            orderNo: getV('orderNo'),
            modelNo: getV('modelNo'),
            note: getV('note'),
            createdBy: getV('createdBy', 'Importer'),
            createDate: todayStr,
            verifiedBy: '',
            verifiedDate: '',
            approvedBy: '',
            approveDate: '',
            lines: []
          };
        } else {
          updCount++;
        }

        const po = posMap[pono];
        const qty = getN('poQty');
        const price = getN('unitPrice');
        const matNo = getV('matNo');
        const matName = getV('matName');
        const colorEN = getV('colorEN');
        const colorCN = getV('colorCN');
        const unit = getV('unit', 'SF');
        
        // Add line if matNo is unique in this PO lines, otherwise update the existing line
        if (matNo) {
          const existingLineIdx = po.lines.findIndex(l => l.matNo === matNo);
          const parsed = parseERPMatName(matName, matNo);
          const lineData = {
            matNo,
            matFull: matName,
            thickness: parsed.thickness || getV('thickness'),
            matCN: parsed.matCN || matName,
            matEN: parsed.matEN || matName,
            colorCN: parsed.colorCN || colorCN,
            colorEN: parsed.colorEN || colorEN,
            sizeRange: parsed.sizeRange || getV('sizeRange'),
            specNotes: '',
            unit,
            poQty: qty,
            allowanceQty: getN('allowQty'),
            amount: getN('amount', qty * price),
            currency: 'USD',
            stockInQty: existingLineIdx >= 0 ? po.lines[existingLineIdx].stockInQty : 0
          };
          if (existingLineIdx >= 0) {
            po.lines[existingLineIdx] = lineData;
          } else {
            po.lines.push(lineData);
          }
        }
      });

      const updated = Object.values(posMap);
      setPoData(updated);
      saveData(updated, shpData);
      
    } else if (importType === 'shp') {
      const shpsMap: Record<string, Shipment> = {};
      shpData.forEach(s => { shpsMap[`${s.pono}||${s.invno}`] = s; });

      rawImport.rows.forEach(row => {
        const getV = (key: string, fb = ''): string => {
          const idx = colMappings[key];
          return idx !== undefined && row[idx] !== undefined ? String(row[idx]).trim() : fb;
        };
        const getN = (key: string, fb = 0): number => {
          const idx = colMappings[key];
          return idx !== undefined && row[idx] !== undefined ? parseNum(row[idx]) : fb;
        };

        const pono = getV('pono');
        const invno = getV('invno');
        if (!pono || !invno) return;

        const key = `${pono}||${invno}`;
        if (!shpsMap[key]) {
          newCount++;
          shpsMap[key] = {
            no: `SHP-${String(Object.keys(shpsMap).length + 1).padStart(3, '0')}`,
            pono,
            invno,
            blno: getV('blno'),
            carrier: getV('carrier'),
            etd: fixDate(getV('etd')),
            eta: fixDate(getV('eta')),
            pol: '',
            pod: '',
            fwd: '',
            status: getV('status', 'Pending'),
            invLines: [],
            docs: ['Commercial Invoice'],
            pic: '',
            acc: '',
            remark: '',
            notified: false
          };
        } else {
          updCount++;
        }

        const shp = shpsMap[key];
        const matNo = getV('matNo');
        const matName = getV('material');
        const color = getV('color');
        const qty = getN('invQty');
        const unit = getV('invUnit', 'SF');
        const price = getN('invPrice');

        if (qty > 0) {
          shp.invLines.push({
            matNo,
            material: matName,
            color,
            qty,
            unit,
            price
          });
        }
      });

      const updated = Object.values(shpsMap);
      setShpData(updated);
      saveData(poData, updated);
    } else if (importType === 'mrp') {
      // MRP Import: create PO entries from material requirements
      const posMap: Record<string, POData> = {};
      poData.forEach(p => { posMap[p.no] = p; });

      rawImport.rows.forEach(row => {
        const getV = (key: string, fb = ''): string => {
          const idx = colMappings[key];
          return idx !== undefined && row[idx] !== undefined ? String(row[idx]).trim() : fb;
        };
        const getN = (key: string, fb = 0): number => {
          const idx = colMappings[key];
          return idx !== undefined && row[idx] !== undefined ? parseNum(row[idx]) : fb;
        };

        const poNoVal = getV('poNo');
        const matNo = getV('matNo');
        const matName = getV('matName');
        const qty = getN('purchaseQty');
        if (!matNo || qty <= 0) return;

        const pono = poNoVal || `MRP-${getV('orderNo', 'UNKNOWN')}`;

        if (!posMap[pono]) {
          newCount++;
          posMap[pono] = {
            no: pono,
            date: todayStr,
            deliveryDate: fixDate(getV('deliveryDate')),
            xeDate: '', stockOutDate: '', stockInDate: '', deliveryNote: '',
            status: 'Open', supplierNo: '',
            supplierName: getV('supplierName', 'MRP Import'),
            season: '', orderNo: getV('orderNo'), modelNo: '',
            note: 'Imported from MRP',
            createdBy: 'MRP Importer', createDate: todayStr,
            verifiedBy: '', verifiedDate: '', approvedBy: '', approveDate: '',
            lines: []
          };
        } else {
          updCount++;
        }

        const po = posMap[pono];
        const parsed = parseERPMatName(matName, matNo);
        if (matNo) {
          const existingLineIdx = po.lines.findIndex(l => l.matNo === matNo);
          const lineData = {
            matNo, matFull: matName,
            thickness: parsed.thickness || '',
            matCN: parsed.matCN || matName,
            matEN: parsed.matEN || matName,
            colorCN: parsed.colorCN || getV('colorCN'),
            colorEN: parsed.colorEN || getV('colorEN'),
            sizeRange: parsed.sizeRange || '', specNotes: 'MRP Import',
            unit: parsed.unit || 'SF',
            poQty: qty, allowanceQty: 0, amount: 0, currency: 'USD',
            stockInQty: existingLineIdx >= 0 ? po.lines[existingLineIdx].stockInQty : 0
          };
          if (existingLineIdx >= 0) {
            po.lines[existingLineIdx] = lineData;
          } else {
            po.lines.push(lineData);
          }
        }
      });

      const mrpUpdated = Object.values(posMap);
      setPoData(mrpUpdated);
      saveData(mrpUpdated, shpData);
    }

    setPoImportHist(prev => [
      {
        type: importType === 'po' ? 'PO Import' : importType === 'shp' ? 'Shp Import' : 'MRP Import',
        new: newCount,
        upd: updCount,
        time: new Date().toLocaleTimeString(),
        file: rawImport.fname
      },
      ...prev
    ]);

    setShowMapper(false);
    triggerToast(`✓ Import thành công! Tạo mới ${newCount}, cập nhật ${updCount}.`);
  };

  // Report printing & Generation
  const buildReportView = useMemo(() => {
    const filtered = poData.filter(p => {
      if (rptSup && p.supplierName !== rptSup) return false;
      if (rptSt && poStatus(p) !== rptSt) return false;
      if (rptType === 'pending') return poStatus(p) !== 'Completed';
      if (rptType === 'overdue') {
        const d = getDaysFromToday(p.deliveryDate || '');
        return d !== null && d < 0 && poStatus(p) !== 'Completed';
      }
      return true;
    });

    const totPO = filtered.length;
    const totQ = filtered.reduce((a, p) => a + poTotalQty(p), 0);
    const totAmt = filtered.reduce((a, p) => a + poTotalAmt(p), 0);
    const totShipped = filtered.reduce((a, p) => a + poShipTotal(p.no), 0);
    
    // Grouping
    const groups: Record<string, POData[]> = {};
    if (rptGroup === 'supplier') {
      filtered.forEach(p => {
        const k = p.supplierName;
        if (!groups[k]) groups[k] = [];
        groups[k].push(p);
      });
    } else if (rptGroup === 'status') {
      filtered.forEach(p => {
        const k = poStatus(p);
        if (!groups[k]) groups[k] = [];
        groups[k].push(p);
      });
    } else {
      filtered.forEach(p => {
        groups[p.no] = [p];
      });
    }

    return {
      totPO,
      totQ,
      totAmt,
      totShipped,
      groups,
      filtered
    };
  }, [poData, rptType, rptSup, rptSt, rptGroup, shpData]);

  const handlePrint = () => {
    window.print();
  };

  // ── EXPORT PO CSV ─────────────────────────────────────
  const exportPOCSV = () => {
    const headers = ['PO No','PO Date','Delivery Date','Supplier No','Supplier','Order No','Lines','PO Qty','Allowance','Amount USD','Shipments','Stock In','Status','Note'];
    const rows = poData.map(p => [
      p.no, fDate(p.date), fDate(p.deliveryDate), p.supplierNo, p.supplierName, p.orderNo || '',
      p.lines.length, poTotalQty(p), poTotalAllow(p), poTotalAmt(p).toFixed(2),
      shpByPO(p.no).length, poStockIn(p), poStatus(p), `"${(p.note || '').replace(/"/g, '""')}"`
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `PO_Tracking_${getTodayString()}.csv`;
    a.click();
    triggerToast('✓ Đã xuất file PO CSV');
  };

  // ── EXPORT REPORT CSV ─────────────────────────────────
  const exportReportCSV = () => {
    const filtered = buildReportView.filtered;
    const headers = ['PO No','Supplier','Order No','PO Date','Delivery','Status','Note','Line#','Mat No','Material EN','Color EN','Color CN','Thickness','PO Qty','Allowance','Unit','Price','Amount','Shipped','Remaining','Line Status'];
    const rows: string[] = [];
    filtered.forEach(po => {
      const shpMap: Record<string, number> = {};
      shpData.filter(s => s.pono === po.no).forEach(s =>
        s.invLines.forEach(l => { if (l.matNo) shpMap[l.matNo] = (shpMap[l.matNo] || 0) + l.qty; })
      );
      po.lines.forEach((l, li) => {
        const shipped = shpMap[l.matNo] || 0;
        const rem = Math.max(0, l.poQty - shipped);
        const lSt = shipped >= l.poQty ? 'Completed' : shipped > 0 ? 'Partial' : 'Pending';
        const up = l.amount && l.poQty ? (l.amount / l.poQty) : 0;
        rows.push([
          po.no, po.supplierName, po.orderNo || '', fDate(po.date), fDate(po.deliveryDate), poStatus(po),
          `"${(po.note || '').replace(/"/g, '""')}"`, li + 1, l.matNo, `"${l.matEN || ''}"`, l.colorEN || '', l.colorCN || '',
          l.thickness || '', l.poQty, l.allowanceQty, l.unit, up ? up.toFixed(2) : '', l.amount.toFixed(2),
          shipped, rem, lSt
        ].join(','));
      });
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `PO_Report_${getTodayString()}.csv`;
    a.click();
    triggerToast('✓ Đã xuất Report CSV');
  };

  // ── DOWNLOAD TEMPLATES ────────────────────────────────
  const downloadTemplate = (type: 'po' | 'shp') => {
    if (type === 'po') {
      const h = ['PO No','PO Date','Delivery Date','Supplier No','Supplier Name','Order No','Status','Note','Mat No','Material Name','Color EN','Color CN','PO Qty','Allowance','Unit','Unit Price','Amount'];
      const csv = [h.join(','), 'VNPP26030001,2026-03-01,2026-03-15,A087,PRIME,TEC1,Sample (样品),FOR TB,ANP07230001,"1.1-1.3MM 荔枝纹牛皮/LAVAZAA",W27-13,咖啡色,20,1,SF,3.19,'].join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv' })); a.download = 'Template_PO_Import.csv'; a.click();
    } else {
      const h = ['PO No','Invoice No','B/L No','Carrier','ETD','ETA','Status','Material Name','Color','Invoice Qty','Unit','Unit Price'];
      const csv = [h.join(','), 'VNPP26030001,INV-2026-001,BL123456,Maersk,2026-03-05,2026-03-12,In Transit,LAVAZAA,W27-13,20,SF,3.19'].join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv' })); a.download = 'Template_Shipment_Import.csv'; a.click();
    }
    triggerToast(`✓ Đã tải template ${type === 'po' ? 'PO' : 'Shipment'}`);
  };

  // ── OPEN EMAIL REPORT ─────────────────────────────────
  const openEmailReport = () => {
    const typeLabel: Record<string, string> = { full: 'Full PO Status', pending: 'Outstanding POs', overdue: 'Overdue Delivery', 'by-supplier': 'Report by Supplier', shipment: 'Shipment Tracking' };
    setEmSubject(`${typeLabel[rptType] || 'PO Report'} - PPW F26 Material Management - ${getTodayString()}`);
    setEmTo('warehouse@properwell.com.vn; purchase@properwell.com.vn');
    setEmMsg(`Hi Team,\n\nPlease find the ${(typeLabel[rptType] || 'PO report').toLowerCase()} attached below for your reference.\n\nBest Regards,\nPurchase Department`);
    setEmailModalOpen(true);
  };

  // ── AUTO MAP COLUMNS ──────────────────────────────────
  const autoMapCols = () => {
    const fields = importType === 'po' ? PO_FIELDS : importType === 'shp' ? SHP_FIELDS : MRP_FIELDS;
    const mappings: Record<string, number> = {};
    fields.forEach(f => {
      const foundIdx = rawImport.headers.findIndex(h =>
        f.hints.some(hint => h.toLowerCase().includes(hint))
      );
      if (foundIdx !== -1) mappings[f.key] = foundIdx;
    });
    setColMappings(mappings);
    triggerToast(`⚡ Đã tự động ánh xạ ${Object.keys(mappings).length} cột`);
  };

  return (
    <div className="page active" id="pg-po">
      <div className="topbar">
        <div className="pg-title">📦 PO Tracking — Hàng Mẫu</div>
        <div style={{ display: 'flex', gap: '7px' }}>
          <button className="btn btn-g btn-sm" onClick={exportPOCSV}><Download size={14} /> CSV</button>
          <button className="btn btn-g btn-sm" onClick={handleCloudFetch}><Cloud size={14} /> Tải từ Cloud</button>
          <button className="btn btn-g btn-sm" onClick={handleCloudSync}><Cloud size={14} /> Đồng bộ Cloud</button>
          <button className="btn btn-p btn-sm" onClick={() => openPOModal()}><Plus size={14} /> Thêm PO Mới</button>
        </div>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--brd)', marginBottom: '14px' }}>
        {(['overview', 'list', 'shp', 'import', 'report'] as const).map(tab => (
          <div
            key={tab}
            className={`po-stab ${activeSubTab === tab ? 'active' : ''}`}
            onClick={() => setActiveSubTab(tab)}
            style={{ textTransform: 'capitalize' }}
          >
            {tab === 'shp' ? 'Shipments' : tab === 'report' ? 'Báo cáo' : tab}
          </div>
        ))}
      </div>

      {/* SUB-TAB: OVERVIEW */}
      {activeSubTab === 'overview' && (
        <div>
          {/* Dashboard Metrics */}
          <div className="po-kpi" id="po-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '9px', marginBottom: '14px' }}>
            <div className="kc c-acc">
              <div className="k-lb">Tổng PO mẫu</div>
              <div className="k-v">{poData.length}</div>
              <div className="k-s">{poData.reduce((sum, p) => sum + p.lines.length, 0)} dòng vật tư</div>
            </div>
            <div className="kc c-acc2">
              <div className="k-lb">Tổng Số Lượng</div>
              <div className="k-v c-acc2">{poData.reduce((sum, p) => sum + poTotalQty(p), 0).toLocaleString()}</div>
              <div className="k-s">Đơn vị: SF</div>
            </div>
            <div className="kc c-violet">
              <div className="k-lb">Trị giá PO (USD)</div>
              <div className="k-v c-violet" style={{ fontSize: '15px', fontWeight: 'bold' }}>
                ${poData.reduce((sum, p) => sum + poTotalAmt(p), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="kc c-red">
              <div className="k-lb">PO Quá hạn giao</div>
              <div className="k-v c-red">
                {poData.filter(p => {
                  const days = getDaysFromToday(p.deliveryDate);
                  return days !== null && days < 0 && poStatus(p) !== 'Completed';
                }).length}
              </div>
            </div>
            <div className="kc c-amber">
              <div className="k-lb">Cần thông báo PIC</div>
              <div className="k-v c-amber">
                {shpData.filter(s => !s.notified && ['In Transit', 'Arrived'].includes(s.status)).length}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
            <select value={dfSt} onChange={e => setDfSt(e.target.value)}>
              <option value="">Lọc trạng thái (Tất cả)</option>
              <option>Sample (样品)</option>
              <option>Open</option>
              <option>In Transit</option>
              <option>Arrived</option>
              <option>Completed</option>
            </select>
            <select value={dfSp} onChange={e => setDfSp(e.target.value)}>
              <option value="">Lọc Nhà cung cấp (Tất cả)</option>
              {suppliersList.map((s, idx) => (
                <option key={idx} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="card">
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>Mã PO</th>
                    <th>Nhà cung cấp</th>
                    <th>Số dòng</th>
                    <th>Tên vật tư</th>
                    <th>Ngày lập</th>
                    <th>Hạn giao</th>
                    <th>Mã Đơn hàng</th>
                    <th>Số lượng</th>
                    <th>Dung sai</th>
                    <th>Trị giá</th>
                    <th>Lô hàng</th>
                    <th>Đã nhập</th>
                    <th>Trạng thái</th>
                    <th>Ghi chú</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPOOverview.map((p, idx) => {
                    const status = poStatus(p);
                    const days = getDaysFromToday(p.deliveryDate);
                    const dlCell = days !== null && days < 0 && status !== 'Completed' ? (
                      <span className="bdg b-risk">{fDate(p.deliveryDate)}</span>
                    ) : (
                      <span className="bdg b-gray">{fDate(p.deliveryDate)}</span>
                    );
                    const mats = [...new Set(p.lines.map(l => l.matEN || l.matCN))];
                    const si = poStockIn(p);
                    const tot = poTotalQty(p);

                    return (
                      <tr key={idx} onClick={() => { setSelectedPONo(p.no); setDetModalOpen(true); }} style={{ cursor: 'pointer' }}>
                        <td className="mono" style={{ fontSize: '10px', fontWeight: 600, color: 'var(--acc)' }}>{p.no}</td>
                        <td style={{ fontSize: '11px' }}>{p.supplierName}</td>
                        <td><span className="bdg b-gray">{p.lines.length}</span></td>
                        <td style={{ maxWidth: '160px' }}>
                          <div style={{ fontSize: '10px' }}>
                            {mats.slice(0, 2).join(', ')}{mats.length > 2 ? ` +${mats.length - 2}` : ''}
                          </div>
                        </td>
                        <td style={{ fontSize: '10px' }}>{fDate(p.date)}</td>
                        <td>{dlCell}</td>
                        <td className="mono" style={{ fontSize: '10px' }}>{p.orderNo || '—'}</td>
                        <td className="mono" style={{ fontSize: '10px' }}>{tot.toLocaleString()}</td>
                        <td className="mono" style={{ fontSize: '10px', color: 'var(--txt3)' }}>+{poTotalAllow(p).toLocaleString()}</td>
                        <td className="mono" style={{ fontSize: '10px' }}>${poTotalAmt(p).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td><span className="bdg b-gray">{shpByPO(p.no).length}</span></td>
                        <td className="mono" style={{ fontSize: '10px', color: si >= tot ? 'var(--green)' : 'var(--txt3)' }}>{si.toLocaleString()}</td>
                        <td>
                          <span className={`bdg ${status === 'Completed' || status === 'Delivered' ? 'b-ok' : status === 'In Transit' ? 'b-blue' : status === 'Arrived' ? 'b-teal' : 'b-gray'}`}>
                            {status}
                          </span>
                        </td>
                        <td style={{ fontSize: '10px', color: 'var(--txt3)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.note || '—'}</td>
                        <td onClick={e => e.stopPropagation()}>
                          <div className="ac" style={{ display: 'flex', gap: '4px' }}>
                            <button className="btn btn-g btn-xs" onClick={() => openPOModal(poData.indexOf(p))}>✏</button>
                            <button className="btn btn-d btn-xs" onClick={() => confirmDelete('po', poData.indexOf(p))}>✕</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB: PO LIST */}
      {activeSubTab === 'list' && (
        <div>
          <div className="fbar">
            <span className="fl">Tìm kiếm</span>
            <div className="sw">
              <input
                type="text"
                placeholder="PO#, mã vật tư, nhà cung cấp..."
                value={poQ}
                onChange={e => setPoQ(e.target.value)}
              />
            </div>
            <select value={poFs} onChange={e => setPoFs(e.target.value)}>
              <option value="">Tất cả trạng thái</option>
              <option>Sample (样品)</option>
              <option>Open</option>
              <option>In Transit</option>
              <option>Arrived</option>
              <option>Completed</option>
            </select>
            <select value={poFp} onChange={e => setPoFp(e.target.value)}>
              <option value="">Tất cả NCC</option>
              {suppliersList.map((s, idx) => (
                <option key={idx} value={s}>{s}</option>
              ))}
            </select>
            <span style={{ fontSize: '11px', color: 'var(--txt3)' }}>
              Tìm thấy {filteredPOList.length} PO
            </span>
          </div>

          {Object.keys(selectedPOs).length > 0 && (
            <div className="bulk-bar" style={{ display: 'flex', marginBottom: '12px' }}>
              <span>Đã chọn {Object.keys(selectedPOs).length} POs</span>
              <button className="btn btn-d btn-xs" onClick={() => confirmDelete('po', -1, true)}>Xóa các PO đã chọn</button>
              <button className="btn btn-g btn-xs" onClick={() => setSelectedPOs({})}>Hủy</button>
            </div>
          )}

          <div className="card">
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th className="sel-col">
                      <input
                        type="checkbox"
                        checked={filteredPOList.length > 0 && Object.keys(selectedPOs).length === filteredPOList.length}
                        onChange={e => handlePOSelectAll(e.target.checked)}
                      />
                    </th>
                    <th>Mã PO</th>
                    <th>Nhà cung cấp</th>
                    <th>Số dòng</th>
                    <th>Chi tiết Vật liệu / Màu sắc</th>
                    <th>Ngày lập</th>
                    <th>Hạn giao</th>
                    <th>Số lượng</th>
                    <th>Đã nhập</th>
                    <th>Tiến độ</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPOList.map((p, idx) => {
                    const realIdx = poData.indexOf(p);
                    const tot = poTotalQty(p);
                    const si = poStockIn(p);
                    const pct = tot > 0 ? (si / tot) * 100 : 0;
                    const mats = [...new Set(p.lines.map(l => l.matEN || l.matCN))];
                    
                    return (
                      <tr key={idx} onClick={() => { setSelectedPONo(p.no); setDetModalOpen(true); }} style={{ cursor: 'pointer' }}>
                        <td className="sel-col" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={!!selectedPOs[realIdx]}
                            onChange={e => {
                              const n = { ...selectedPOs };
                              if (e.target.checked) n[realIdx] = true;
                              else delete n[realIdx];
                              setSelectedPOs(n);
                            }}
                          />
                        </td>
                        <td className="mono" style={{ fontSize: '10px', fontWeight: 600, color: 'var(--acc)' }}>{p.no}</td>
                        <td style={{ fontSize: '11px' }}>{p.supplierName} <span className="mono" style={{ fontSize: '9px', color: 'var(--txt3)' }}>{p.supplierNo}</span></td>
                        <td><span className="bdg b-gray">{p.lines.length}</span></td>
                        <td style={{ maxWidth: '190px' }}>
                          <div style={{ fontSize: '11px', fontWeight: 600 }}>{mats.slice(0, 2).join(', ')}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', marginTop: '3px' }}>
                            {[...new Set(p.lines.map(l => l.colorEN))].slice(0, 4).map((c, cIdx) => (
                              <span key={cIdx} className="bdg b-gray" style={{ fontSize: '9px' }}>{c}</span>
                            ))}
                          </div>
                        </td>
                        <td style={{ fontSize: '10px' }}>{fDate(p.date)}</td>
                        <td style={{ fontSize: '10px' }}>{fDate(p.deliveryDate)}</td>
                        <td className="mono" style={{ fontSize: '10px' }}>{tot.toLocaleString()} SF</td>
                        <td className="mono" style={{ fontSize: '10px', color: si >= tot ? 'var(--green)' : 'var(--txt3)' }}>{si.toLocaleString()}</td>
                        <td>
                          <div style={{ minWidth: '70px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <div className="pbg" style={{ flex: 1 }}>
                              <div className={`pf ${pct >= 100 ? 'pf-ok' : 'pf-w'}`} style={{ width: `${Math.min(100, pct)}%` }}></div>
                            </div>
                            <span className="pct">{pct.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td>
                          <span className={`bdg ${poStatus(p) === 'Completed' ? 'b-ok' : 'b-gray'}`}>
                            {poStatus(p)}
                          </span>
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <div className="ac" style={{ display: 'flex', gap: '4px' }}>
                            <button className="btn btn-g btn-xs" onClick={() => openPOModal(realIdx)}>✏</button>
                            <button className="btn btn-d btn-xs" onClick={() => confirmDelete('po', realIdx)}>✕</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB: SHIPMENTS */}
      {activeSubTab === 'shp' && (
        <div>
          <div className="fbar">
            <span className="fl">Tìm kiếm</span>
            <div className="sw">
              <input
                type="text"
                placeholder="Invoice, B/L, PO..."
                value={shpQ}
                onChange={e => setShpQ(e.target.value)}
              />
            </div>
            <select value={shpFs} onChange={e => setShpFs(e.target.value)}>
              <option value="">Tất cả trạng thái</option>
              <option>Pending</option>
              <option>In Transit</option>
              <option>Arrived</option>
              <option>Customs</option>
              <option>Delivered</option>
            </select>
            <select value={shpFp} onChange={e => setShpFp(e.target.value)}>
              <option value="">Tất cả NCC</option>
              {suppliersList.map((s, idx) => (
                <option key={idx} value={s}>{s}</option>
              ))}
            </select>
            <button className="btn btn-p btn-sm" onClick={() => openShpModal()}>+ Lô hàng Mới</button>
          </div>

          {Object.keys(selectedShps).length > 0 && (
            <div className="bulk-bar" style={{ display: 'flex', marginBottom: '12px' }}>
              <span>Đã chọn {Object.keys(selectedShps).length} Lô hàng</span>
              <button className="btn btn-d btn-xs" onClick={() => confirmDelete('shp', -1, true)}>Xóa các lô hàng đã chọn</button>
              <button className="btn btn-g btn-xs" onClick={() => setSelectedShps({})}>Hủy</button>
            </div>
          )}

          <div className="card">
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th className="sel-col">
                      <input
                        type="checkbox"
                        checked={filteredShps.length > 0 && Object.keys(selectedShps).length === filteredShps.length}
                        onChange={e => handleShpSelectAll(e.target.checked)}
                      />
                    </th>
                    <th>Mã Lô</th>
                    <th>Mã PO</th>
                    <th>Nhà cung cấp</th>
                    <th>Số Invoice</th>
                    <th>Số B/L</th>
                    <th>Hãng vận chuyển</th>
                    <th>Số dòng</th>
                    <th>Tổng số lượng</th>
                    <th>ETD</th>
                    <th>ETA</th>
                    <th>Trạng thái</th>
                    <th>Gửi PIC</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredShps.map((s, idx) => {
                    const realIdx = shpData.indexOf(s);
                    const po = poData.find(p => p.no === s.pono);
                    const tot = shpTotalQty(s);
                    
                    return (
                      <tr key={idx}>
                        <td className="sel-col">
                          <input
                            type="checkbox"
                            checked={!!selectedShps[realIdx]}
                            onChange={e => {
                              const n = { ...selectedShps };
                              if (e.target.checked) n[realIdx] = true;
                              else delete n[realIdx];
                              setSelectedShps(n);
                            }}
                          />
                        </td>
                        <td className="mono" style={{ fontSize: '10px', fontWeight: 600 }}>{s.no}</td>
                        <td className="mono" style={{ fontSize: '10px', color: 'var(--acc)' }}>{s.pono}</td>
                        <td style={{ fontSize: '11px' }}>{po ? po.supplierName : '—'}</td>
                        <td className="mono" style={{ fontSize: '10px', fontWeight: 600 }}>{s.invno}</td>
                        <td className="mono" style={{ fontSize: '10px' }}>{s.blno || '—'}</td>
                        <td style={{ fontSize: '10px' }}>{s.carrier || '—'}</td>
                        <td><span className="bdg b-gray">{(s.invLines || []).length}</span></td>
                        <td className="mono" style={{ fontSize: '10px' }}>{tot.toLocaleString()} SF</td>
                        <td>
                          <span className={`bdg ${getDaysFromToday(s.etd) !== null && getDaysFromToday(s.etd)! < 0 ? 'b-risk' : 'b-gray'}`}>
                            {fDate(s.etd)}
                          </span>
                        </td>
                        <td>
                          <span className={`bdg ${getDaysFromToday(s.eta) !== null && getDaysFromToday(s.eta)! < 0 ? 'b-risk' : 'b-gray'}`}>
                            {fDate(s.eta)}
                          </span>
                        </td>
                        <td>
                          <span className={`bdg ${s.status === 'Delivered' ? 'b-ok' : s.status === 'In Transit' ? 'b-blue' : 'b-gray'}`}>
                            {s.status}
                          </span>
                        </td>
                        <td>
                          {s.notified ? (
                            <span className="badge b-ok">✓ Đã gửi</span>
                          ) : (
                            <button className="btn btn-tl btn-xs" onClick={() => handleNotify(s)}>Gửi báo 📢</button>
                          )}
                        </td>
                        <td>
                          <div className="ac" style={{ display: 'flex', gap: '4px' }}>
                            <button className="btn btn-g btn-xs" onClick={() => openShpModal(realIdx)}>✏</button>
                            <button className="btn btn-d btn-xs" onClick={() => confirmDelete('shp', realIdx)}>✕</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB: IMPORT */}
      {activeSubTab === 'import' && (
        <div>
          <div className="import-grid" style={{ gridTemplateColumns: '1fr' }}>
            <div className="import-card">
              <div className="ic-head">
                <div className="ic-icon" style={{ backgroundColor: 'rgba(0,212,170,.15)' }}>📥</div>
                <div>
                  <div className="ic-title">Import dữ liệu PO và Lô hàng</div>
                  <div className="ic-sub">Hỗ trợ định dạng file Excel (.xlsx, .xls) và CSV.</div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select value={importType} onChange={e => setImportType(e.target.value as 'po' | 'shp' | 'mrp')}>
                    <option value="po">Kiểu: Import PO mẫu</option>
                    <option value="shp">Kiểu: Import Lô hàng</option>
                    <option value="mrp">Kiểu: Import MRP</option>
                  </select>
                  <button className="btn btn-g btn-xs" onClick={() => downloadTemplate('po')} title="Tải template PO"><Download size={12} /> Template PO</button>
                  <button className="btn btn-g btn-xs" onClick={() => downloadTemplate('shp')} title="Tải template Shipment"><Download size={12} /> Template Shp</button>
                </div>
              </div>
              <div className="ic-body">
                <div className="drop-zone" style={{ borderStyle: 'dashed' }}>
                  <input type="file" accept=".xlsx,.xls,.csv,.txt" onChange={handlePoFileImport} />
                  <span className="dz-icon" style={{ fontSize: '26px' }}>📂</span>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--txt2)' }}>Kéo thả hoặc click để chọn file import</div>
                  <div style={{ fontSize: '11px', color: 'var(--txt3)', marginTop: '3px' }}>.xlsx · .xls · .csv · .txt</div>
                </div>
              </div>
            </div>
          </div>

          {/* PO Sheet Selection Modal */}
          {poSheetSelOpen && (
            <div className="mb open">
              <div className="modal" style={{ width: '400px' }}>
                <div className="mh">
                  <div className="mt">Chọn Sheet Excel</div>
                  <button className="mx" onClick={() => setPoSheetSelOpen(false)}>✕</button>
                </div>
                <div className="mbody">
                  <div className="fld">
                    <label>Tên Sheet</label>
                    <select value={selectedSheet} onChange={e => setSelectedSheet(e.target.value)}>
                      {sheetsList.map((s, idx) => (
                        <option key={idx} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mfoot">
                  <button className="btn btn-g" onClick={() => setPoSheetSelOpen(false)}>Hủy</button>
                  <button className="btn btn-p" onClick={loadExcelSheetData}>Đọc dữ liệu →</button>
                </div>
              </div>
            </div>
          )}

          {/* Mapper Configuration Layout */}
          {showMapper && (
            <div className="import-card" style={{ padding: '14px 16px', marginTop: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700 }}>Ánh xạ cột</div>
                  <div style={{ fontSize: '11px', color: 'var(--txt3)' }}>
                    File: {rawImport.fname} {selectedSheet ? `[${selectedSheet}]` : ''} · {rawImport.headers.length} cols · {rawImport.rows.length} rows
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span className="badge b-blue" style={{ fontSize: '11px', padding: '4px 8px' }}>
                    Chế độ: {importType === 'po' ? 'Import PO' : importType === 'shp' ? 'Import Shipment' : 'Import MRP'}
                  </span>
                  <button className="btn btn-g btn-xs" onClick={autoMapCols}>⚡ Auto Map</button>
                </div>
              </div>

              {/* Raw Data Preview */}
              {rawImport.rows.length > 0 && (
                <div style={{ marginBottom: '12px', border: '1px solid var(--brd)', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, padding: '5px 10px', background: 'var(--s3)', color: 'var(--txt3)' }}>Xem trước dữ liệu gốc (5 dòng đầu)</div>
                  <div className="tw" style={{ maxHeight: '160px' }}>
                    <table style={{ fontSize: '10px' }}>
                      <thead>
                        <tr>
                          {rawImport.headers.map((h, i) => <th key={i} style={{ whiteSpace: 'nowrap', padding: '3px 6px' }}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {rawImport.rows.slice(0, 5).map((row, rIdx) => (
                          <tr key={rIdx}>
                            {rawImport.headers.map((_, cIdx) => <td key={cIdx} style={{ padding: '3px 6px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row[cIdx] != null ? String(row[cIdx]) : ''}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              <div id="col-map-grid" className="fg4" style={{ marginBottom: '12px' }}>
                {(importType === 'po' ? PO_FIELDS : importType === 'shp' ? SHP_FIELDS : MRP_FIELDS).map(f => {
                  const sampleVal = colMappings[f.key] !== undefined
                    ? (() => {
                        const idx = colMappings[f.key];
                        const vals = rawImport.rows.slice(0, 3).map(r => r[idx] || '').filter(Boolean).slice(0, 2);
                        return vals.length ? `e.g. ${vals.join(', ')}` : '(empty)';
                      })()
                    : '(empty)';
                  return (
                    <div key={f.key} className="fld" style={{ background: 'var(--s2)', border: '1px solid var(--brd)', borderRadius: '8px', padding: '8px 10px' }}>
                      <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--txt)', marginBottom: '4px', textTransform: 'none', letterSpacing: 'normal', display: 'block' }}>
                        {f.label}{f.req && <span className="req" style={{ color: 'var(--acc)', marginLeft: '3px' }}>*</span>}
                      </label>
                      <select
                        value={colMappings[f.key] !== undefined ? colMappings[f.key] : ''}
                        onChange={e => {
                          const val = e.target.value;
                          setColMappings(prev => {
                            const next = { ...prev };
                            if (val === '') {
                              delete (next as any)[f.key];
                            } else {
                              next[f.key] = parseInt(val);
                            }
                            return next;
                          });
                        }}
                        style={{ fontSize: '11px', width: '100%', background: 'var(--s2)', border: '1px solid var(--brd2)', borderRadius: '7px', color: '#fff', padding: '5px 8px', outline: 'none' }}
                      >
                        <option value="">— Bỏ qua / Không ánh xạ —</option>
                        {rawImport.headers.map((h, hIdx) => (
                          <option key={hIdx} value={hIdx}>Cột: {h}</option>
                        ))}
                      </select>
                      <div style={{ fontSize: '9px', color: 'var(--txt3)', fontFamily: 'var(--mono)', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minHeight: '12px' }}>
                        {sampleVal}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: '7px', alignItems: 'center' }}>
                <button className="btn btn-p" onClick={doImport}>✓ Xác nhận Import</button>
                <button className="btn btn-g" onClick={() => setShowMapper(false)}>Hủy bỏ</button>
              </div>
            </div>
          )}

          {/* Import history */}
          <div style={{ marginTop: '16px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--txt2)', marginBottom: '7px' }}>Lịch sử import</div>
            <div className="log-box" style={{ maxHeight: '180px' }}>
              {poImportHist.length ? poImportHist.map((h, idx) => (
                <div key={idx} style={{ padding: '5px 0', borderBottom: '1px solid var(--brd)', fontSize: '11px' }}>
                  <span className="badge b-teal">{h.type}</span> &nbsp;
                  <span>Tạo mới: <strong>{h.new}</strong>, Cập nhật: <strong>{h.upd}</strong></span> &nbsp;·&nbsp;
                  <span style={{ color: 'var(--txt3)' }}>File: {h.file} ({h.time})</span>
                </div>
              )) : (
                <div style={{ color: 'var(--txt3)', fontSize: '11px' }}>Chưa có phiên làm việc nào.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB: REPORTS */}
      {activeSubTab === 'report' && (
        <div>
          <div className="import-card" style={{ padding: '14px 16px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '165px' }}>
                <label style={{ fontSize: '10px', color: 'var(--txt2)', fontWeight: 600 }}>Loại báo cáo</label>
                <select value={rptType} onChange={e => setRptType(e.target.value)}>
                  <option value="full">Báo cáo PO đầy đủ (Full Status)</option>
                  <option value="pending">PO chưa hoàn thành (Outstanding)</option>
                  <option value="overdue">PO bị quá hạn giao (Overdue)</option>
                  <option value="by-supplier">Theo Nhà cung cấp (By Supplier)</option>
                  <option value="shipment">Chi tiết Lô hàng (Shipment Tracking)</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '135px' }}>
                <label style={{ fontSize: '10px', color: 'var(--txt2)', fontWeight: 600 }}>Lọc NCC</label>
                <select value={rptSup} onChange={e => setRptSup(e.target.value)}>
                  <option value="">Tất cả</option>
                  {suppliersList.map((s, idx) => (
                    <option key={idx} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '120px' }}>
                <label style={{ fontSize: '10px', color: 'var(--txt2)', fontWeight: 600 }}>Lọc trạng thái</label>
                <select value={rptSt} onChange={e => setRptSt(e.target.value)}>
                  <option value="">Tất cả</option>
                  <option>Sample (样品)</option>
                  <option>Open</option>
                  <option>In Transit</option>
                  <option>Arrived</option>
                  <option>Completed</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <label style={{ fontSize: '10px', color: 'var(--txt2)', fontWeight: 600 }}>Nhóm theo</label>
                <select value={rptGroup} onChange={e => setRptGroup(e.target.value)}>
                  <option value="po">Số PO</option>
                  <option value="supplier">Tên NCC</option>
                  <option value="status">Trạng thái</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <label style={{ fontSize: '10px', color: 'var(--txt2)', fontWeight: 600 }}>Ngày báo cáo</label>
                <input type="date" value={rptDate} onChange={e => setRptDate(e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <label style={{ fontSize: '10px', color: 'var(--txt2)', fontWeight: 600 }}>Người lập</label>
                <input type="text" value={rptBy} onChange={e => setRptBy(e.target.value)} style={{ width: '120px' }} />
              </div>
              <button className="btn btn-p btn-sm" onClick={handlePrint}><Printer size={14} /> In Báo cáo</button>
              <button className="btn btn-g btn-sm" onClick={exportReportCSV}><Download size={14} /> CSV</button>
              <button className="btn btn-g btn-sm" onClick={openEmailReport}><Mail size={14} /> Email</button>
            </div>
          </div>

          {/* Printable Report Output */}
          <div className="rpt-wrap" id="rpt-printable">
            <div className="rpt-hdr">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div className="rpt-title" style={{ fontSize: '18px', color: 'var(--acc)' }}>Báo cáo Quản lý PO mẫu &amp; Vận chuyển</div>
                  <div className="rpt-meta">Ngày lập: {rptDate} · Người lập: {rptBy}</div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '10px', color: 'var(--txt3)' }}>
                  PURCHASING DEPARTMENT<br />PROPERWELL F26
                </div>
              </div>
            </div>
            
            <div className="rpt-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)' }}>
              <div className="rpt-kc">
                <div className="rpt-kl">Tổng số PO</div>
                <div className="rpt-kv">{buildReportView.totPO}</div>
              </div>
              <div className="rpt-kc">
                <div className="rpt-kl">Tổng lượng đặt (SF)</div>
                <div className="rpt-kv">{buildReportView.totQ.toLocaleString()}</div>
              </div>
              <div className="rpt-kc">
                <div className="rpt-kl">Tổng trị giá (USD)</div>
                <div className="rpt-kv">${buildReportView.totAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              </div>
              <div className="rpt-kc">
                <div className="rpt-kl">Đã giao vận chuyển</div>
                <div className="rpt-kv">{buildReportView.totShipped.toLocaleString()}</div>
              </div>
              <div className="rpt-kc">
                <div className="rpt-kl">Quá hạn</div>
                <div className="rpt-kv" style={{ color: 'var(--red)' }}>
                  {buildReportView.filtered.filter(p => {
                    const d = getDaysFromToday(p.deliveryDate);
                    return d !== null && d < 0 && poStatus(p) !== 'Completed';
                  }).length}
                </div>
              </div>
            </div>

            {rptType === 'shipment' ? (
              <div style={{ padding: '10px' }}>
                <div style={{ background: 'var(--s2)', padding: '8px 15px', borderTop: '2px solid var(--acc2)', fontWeight: 700, color: 'var(--acc2)' }}>Shipment Tracking Details</div>
                <table className="rt">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>PO No</th>
                      <th>Supplier</th>
                      <th>Carrier</th>
                      <th>Lines</th>
                      <th>Qty</th>
                      <th>ETD</th>
                      <th>ETA</th>
                      <th>Status</th>
                      <th>Notified</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shpData.filter(s => buildReportView.filtered.some(p => p.no === s.pono)).sort((a, b) => new Date(a.eta).getTime() - new Date(b.eta).getTime()).map((s, idx) => {
                      const po = poData.find(p => p.no === s.pono);
                      return (
                        <tr key={idx}>
                          <td className="mono">{s.invno}</td>
                          <td className="mono">{s.pono}</td>
                          <td>{po ? po.supplierName : '—'}</td>
                          <td>{s.carrier || '—'}</td>
                          <td className="mono">{s.invLines.length}</td>
                          <td className="mono">{shpTotalQty(s).toLocaleString()}</td>
                          <td className="mono">{fDate(s.etd)}</td>
                          <td className="mono">{fDate(s.eta)}</td>
                          <td>
                            <span className={`bdg ${s.status === 'Delivered' ? 'b-ok' : s.status === 'In Transit' ? 'b-blue' : 'b-gray'}`}>
                              {s.status}
                            </span>
                          </td>
                          <td>{s.notified ? '✓' : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div>
                {Object.entries(buildReportView.groups).map(([gKey, gPos], grpIdx) => (
                  <div key={grpIdx}>
                    <div style={{ background: 'var(--s2)', padding: '8px 15px', borderTop: '2px solid var(--acc)', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 700, color: 'var(--acc)' }}>{gKey}</span>
                      <span style={{ fontSize: '10px', color: 'var(--txt3)' }}>
                        {gPos.length} POs · $ {gPos.reduce((sum, p) => sum + poTotalAmt(p), 0).toLocaleString()}
                      </span>
                    </div>
                    <table className="rt">
                      <thead>
                        <tr>
                          <th>Mã PO</th>
                          <th>Nhà cung cấp</th>
                          <th>Tên vật tư</th>
                          <th>Số lượng</th>
                          <th>Hạn giao</th>
                          <th>Trạng thái</th>
                          <th>Đã nhập</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gPos.map((p, pIdx) => (
                          <tr key={pIdx}>
                            <td className="mono">{p.no}</td>
                            <td>{p.supplierName}</td>
                            <td>{p.lines.map(l => l.matEN || l.matCN).slice(0, 2).join(', ')}</td>
                            <td className="mono">{poTotalQty(p).toLocaleString()}</td>
                            <td className="mono">{fDate(p.deliveryDate)}</td>
                            <td>{poStatus(p)}</td>
                            <td className="mono">{poStockIn(p).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: PO DETAIL VIEW */}
      {detModalOpen && (
        <div className="mb open">
          <div className="modal modal-lg">
            <div className="mh" style={{ alignItems: 'flex-start' }}>
              <div>
                <div className="mt">Chi tiết PO: {selectedPONo}</div>
                <div className="ms" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span>{poData.find(p => p.no === selectedPONo)?.supplierName} · {poData.find(p => p.no === selectedPONo)?.lines.length} Dòng vật tư</span>
                  <span style={{ fontSize: '11px', color: 'var(--txt3)' }}>{poData.find(p => p.no === selectedPONo)?.note || ''}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button className="btn btn-p btn-sm" onClick={() => { setDetModalOpen(false); openShpModal(-1, selectedPONo); }}>+ Lô hàng mới</button>
                <button className="btn btn-g btn-sm" onClick={() => { setDetModalOpen(false); openPOModal(poData.findIndex(p => p.no === selectedPONo)); }}>✏ Sửa PO</button>
                <button className="mx" onClick={() => setDetModalOpen(false)}>✕</button>
              </div>
            </div>
            
            <div className="mbody">
              {poData.find(p => p.no === selectedPONo) && (() => {
                const po = poData.find(p => p.no === selectedPONo)!;
                const tot = poTotalQty(po);
                const amt = poTotalAmt(po);
                const si = poStockIn(po);
                const shps = shpByPO(po.no);
                
                const steps = [
                  { l: 'Đã lập PO', done: true },
                  { l: 'Giao lô hàng', done: shps.length > 0 },
                  { l: 'Đang vận chuyển', done: shps.some(s => ['In Transit', 'Arrived', 'Customs', 'Delivered'].includes(s.status)) },
                  { l: 'Đã về cảng/kho', done: shps.some(s => ['Arrived', 'Customs', 'Delivered'].includes(s.status)) },
                  { l: 'PIC kiểm kho', done: shps.some(s => s.notified) },
                  { l: 'Đã nhập kho', done: si > 0 }
                ];

                return (
                  <div>
                    {/* Steps view */}
                    <div className="steps" style={{ marginBottom: '20px' }}>
                      {steps.map((st, sIdx) => {
                        const active = !st.done && (sIdx === 0 || steps[sIdx - 1].done);
                        return (
                          <div key={sIdx} className={`step ${st.done ? 'done' : active ? 'act' : ''}`}>
                            <div className="step-d">{st.done ? '✓' : sIdx + 1}</div>
                            <div className="step-l">{st.l}</div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="dp" style={{ background: 'var(--s2)', border: '1px solid var(--brd)', padding: '12px 15px', borderRadius: '10px', marginBottom: '12px' }}>
                      <div className="dp-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                        <div><div className="dp-l">Ngày lập</div><div className="dp-v">{fDate(po.date)}</div></div>
                        <div><div className="dp-l">Hạn giao</div><div className="dp-v">{fDate(po.deliveryDate)}</div></div>
                        <div><div className="dp-l">Tổng lượng đặt</div><div className="dp-v">{tot.toLocaleString()} SF + {poTotalAllow(po).toLocaleString()} allow</div></div>
                        <div><div className="dp-l">Trị giá PO</div><div className="dp-v">${amt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div></div>
                        <div><div className="dp-l">Nhà cung cấp</div><div className="dp-v">{po.supplierName} ({po.supplierNo})</div></div>
                        <div><div className="dp-l">Mã Đơn (Order No)</div><div className="dp-v">{po.orderNo || '—'}</div></div>
                        <div><div className="dp-l">Đã giao vận chuyển</div><div className="dp-v" style={{ color: poShipTotal(po.no) >= tot ? 'var(--green)' : 'var(--amber)' }}>{poShipTotal(po.no).toLocaleString()} / {tot.toLocaleString()}</div></div>
                        <div><div className="dp-l">Nhập kho</div><div className="dp-v" style={{ color: si >= tot ? 'var(--green)' : 'var(--amber)' }}>{si.toLocaleString()} SF</div></div>
                        <div><div className="dp-l">Số lô vận chuyển</div><div className="dp-v">{shps.length} lô</div></div>
                        <div><div className="dp-l">Tổng Invoice</div><div className="dp-v">${shps.reduce((a, s) => a + shpTotalAmt(s), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div></div>
                        <div><div className="dp-l">Created</div><div className="dp-v">{fDate(po.createDate)}</div></div>
                        <div><div className="dp-l">Approved</div><div className="dp-v">{fDate(po.approveDate)}</div></div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', gap: '10px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--txt3)' }}>{po.lines.length} material lines · {po.note || 'No note'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--txt3)' }}>{shps.length} shipments · {shps.reduce((a, s) => a + shpTotalQty(s), 0).toLocaleString()} SF</div>
                    </div>

                    <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '14px 0 6px' }}>Danh sách Vật tư (PO Lines)</h4>
                    <div className="card">
                      <div className="tw">
                        <table>
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Mã vật tư</th>
                              <th>Tên tiếng Trung</th>
                              <th>Tên tiếng Anh</th>
                              <th>Màu CN</th>
                              <th>Màu EN</th>
                              <th>Dày/Khổ</th>
                              <th>Size</th>
                              <th>PO Qty</th>
                              <th>Allow.</th>
                              <th>Unit</th>
                              <th>Price</th>
                              <th>Amount</th>
                              <th>Stock In</th>
                              <th>Remaining</th>
                            </tr>
                          </thead>
                          <tbody>
                            {po.lines.map((l, lIdx) => {
                              const rem = Math.max(0, l.poQty - (l.stockInQty || 0));
                              const price = l.poQty > 0 ? l.amount / l.poQty : 0;
                              return (
                              <tr key={lIdx}>
                                <td>{lIdx + 1}</td>
                                <td className="mono" style={{ fontSize: '10px' }}>{l.matNo}</td>
                                <td>{l.matCN}</td>
                                <td>{l.matEN}</td>
                                <td><span className="bdg b-gray">{l.colorCN}</span></td>
                                <td><span className="bdg b-blue">{l.colorEN}</span></td>
                                <td className="mono" style={{ fontSize: '10px' }}>{l.thickness || '—'}</td>
                                <td className="mono" style={{ fontSize: '10px' }}>{l.sizeRange || '—'}</td>
                                <td className="mono" style={{ fontWeight: 600 }}>{l.poQty.toLocaleString()}</td>
                                <td className="mono" style={{ color: 'var(--txt3)' }}>+{l.allowanceQty}</td>
                                <td className="mono">{l.unit}</td>
                                <td className="mono">${price.toFixed(2)}</td>
                                <td className="mono">${l.amount.toFixed(2)}</td>
                                <td className="mono" style={{ color: l.stockInQty >= l.poQty ? 'var(--green)' : 'var(--amber)' }}>{l.stockInQty}</td>
                                <td className="mono" style={{ color: rem > 0 ? 'var(--amber)' : 'var(--green)' }}>{rem}</td>
                              </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '14px 0 6px' }}>Chứng từ Shipments (Lô hàng đã liên kết)</h4>
                    {shps.length > 0 ? (
                      <div style={{ fontSize: '11px', color: 'var(--txt3)', marginBottom: '8px' }}>{shps.length} lô hàng · Tổng {shps.reduce((sum, s) => sum + shpTotalQty(s), 0).toLocaleString()} SF</div>
                    ) : null}
                    {shps.length > 0 ? shps.map((s, sIdx) => {
                      const sTot = shpTotalQty(s);
                      const sAmt = shpTotalAmt(s);
                      return (
                      <div key={sIdx} className="shpc" style={{ border: '1px solid var(--brd)', borderRadius: '8px', marginBottom: '8px', padding: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 'bold' }}>Shp {sIdx + 1}</span>
                            <span className="mono" style={{ fontWeight: 600 }}>{s.invno}</span>
                            <span style={{ fontSize: '10px', color: 'var(--txt3)' }}>{sTot.toLocaleString()} SF · ${sAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className={`bdg ${s.status === 'Delivered' ? 'b-ok' : s.status === 'In Transit' ? 'b-blue' : 'b-gray'}`}>{s.status}</span>
                            {s.notified ? <span className="bdg b-ok">Notified</span> : <span className="bdg b-amber">⚠</span>}
                            <span className="mono" style={{ fontSize: '10px', color: 'var(--txt3)' }}>ETD {fDate(s.etd)} → ETA {fDate(s.eta)}</span>
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', fontSize: '10px', marginBottom: '8px', padding: '6px 8px', background: 'var(--s3)', borderRadius: '6px' }}>
                          <div><span style={{ color: 'var(--txt3)' }}>B/L No:</span> <span className="mono">{s.blno || '—'}</span></div>
                          <div><span style={{ color: 'var(--txt3)' }}>Carrier:</span> {s.carrier || '—'}</div>
                          <div><span style={{ color: 'var(--txt3)' }}>Route:</span> {s.pol || '—'} → {s.pod || '—'}</div>
                          <div><span style={{ color: 'var(--txt3)' }}>Forwarder:</span> {s.fwd || '—'}</div>
                        </div>
                        <div className="tw">
                          <table className="lt">
                            <thead>
                              <tr>
                                <th>#</th>
                                <th>Mã vật tư</th>
                                <th>Vật liệu</th>
                                <th>Màu sắc</th>
                                <th style={{ textAlign: 'right' }}>Số lượng</th>
                                <th>ĐVT</th>
                                <th style={{ textAlign: 'right' }}>Đơn giá</th>
                                <th style={{ textAlign: 'right' }}>Trị giá</th>
                              </tr>
                            </thead>
                            <tbody>
                              {s.invLines.map((il, ilIdx) => (
                                <tr key={ilIdx}>
                                  <td className="ln">{ilIdx + 1}</td>
                                  <td className="mono">{il.matNo}</td>
                                  <td>{il.material}</td>
                                  <td><span className="bdg b-gray" style={{ fontSize: '9px' }}>{il.color}</span></td>
                                  <td className="mono" style={{ textAlign: 'right', fontWeight: 600 }}>{il.qty.toLocaleString()}</td>
                                  <td>{il.unit}</td>
                                  <td className="mono" style={{ textAlign: 'right' }}>{il.price ? `$${il.price.toFixed(2)}` : '—'}</td>
                                  <td className="mono" style={{ textAlign: 'right' }}>{il.price ? `$${(il.qty * il.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {(s.docs || []).length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '6px' }}>
                            {s.docs.map((d, di) => <span key={di} className="bdg b-gray" style={{ fontSize: '9px' }}>📄 {d}</span>)}
                          </div>
                        )}
                        {(s.pic || s.acc) && (
                          <div style={{ fontSize: '10px', marginTop: '5px', padding: '4px 8px', background: 'rgba(0,212,170,.08)', borderRadius: '4px' }}>
                            📢 {[s.pic, s.acc].filter(Boolean).join(' · ')}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '5px', marginTop: '7px', paddingTop: '7px', borderTop: '1px solid var(--brd)' }}>
                          <button className="btn btn-g btn-sm" onClick={() => { setDetModalOpen(false); openShpModal(shpData.indexOf(s)); }}>Sửa</button>
                          <button className="btn btn-d btn-sm" onClick={() => confirmDelete('shp', shpData.indexOf(s))}>✕</button>
                        </div>
                      </div>
                      );
                    }) : <p style={{ fontSize: '11px', color: 'var(--txt3)', fontStyle: 'italic' }}>Chưa có lô hàng nào liên kết.</p>}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NEW / EDIT PO FORM */}
      {poModalOpen && (
        <div className="mb open">
          <div className="modal modal-lg">
            <div className="mh">
              <div className="mt">{editingPOIndex >= 0 ? 'Chỉnh sửa Purchase Order' : 'Lập PO Hàng Mẫu Mới'}</div>
              <button className="mx" onClick={() => setPoModalOpen(false)}>✕</button>
            </div>
            
            <div className="mbody">
              <div className="fsec">
                <div className="fst">Thông tin chung (PO Header)</div>
                <div className="fg4">
                  <div className="fld">
                    <label>Mã số PO <span className="req">*</span></label>
                    <input type="text" placeholder="VNPP26030001" value={pofNo} onChange={e => setPofNo(e.target.value)} />
                  </div>
                  <div className="fld">
                    <label>Ngày đặt <span className="req">*</span></label>
                    <input type="date" value={pofDate} onChange={e => setPofDate(e.target.value)} />
                  </div>
                  <div className="fld">
                    <label>Hạn giao hàng</label>
                    <input type="date" value={pofDel} onChange={e => setPofDel(e.target.value)} />
                  </div>
                  <div className="fld">
                    <label>Nhà cung cấp <span className="req">*</span></label>
                    <input type="text" placeholder="NCC PRIME,..." value={pofSupName} onChange={e => setPofSupName(e.target.value)} />
                  </div>
                  <div className="fld">
                    <label>Mã NCC (Vendor No)</label>
                    <input type="text" placeholder="A087" value={pofSupNo} onChange={e => setPofSupNo(e.target.value)} />
                  </div>
                  <div className="fld">
                    <label>Mã Đơn hàng (Order No)</label>
                    <input type="text" placeholder="TEC1" value={pofOrderNo} onChange={e => setPofOrderNo(e.target.value)} />
                  </div>
                  <div className="fld">
                    <label>Mã Model (Model No)</label>
                    <input type="text" placeholder="MODEL A" value={pofModelNo} onChange={e => setPofModelNo(e.target.value)} />
                  </div>
                  <div className="fld">
                    <label>Trạng thái</label>
                    <select value={pofStatus} onChange={e => setPofStatus(e.target.value)}>
                      <option>Sample (样品)</option>
                      <option>Open</option>
                      <option>In Transit</option>
                      <option>Arrived</option>
                      <option>Completed</option>
                    </select>
                  </div>
                  <div className="fld ffc">
                    <label>Ghi chú</label>
                    <input type="text" placeholder="Mục đích sử dụng, mùa sản xuất..." value={pofNote} onChange={e => setPofNote(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="fsec">
                <div className="fst">Dòng vật tư chi tiết (Material Lines)</div>
                <div className="tw" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  <table className="lt">
                    <thead>
                      <tr>
                        <th style={{ width: '30px' }}>#</th>
                        <th>Mã vật tư</th>
                        <th>Tên Anh</th>
                        <th>Tên Trung</th>
                        <th>Màu EN</th>
                        <th>Màu CN</th>
                        <th>Độ dày</th>
                        <th>Size/Khổ</th>
                        <th>Số lượng</th>
                        <th>Dung sai</th>
                        <th>Đơn vị</th>
                        <th>Đơn giá</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pofLines.map((l, lIdx) => {
                        const handleLineChange = (field: keyof POLine, val: any) => {
                          const updated = [...pofLines];
                          updated[lIdx] = { ...updated[lIdx], [field]: val };
                          
                          // Auto calculate amount when qty or price changes
                          if (field === 'poQty' || field === 'specNotes') { // using specNotes as temporary unitPrice container in state or calculate directly
                            // calculate if qty and price exists
                          }
                          setPofLines(updated);
                        };

                        const handlePriceChange = (priceVal: number) => {
                          const updated = [...pofLines];
                          const qty = updated[lIdx].poQty || 0;
                          updated[lIdx] = {
                            ...updated[lIdx],
                            amount: qty * priceVal
                          };
                          setPofLines(updated);
                        };

                        const unitPrice = l.poQty > 0 ? l.amount / l.poQty : 0;

                        return (
                          <tr key={lIdx}>
                            <td className="ln">{lIdx + 1}</td>
                            <td><input type="text" value={l.matNo} onChange={e => handleLineChange('matNo', e.target.value)} placeholder="Mã số vật tư" /></td>
                            <td><input type="text" value={l.matEN} onChange={e => handleLineChange('matEN', e.target.value)} placeholder="Tên Anh" /></td>
                            <td><input type="text" value={l.matCN} onChange={e => handleLineChange('matCN', e.target.value)} placeholder="Tên Trung" /></td>
                            <td><input type="text" value={l.colorEN} onChange={e => handleLineChange('colorEN', e.target.value)} placeholder="Màu EN" /></td>
                            <td><input type="text" value={l.colorCN} onChange={e => handleLineChange('colorCN', e.target.value)} placeholder="Màu CN" /></td>
                            <td><input type="text" value={l.thickness} onChange={e => handleLineChange('thickness', e.target.value)} placeholder="Dày (mm)" style={{ width: '60px' }} /></td>
                            <td><input type="text" value={l.sizeRange} onChange={e => handleLineChange('sizeRange', e.target.value)} placeholder="Khổ" style={{ width: '60px' }} /></td>
                            <td><input type="number" value={l.poQty || ''} onChange={e => handleLineChange('poQty', parseFloat(e.target.value) || 0)} style={{ width: '70px', textAlign: 'right' }} /></td>
                            <td><input type="number" value={l.allowanceQty || ''} onChange={e => handleLineChange('allowanceQty', parseFloat(e.target.value) || 0)} style={{ width: '50px', textAlign: 'right' }} /></td>
                            <td>
                              <select value={l.unit} onChange={e => handleLineChange('unit', e.target.value)} style={{ padding: '3px' }}>
                                <option>SF</option>
                                <option>yard</option>
                                <option>meter</option>
                                <option>kg</option>
                                <option>pcs</option>
                              </select>
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                value={unitPrice || ''}
                                onChange={e => handlePriceChange(parseFloat(e.target.value) || 0)}
                                style={{ width: '60px', textAlign: 'right' }}
                                placeholder="0.00"
                              />
                            </td>
                            <td>
                              <button className="btn btn-d btn-xs" onClick={() => removePOLineRow(lIdx)}>✕</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <button className="btn btn-g btn-sm" style={{ marginTop: '8px' }} onClick={addPOLineRow}>+ Thêm dòng vật tư</button>
              </div>
            </div>
            
            <div className="mfoot">
              <button className="btn btn-g" onClick={() => setPoModalOpen(false)}>Hủy bỏ</button>
              <button className="btn btn-p" onClick={savePO}>Lưu PO mẫu</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NEW / EDIT SHIPMENT FORM */}
      {shpModalOpen && (
        <div className="mb open">
          <div className="modal modal-lg">
            <div className="mh">
              <div className="mt">{editingShpIndex >= 0 ? 'Cập nhật lô hàng vận chuyển' : 'Tạo Lô hàng (Shipment) Mới'}</div>
              <button className="mx" onClick={() => setShpModalOpen(false)}>✕</button>
            </div>
            
            <div className="mbody">
              <div className="fsec">
                <div className="fst">Thông tin lô hàng (Shipment Header)</div>
                <div className="fg4">
                  <div className="fld" style={{ gridColumn: 'span 2' }}>
                    <label>Liên kết PO Mẫu <span className="req">*</span></label>
                    <select value={shfPono} onChange={e => handleShfPOChange(e.target.value)}>
                      <option value="">— Chọn PO liên kết —</option>
                      {poData.map((p, idx) => (
                        <option key={idx} value={p.no}>{p.no} ({p.supplierName})</option>
                      ))}
                    </select>
                  </div>
                  <div className="fld">
                    <label>Số Invoice <span className="req">*</span></label>
                    <input type="text" placeholder="INV-2026-001" value={shfInvNo} onChange={e => setShfInvNo(e.target.value)} />
                  </div>
                  <div className="fld">
                    <label>Số Bill of Lading (B/L)</label>
                    <input type="text" value={shfBlNo} onChange={e => setShfBlNo(e.target.value)} />
                  </div>
                  <div className="fld">
                    <label>Ngày ETD <span className="req">*</span></label>
                    <input type="date" value={shfEtd} onChange={e => setShfEtd(e.target.value)} />
                  </div>
                  <div className="fld">
                    <label>Ngày ETA <span className="req">*</span></label>
                    <input type="date" value={shfEta} onChange={e => setShfEta(e.target.value)} />
                  </div>
                  <div className="fld">
                    <label>Hãng tàu/Vận chuyển</label>
                    <input type="text" placeholder="Maersk,..." value={shfCarrier} onChange={e => setShfCarrier(e.target.value)} />
                  </div>
                  <div className="fld">
                    <label>Cảng xếp hàng (POL)</label>
                    <input type="text" placeholder="Shanghai" value={shfPol} onChange={e => setShfPol(e.target.value)} />
                  </div>
                  <div className="fld">
                    <label>Cảng dỡ hàng (POD)</label>
                    <input type="text" placeholder="Da Nang" value={shfPod} onChange={e => setShfPod(e.target.value)} />
                  </div>
                  <div className="fld">
                    <label>Công ty Forwarder</label>
                    <input type="text" value={shfFwd} onChange={e => setShfFwd(e.target.value)} />
                  </div>
                  <div className="fld">
                    <label>Trạng thái</label>
                    <select value={shfStatus} onChange={e => setShfStatus(e.target.value)}>
                      <option>Pending</option>
                      <option>In Transit</option>
                      <option>Arrived</option>
                      <option>Customs</option>
                      <option>Delivered</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Selection PO Lines Panel */}
              {showPoLinesPanel && (
                <div className="fsec" style={{ background: 'var(--s2)', border: '1px solid var(--brd)', padding: '10px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '8px' }}>Lựa chọn các dòng từ PO:</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {poData.find(p => p.no === shfPono)?.lines.map((l, i) => {
                      const alr = poLinesAlreadyShipped(shfPono)[l.matNo] || 0;
                      const rem = Math.max(0, l.poQty - alr);
                      return (
                        <label key={i} style={{ display: 'flex', gap: '8px', padding: '6px', background: 'var(--s1)', border: '1px solid var(--brd2)', borderRadius: '6px', alignItems: 'center' }}>
                          <input
                            type="checkbox"
                            checked={!!selectedPoLinesToAdd[i]}
                            disabled={rem <= 0}
                            onChange={e => {
                              setSelectedPoLinesToAdd(prev => ({ ...prev, [i]: e.target.checked }));
                            }}
                          />
                          <div style={{ flex: 1, fontSize: '11px' }}>
                            <div style={{ fontWeight: 'bold' }}>{l.matEN} ({l.colorEN})</div>
                            <div style={{ color: 'var(--txt3)' }}>Mã: {l.matNo} · Số lượng PO: {l.poQty} · Còn lại: {rem}</div>
                          </div>
                          {rem > 0 && (
                            <input
                              type="number"
                              min="1"
                              max={rem}
                              value={selectedPoLinesQtys[i] !== undefined ? selectedPoLinesQtys[i] : rem}
                              onChange={e => {
                                const val = parseFloat(e.target.value) || 0;
                                setSelectedPoLinesQtys(prev => ({ ...prev, [i]: Math.min(rem, val) }));
                              }}
                              style={{ width: '60px', padding: '3px', fontSize: '11px', textAlign: 'right' }}
                            />
                          )}
                        </label>
                      );
                    })}
                  </div>
                  <button className="btn btn-p btn-sm" style={{ marginTop: '8px' }} onClick={applySelectedPoLinesToShipment}>
                    Áp dụng dòng đã chọn
                  </button>
                </div>
              )}

              <div className="fsec">
                <div className="fst">Dòng sản phẩm thực nhập (Invoice Lines)</div>
                <div className="tw" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                  <table className="lt">
                    <thead>
                      <tr>
                        <th style={{ width: '30px' }}>#</th>
                        <th>Mã vật tư</th>
                        <th>Mô tả</th>
                        <th>Màu sắc</th>
                        <th>Số lượng Invoice</th>
                        <th>ĐVT</th>
                        <th>Đơn giá</th>
                        <th>Trị giá</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {shfLines.map((l, lIdx) => {
                        const handleLineChange = (field: keyof ShipmentLine, val: any) => {
                          const updated = [...shfLines];
                          updated[lIdx] = { ...updated[lIdx], [field]: val };
                          setShfLines(updated);
                        };

                        return (
                          <tr key={lIdx}>
                            <td className="ln">{lIdx + 1}</td>
                            <td><input type="text" value={l.matNo} onChange={e => handleLineChange('matNo', e.target.value)} placeholder="Mat No" /></td>
                            <td><input type="text" value={l.material} onChange={e => handleLineChange('material', e.target.value)} placeholder="Tên vật tư" /></td>
                            <td><input type="text" value={l.color} onChange={e => handleLineChange('color', e.target.value)} placeholder="Màu sắc" /></td>
                            <td><input type="number" value={l.qty || ''} onChange={e => handleLineChange('qty', parseFloat(e.target.value) || 0)} style={{ width: '80px', textAlign: 'right' }} /></td>
                            <td>
                              <select value={l.unit} onChange={e => handleLineChange('unit', e.target.value)} style={{ padding: '3px' }}>
                                <option>SF</option>
                                <option>yard</option>
                                <option>meter</option>
                                <option>kg</option>
                                <option>pcs</option>
                              </select>
                            </td>
                            <td><input type="number" step="0.01" value={l.price || ''} onChange={e => handleLineChange('price', parseFloat(e.target.value) || 0)} style={{ width: '70px', textAlign: 'right' }} /></td>
                            <td className="mono" style={{ fontSize: '10px' }}>
                              ${((l.qty || 0) * (l.price || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td>
                              <button className="btn btn-d btn-xs" onClick={() => removeShpLineRow(lIdx)}>✕</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <button className="btn btn-g btn-sm" style={{ marginTop: '8px' }} onClick={addShpLineRow}>+ Thêm dòng Invoice thủ công</button>
              </div>

              <div className="fsec">
                <div className="fst">Chứng từ đi kèm (Documents checklist)</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  {['Commercial Invoice', 'Bill of Lading', 'Packing List', 'C/O Certificate', 'Quality Certificate', 'REACH / Chemical', 'Insurance', 'Other'].map(doc => {
                    const checked = shfDocs.includes(doc);
                    return (
                      <label key={doc} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={e => {
                            if (e.target.checked) setShfDocs(prev => [...prev, doc]);
                            else setShfDocs(prev => prev.filter(d => d !== doc));
                          }}
                        />
                        {doc}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="fsec">
                <div className="fst">Thông báo PIC và Ghi chú thêm</div>
                <div className="fg2">
                  <div className="fld">
                    <label>Người phụ trách (PIC) / Kho nhận hàng</label>
                    <input type="text" placeholder="Tên người nhận, số điện thoại..." value={shfPic} onChange={e => setShfPic(e.target.value)} />
                  </div>
                  <div className="fld">
                    <label>PIC bộ phận Kế toán nhận chứng từ</label>
                    <input type="text" placeholder="Tên kế toán phụ trách..." value={shfAcc} onChange={e => setShfAcc(e.target.value)} />
                  </div>
                  <div className="fld ffc">
                    <label>Ghi chú thêm lô hàng (Container No, ghi chú Hải quan...)</label>
                    <textarea value={shfRemark} onChange={e => setShfRemark(e.target.value)} placeholder="..." style={{ height: '50px' }}></textarea>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mfoot">
              <button className="btn btn-g" onClick={() => setShpModalOpen(false)}>Hủy bỏ</button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-tl" onClick={() => saveShp(true)}>Lưu &amp; Gửi thông báo 📢</button>
                <button className="btn btn-p" onClick={() => saveShp(false)}>Lưu lại</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EMAIL REPORT AND CLIPBOARD COPY */}
      {emailModalOpen && (
        <div className="mb open">
          <div className="modal" style={{ width: '520px' }}>
            <div className="mh">
              <div>
                <div className="mt">Gửi thông báo Lô hàng về</div>
                <div className="ms">Sao chép nội dung hoặc mở ứng dụng Email</div>
              </div>
              <button className="mx" onClick={() => setEmailModalOpen(false)}>✕</button>
            </div>
            <div className="mbody">
              <div className="fld" style={{ marginBottom: '10px' }}>
                <label>Người nhận (To)</label>
                <input type="text" value={emTo} onChange={e => setEmTo(e.target.value)} />
              </div>
              <div className="fld" style={{ marginBottom: '10px' }}>
                <label>Tiêu đề (Subject)</label>
                <input type="text" value={emSubject} onChange={e => setEmSubject(e.target.value)} />
              </div>
              <div className="fld">
                <label>Nội dung Email (Plain Text preview)</label>
                <textarea value={emMsg} readOnly style={{ height: '140px', fontFamily: 'var(--mono)', fontSize: '11px' }}></textarea>
              </div>
            </div>
            <div className="mfoot">
              <button className="btn btn-g" onClick={() => setEmailModalOpen(false)}>Đóng lại</button>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button className="btn btn-g btn-sm" onClick={copyEmailText}>Copy Text</button>
                <button className="btn btn-g btn-sm" onClick={copyEmailHtml}>Copy HTML</button>
                <button className="btn btn-p btn-sm" onClick={handleOpenMailClient}>✉ Mở ứng dụng Mail</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRM DELETE */}
      {confModalOpen && (
        <div className="mb open">
          <div className="modal" style={{ width: '400px' }}>
            <div className="mh">
              <div className="mt">Xác nhận xóa</div>
              <button className="mx" onClick={() => setConfModalOpen(false)}>✕</button>
            </div>
            <div className="mbody">
              <p style={{ fontSize: '12px', color: 'var(--txt2)', lineHeight: 1.5 }}>
                Bạn có chắc chắn muốn xóa bản ghi này? Hành động này sẽ không thể hoàn tác.
              </p>
            </div>
            <div className="mfoot">
              <button className="btn btn-g" onClick={() => setConfModalOpen(false)}>Hủy bỏ</button>
              <button className="btn btn-d" onClick={executeDelete}>Đồng ý Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
