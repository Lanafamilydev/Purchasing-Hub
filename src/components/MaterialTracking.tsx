import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Search, Inbox } from 'lucide-react';
import { CoordOrder, MaterialLine } from '../types';
import { daysBetween, fDate } from '../utils';

interface MaterialTrackingProps {
  coordData: CoordOrder[];
}

export const MaterialTracking: React.FC<MaterialTrackingProps> = ({ coordData }) => {
  const [fFac, setFFac] = useState('');
  const [fRisk, setFRisk] = useState('');
  const [fMonth, setFMonth] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleRow = (key: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Dynamic filter values
  const factories = useMemo(() => {
    return [...new Set(coordData.map(o => o.factory))].sort();
  }, [coordData]);

  const months = useMemo(() => {
    return [...new Set(coordData.map(o => o.month))].sort((a, b) => a - b);
  }, [coordData]);

  // Filters logic
  const filtered = useMemo(() => {
    return coordData.filter(o => {
      if (fFac && o.factory !== fFac) return false;
      if (fMonth && String(o.month) !== fMonth) return false;
      if (fRisk) {
        if (fRisk === 'stocked' && o.worst_risk !== 'stocked') return false;
        if (fRisk === 'ok' && !['ok', 'stocked'].includes(o.worst_risk)) return false;
        if (fRisk === 'warn' && o.worst_risk !== 'warn') return false;
        if (fRisk === 'risk' && o.worst_risk !== 'risk') return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const hay = [
          o.order_id,
          o.style_code,
          o.shoe_name,
          ...o.mats.map(m => m.mat_no),
          ...o.mats.map(m => m.mat_name)
        ].join(' ').toLowerCase();
        
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [coordData, fFac, fRisk, fMonth, searchQuery]);

  const calcMatRisk = (m: MaterialLine, lineUpDate: Date | null) => {
    if (m.purchase_qty > 0 && m.lacking_qty >= 0) return 'stocked';
    if (!m.eta) return m.purchase_qty > 0 ? 'warn' : 'ok';
    const gap = daysBetween(lineUpDate, m.eta);
    if (gap === null) return 'warn';
    if (gap < 14) return 'risk';
    if (gap < 25) return 'warn';
    return 'ok';
  };

  const getRiskLabel = (r: string) => {
    if (r === 'risk') return <span className="badge b-risk">🔴 Rủi ro</span>;
    if (r === 'warn') return <span className="badge b-warn">🟡 Theo dõi</span>;
    if (r === 'stocked') return <span className="badge b-blue">✅ Đã có liệu</span>;
    if (r === 'no-mat') return <span className="badge b-gray">— Chưa có liệu</span>;
    return <span className="badge b-ok">🟢 Đúng tiến độ</span>;
  };

  const getMatTypeBadge = (t: string) => {
    const m: Record<string, React.ReactNode> = {
      LEATHER: <span className="badge b-violet" style={{ fontSize: '9px', padding: '1px 5px' }}>DA</span>,
      PU: <span className="badge b-teal" style={{ fontSize: '9px', padding: '1px 5px' }}>PU</span>,
      PVC: <span className="badge b-blue" style={{ fontSize: '9px', padding: '1px 5px' }}>PVC</span>,
      FABRIC: <span className="badge b-amber" style={{ fontSize: '9px', padding: '1px 5px' }}>VẢI</span>,
      UNKNOWN: <span className="badge b-gray" style={{ fontSize: '9px', padding: '1px 5px' }}>?</span>,
    };
    return m[t] || m.UNKNOWN;
  };

  const renderMatPanel = (o: CoordOrder) => {
    if (o.mats.length === 0) {
      return (
        <div className="mat-panel">
          <div style={{ padding: '10px 20px', fontSize: '11px', color: 'var(--txt3)', fontStyle: 'italic' }}>
            Không tìm thấy vật liệu khớp với đơn này trong Material Tracking.
          </div>
        </div>
      );
    }
    
    // Group mats by part
    const groups: Record<string, MaterialLine[]> = {};
    o.mats.forEach(m => {
      const k = m.part_vn || m.part_cn || 'Khác';
      if (!groups[k]) groups[k] = [];
      groups[k].push(m);
    });

    return (
      <div className="mat-panel">
        <table className="mat-table">
          <thead>
            <tr>
              <th>Phân loại</th>
              <th>Mã vật tư</th>
              <th>Tên liệu EN</th>
              <th>Tên liệu CN</th>
              <th>Màu EN</th>
              <th>Màu CN</th>
              <th>Dày/Rộng/Size</th>
              <th>Supplier</th>
              <th>PO No.</th>
              <th style={{ textAlign: 'right' }}>Cần</th>
              <th>Đã về</th>
              <th style={{ textAlign: 'right' }}>Thiếu/Dư</th>
              <th>ETD</th>
              <th>ETA</th>
              <th>Gap</th>
              <th>Rủi ro</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(groups).map(([part, mats], gIdx) => (
              <React.Fragment key={gIdx}>
                <tr>
                  <td colSpan={16} className="part-group" style={{ padding: '6px 12px', fontWeight: 'bold' }}>{part}</td>
                </tr>
                {mats.map((m, mIdx) => {
                  const risk = calcMatRisk(m, o.line_up_date);
                  const gap = m.eta ? daysBetween(o.line_up_date, m.eta) : null;
                  const gapStr = gap === null ? '—' : gap < 0 ? `${gap}d` : gap === 0 ? '0d' : `+${gap}d`;
                  const gapCls = gap === null ? 'days-na' : gap < 14 ? 'days-risk' : gap < 21 ? 'days-warn' : 'days-ok';
                  const stockPct = m.purchase_qty > 0 ? Math.min(100, (m.stock_in_qty / m.purchase_qty) * 100) : 0;
                  const stockCls = stockPct >= 100 ? 'sf-ok' : stockPct > 0 ? 'sf-warn' : 'sf-risk';
                  
                  const etaChip = risk === 'stocked' ? (
                    <span className="eta-chip eta-stocked">✅ In stock</span>
                  ) : !m.eta ? (
                    <span className="eta-chip eta-none">—</span>
                  ) : gap !== null && gap < 14 ? (
                    <span className="eta-chip eta-risk">{fDate(m.eta)}</span>
                  ) : gap !== null && gap < 21 ? (
                    <span className="eta-chip eta-warn">{fDate(m.eta)}</span>
                  ) : (
                    <span className="eta-chip eta-ok">{fDate(m.eta)}</span>
                  );

                  const lackVal = m.lacking_qty;
                  const lackDisp = lackVal < 0 ? (
                    <span style={{ color: 'var(--red)', fontWeight: 600 }}>{lackVal.toLocaleString()}</span>
                  ) : lackVal === 0 ? (
                    <span style={{ color: 'var(--txt3)' }}>0</span>
                  ) : (
                    <span style={{ color: 'var(--green)' }}>+{lackVal.toLocaleString()}</span>
                  );

                  const dimParts = [m.thickness, m.width, m.size_range].filter(Boolean);
                  const dimStr = dimParts.length ? dimParts.join(' · ') : '—';
                  const matEnDisplay = m.mat_en || (m.mat_name.length > 40 ? m.mat_name.slice(0, 38) + '…' : m.mat_name);

                  return (
                    <tr key={mIdx}>
                      <td>{getMatTypeBadge(m.mat_type)}</td>
                      <td className="mono" style={{ fontSize: '10px', color: 'var(--acc3)' }}>{m.mat_no}</td>
                      <td style={{ maxWidth: '160px', fontWeight: 500, color: 'var(--txt)' }} title={m.mat_name}>{matEnDisplay}</td>
                      <td style={{ fontSize: '10px', color: 'var(--txt2)', maxWidth: '100px' }} title={m.mat_cn}>{m.mat_cn.length > 18 ? m.mat_cn.slice(0, 16) + '…' : m.mat_cn}</td>
                      <td style={{ fontSize: '10px' }}><span style={{ backgroundColor: 'rgba(74,158,255,.15)', color: '#4a9eff', padding: '1px 6px', borderRadius: '4px', whiteSpace: 'nowrap' }}>{m.color_en || '—'}</span></td>
                      <td style={{ fontSize: '10px', color: 'var(--txt3)' }}>{m.color_cn || '—'}</td>
                      <td className="mono" style={{ fontSize: '10px', color: 'var(--txt3)' }}>{dimStr}</td>
                      <td style={{ fontSize: '10px' }}>{m.supplier || '—'}</td>
                      <td className="mono" style={{ fontSize: '10px', color: 'var(--txt3)' }}>{m.po_no || '—'}</td>
                      <td className="mono" style={{ fontSize: '11px', textAlign: 'right' }}>
                        {m.purchase_qty ? m.purchase_qty.toLocaleString() : 0} <span style={{ fontSize: '9px', color: 'var(--txt3)' }}>{m.unit}</span>
                      </td>
                      <td>
                        <div className="stock-bar">
                          <div className="sbg">
                            <div className={`${stockCls} sf`} style={{ width: `${stockPct.toFixed(0)}%` }}></div>
                          </div>
                          <span className="mono" style={{ fontSize: '10px', color: 'var(--txt2)' }}>{m.stock_in_qty.toLocaleString()}</span>
                        </div>
                      </td>
                      <td className="mono" style={{ fontSize: '11px', textAlign: 'right' }}>{lackDisp}</td>
                      <td className="mono" style={{ fontSize: '10px', color: 'var(--txt2)' }}>{fDate(m.etd)}</td>
                      <td>{etaChip}</td>
                      <td className={gapCls}>{gapStr}</td>
                      <td>{getRiskLabel(risk)}</td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="page active" id="pg-coord">
      <div className="topbar">
        <div className="pg-title">🔗 Material Tracking Table</div>
      </div>
      
      <div className="fbar">
        <span className="fl">Lọc</span>
        <select value={fFac} onChange={e => setFFac(e.target.value)}>
          <option value="">Tất cả nhà máy</option>
          {factories.map((f, idx) => (
            <option key={idx} value={f}>{f}</option>
          ))}
        </select>
        <select value={fRisk} onChange={e => setFRisk(e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          <option value="risk">🔴 Rủi ro cao</option>
          <option value="warn">🟡 Cần theo dõi</option>
          <option value="ok">🟢 Đúng tiến độ</option>
          <option value="stocked">✅ Đã có liệu</option>
        </select>
        <select value={fMonth} onChange={e => setFMonth(e.target.value)}>
          <option value="">Tất cả tháng</option>
          {months.map((m, idx) => (
            <option key={idx} value={m}>Tháng {m}</option>
          ))}
        </select>
        <div className="sw">
          <span className="sw-ico"><Search size={12} /></span>
          <input
            type="text"
            placeholder="Tìm mã đơn, tên giày, mã liệu..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <span style={{ fontSize: '11px', color: 'var(--txt3)', whiteSpace: 'nowrap' }}>
          {filtered.length} / {coordData.length} đơn
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="coord-table">
          <thead className="ct-thead">
            <tr>
              <th style={{ width: '22px' }}></th>
              <th>Order No.</th>
              <th>Model</th>
              <th>Tên giày</th>
              <th>Nhà máy</th>
              <th>Ngày LC</th>
              <th>Sản lượng</th>
              <th>Vật liệu</th>
              <th>Rủi ro liệu</th>
              <th>ETD gần nhất</th>
              <th>ETA gần nhất</th>
              <th>Gap (ETA→LC)</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o, idx) => {
              const key = `${o.order_id}|${o.line_up_str}`;
              const isExp = !!expandedRows[key];
              const factoryClass = o.factory === '二厂' ? 'chip-二厂' : o.factory === '三厂' ? 'chip-三厂' : o.factory === '四厂' ? 'chip-四厂' : 'chip-五厂板房';
              const gap = o.latest_eta ? daysBetween(o.line_up_date, o.latest_eta) : null;
              
              const gapHtml = gap === null ? (
                <span className="days-na">—</span>
              ) : gap < 14 ? (
                <span className="days-risk">{gap}d !</span>
              ) : gap < 21 ? (
                <span className="days-warn">+{gap}d</span>
              ) : (
                <span className="days-ok">+{gap}d</span>
              );

              return (
                <React.Fragment key={idx}>
                  <tr className="order-row">
                    <td colSpan={12} style={{ padding: 0 }}>
                      <div
                        className="or-main"
                        onClick={() => toggleRow(key)}
                        style={{
                          gridTemplateColumns: '22px 120px 80px 1fr 90px 80px 70px 80px 90px 90px 90px 70px',
                          gap: 0,
                          display: 'grid'
                        }}
                      >
                        <span className={`or-expander ${isExp ? 'open' : ''}`}>
                          {isExp ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </span>
                        <span className="mono" style={{ fontSize: '10px', color: 'var(--acc)', fontWeight: 600 }}>{o.order_id}</span>
                        <span style={{ fontSize: '11px', color: 'var(--txt2)' }}>{o.style_code || '—'}</span>
                        <span style={{ fontSize: '12px', fontWeight: 500 }}>{o.shoe_name || '—'}</span>
                        <span><span className={`fac-chip ${factoryClass}`}>{o.factory}</span></span>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--acc2)' }}>{o.line_up_str}</span>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: '11px' }}>{o.qty.toLocaleString()}</span>
                        <span><span className="badge b-gray">{o.mats.length} lines</span></span>
                        <span>{getRiskLabel(o.worst_risk)}</span>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--txt2)' }}>{fDate(o.latest_etd)}</span>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--txt)' }}>{fDate(o.latest_eta)}</span>
                        <span>{gapHtml}</span>
                      </div>
                    </td>
                  </tr>
                  {isExp && (
                    <tr>
                      <td colSpan={12} style={{ padding: 0 }}>
                        {renderMatPanel(o)}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="empty">
          <div className="empty-icon"><Inbox size={48} /></div>
          <div className="empty-title">Không tìm thấy đơn hàng</div>
          <div className="empty-desc">Không có dữ liệu khớp với bộ lọc hiện tại.</div>
        </div>
      )}
    </div>
  );
};
