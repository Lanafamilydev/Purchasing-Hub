export interface ProductionOrder {
  factory: string;
  order_id: string;
  order_id_norm: string;
  style_code: string;
  shoe_name: string;
  qty: number;
  delivery_date: string;
  new_old: string;
  line_up_day: number;
  month: number;
  year: number;
  line_up_date: Date | null;
  line_up_str: string;
}

export type MaterialType = 'LEATHER' | 'PU' | 'PVC' | 'FABRIC' | 'UNKNOWN';

export interface MaterialLine {
  order_no: string;
  model_no: string;
  color_no: string;
  mat_no: string;
  mat_name: string;
  mat_type: MaterialType;
  mat_cn: string;
  mat_en: string;
  color_cn: string;
  color_en: string;
  thickness: string;
  width: string;
  size_range: string;
  color_str: string;
  unit: string;
  purchase_qty: number;
  stock_in_qty: number;
  lacking_qty: number;
  po_no: string;
  part_cn: string;
  part_vn: string;
  supplier: string;
  supplier_no: string;
  etd: Date | null;
  eta: Date | null;
  stock_in_date: Date | null;
  inv_no: string;
  actual_import_qty: number;
  sheet: string;
}

export type RiskStatus = 'ok' | 'warn' | 'risk' | 'stocked' | 'no-mat';

export interface CoordOrder extends ProductionOrder {
  mats: MaterialLine[];
  worst_risk: RiskStatus;
  risk_mats: number;
  warn_mats: number;
  ok_mats: number;
  stocked_mats: number;
  latest_eta: Date | null;
  latest_etd: Date | null;
}

export interface POLine {
  matNo: string;
  matFull: string;
  thickness: string;
  matCN: string;
  matEN: string;
  colorCN: string;
  colorEN: string;
  sizeRange: string;
  specNotes: string;
  unit: string;
  poQty: number;
  allowanceQty: number;
  amount: number;
  currency: string;
  stockInQty: number;
}

export interface POData {
  no: string;
  date: string;
  deliveryDate: string;
  xeDate: string;
  stockOutDate: string;
  stockInDate: string;
  deliveryNote: string;
  status: string;
  supplierNo: string;
  supplierName: string;
  season: string;
  orderNo: string;
  modelNo: string;
  note: string;
  createdBy: string;
  createDate: string;
  verifiedBy: string;
  verifiedDate: string;
  approvedBy: string;
  approveDate: string;
  lines: POLine[];
}

export interface ShipmentLine {
  matNo: string;
  material: string;
  color: string;
  qty: number;
  unit: string;
  price: number;
}

export interface Shipment {
  no: string;
  pono: string;
  invno: string;
  blno: string;
  carrier: string;
  etd: string;
  eta: string;
  pol: string;
  pod: string;
  fwd: string;
  status: string;
  invLines: ShipmentLine[];
  docs: string[];
  pic: string;
  acc: string;
  remark: string;
  notified: boolean;
}

export interface ImportRaw {
  headers: string[];
  rows: any[][];
  fname: string;
}

export interface ImportHist {
  type: string;
  new: number;
  upd: number;
  time: string;
  file: string;
}

export interface DBStoreMeta {
  savedAt: number;
  prod: number;
  mat: number;
  mat2: number;
  po: number;
  shp: number;
}
