import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Download, Inbox, Search } from 'lucide-react';
import { MaterialLine } from '../types';
import { fDate, daysBetween } from '../utils';

interface FollowUpProps {
  matLines: MaterialLine[];
  matLines2: MaterialLine[];
}

export const FollowUp: React.FC<FollowUpProps> = ({ matLines, matLines2 }) => {
  const [fSup, setFSup] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPOs, setExpandedPOs] = useState<Record<string, boolean>>({});
  const [expandedSups, setExpandedSups] = useState<Record<string, boolean>>({});

  const allMat = useMemo(() => [...matLines, ...matLines2], [matLines, matLines2]);

  // Aggregated Supplier Data Structure
  const followUpData = useMemo(() => {
    const bySupplier: Record<string, { supplier: string; supplier_no: string; pos: Record<string, { po_no: string; lines: Record<string, any> }> }> = {};
    
    allMat.forEach(m => {
      const sup = m.supplier || 'Unknown';
      const poNo = m.po_no || '(no PO)';
      const matColorKey = [m.mat_no || m.mat_name || '?', m.color_en, m.color_cn].filter(Boolean).join('||');

      if (!bySupplier[sup]) {
        bySupplier[sup] = { supplier: sup, supplier_no: m.supplier_no || '', pos: {} };
      }
      if (!bySupplier[sup].pos[poNo]) {
        bySupplier[sup].pos[poNo] = { po_no: poNo, lines: {} };
      }

      const agg = bySupplier[sup].pos[poNo].lines;
      if (!agg[matColorKey]) {
        agg[matColorKey] = {
          mat_no: m.mat_no,
          mat_name: m.mat_name,
          mat_en: m.mat_en || '',
          mat_cn: m.mat_cn || '',
          color_en: m.color_en || '',
          color_cn: m.color_cn || '',
          thickness: m.thickness || '',
          size_range: m.size_range || '',
          width: m.width || '',
          unit: m.unit || 'SF',
          mat_type: m.mat_type,
          purchase_qty: 0,
          actual_import_qty: 0,
          etd: null as Date | null,
          eta: null as Date | null,
          inv_nos: new Set<string>(),
          order_nos: [] as string[],
          part_vn: m.part_vn || m.part_cn || ''
        };
      }
      
      const a = agg[matColorKey];
      a.purchase_qty += m.purchase_qty;
      a.actual_import_qty += m.actual_import_qty || m.stock_in_qty || 0;
      a.order_nos.push(m.order_no);
      if (m.inv_no) {
        m.inv_no.split(/[\n,;\/]/).map(s => s.trim()).filter(Boolean).forEach(s => a.inv_nos.add(s));
      }
      if (m.etd && (!a.etd || m.etd > a.etd)) a.etd = m.etd;
      if (m.eta && (!a.eta || m.eta > a.eta)) a.eta = m.eta;
    });

    return bySupplier;
  }, [allMat]);

  // Unique suppliers list
  const uniqueSuppliers = useMemo(() => {
    return Object.keys(followUpData).sort();
  }, [followUpData]);

  // Helper functions
  const getLineStatus = (purchase: number, received: number) => {
    if (received <= 0) return 'none';
    if (received >= purchase) return 'done';
    return 'partial';
  };

  const getStatusBadge = (s: string) => {
    if (s === 'done') return <span className="badge b-ok" style={{ fontSize: '9px' }}>✅ Đủ</span>;
    if (s === 'partial') return <span className="badge b-warn" style={{ fontSize: '9px' }}>📦 Một phần</span>;
    return <span className="badge b-gray" style={{ fontSize: '9px' }}>⏳ Chưa về</span>;
  };

  // KPI calculations
  const kpi = useMemo(() => {
    let totalPOs = 0;
    let totalLines = 0;
    let totalPurchase = 0;
    let totalRecv = 0;
    let totalDone = 0;

    Object.values(followUpData).forEach(sd => {
      Object.values(sd.pos).forEach(po => {
        totalPOs++;
        Object.values(po.lines).forEach((l: any) => {
          totalLines++;
          totalPurchase += l.purchase_qty;
          totalRecv += l.actual_import_qty;
          if (getLineStatus(l.purchase_qty, l.actual_import_qty) === 'done') totalDone++;
        });
      });
    });

    const balance = totalPurchase - totalRecv;
    return {
      supplierCount: Object.keys(followUpData).length,
      totalPOs,
      totalLines,
      totalDone,
      balance,
      totalPurchase,
      totalRecv
    };
  }, [followUpData]);

  // Toggle expanders
  const toggleSup = (sup: string) => {
    setExpandedSups(prev => ({ ...prev, [sup]: !prev[sup] }));
  };

  const togglePO = (po: string) => {
    setExpandedPOs(prev => ({ ...prev, [po]: !prev[po] }));
  };

  // Filtered views
  const filteredSuppliers = useMemo(() => {
    const list: any[] = [];
    Object.keys(followUpData).sort().forEach(supName => {
      if (fSup && supName !== fSup) return;
      const sd = followUpData[supName];
      const posToRender: any[] = [];

      Object.keys(sd.pos).sort().forEach(poNo => {
        const po = sd.pos[poNo];
        const linesToRender = Object.values(po.lines).filter((l: any) => {
          const status = getLineStatus(l.purchase_qty, l.actual_import_qty);
          if (fStatus && status !== fStatus) return false;
          if (searchQuery) {
            const q = searchQuery.toLowerCase().trim();
            const hay = [
              poNo,
              l.mat_en,
              l.mat_cn,
              l.color_en,
              l.color_cn,
              l.mat_no,
              [...l.inv_nos].join(' ')
            ].join(' ').toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        });

        if (linesToRender.length > 0) {
          const poRecv = linesToRender.reduce((sum: number, l: any) => sum + l.actual_import_qty, 0);
          const poNeed = linesToRender.reduce((sum: number, l: any) => sum + l.purchase_qty, 0);
          const poBal = poNeed - poRecv;
          const poDone = linesToRender.every((l: any) => getLineStatus(l.purchase_qty, l.actual_import_qty) === 'done');
          const poPartial = !poDone && linesToRender.some((l: any) => getLineStatus(l.purchase_qty, l.actual_import_qty) !== 'none');

          posToRender.push({
            po_no: poNo,
            lines: linesToRender,
            poRecv,
            poNeed,
            poBal,
            poDone,
            poPartial
          });
        }
      });

      if (posToRender.length > 0) {
        const supNeed = posToRender.reduce((sum, p) => sum + p.poNeed, 0);
        const supRecv = posToRender.reduce((sum, p) => sum + p.poRecv, 0);
        list.push({
          name: supName,
          supplier_no: sd.supplier_no,
          pos: posToRender,
          supNeed,
          supRecv
        });
      }
    });

    return list;
  }, [followUpData, fSup, fStatus, searchQuery]);

  // Export Excel Follow UpNCC
  const handleExportExcel = () => {
    if (allMat.length === 0) return;
    
    const wb = XLSX.utils.book_new();
    const today = new Date().toLocaleDateString('vi-VN');
    const todayISO = new Date().toISOString().slice(0, 10);
    
    // Generate Sheets for each Supplier
    Object.keys(followUpData).sort().forEach(sup => {
      const sd = followUpData[sup];
      const sheetName = (sup || 'Unknown').replace(/[:\\\/\?\*\[\]]/g, '').slice(0, 28);
      
      const rows: any[] = [];
      // Row 0: Title
      rows.push([`FOLLOW UP — ${sup}  ·  F26 Division  ·  ${today}`]);
      // Row 1: Sub header
      rows.push([`Supplier No: ${sd.supplier_no || '—'}  ·  ${Object.keys(sd.pos).length} POs  ·  Generated: ${today}`]);
      // Row 2: Headers
      rows.push([
        '#', 'PO#', 'ARTICLES (EN)', 'ARTICLES (CN)', 'COLOR (EN)', 'COLOR (CN)',
        'ORDER QTY', 'UoM', 'ETD', 'ETA', 'INVOICE NO.', 'RECEIVED QTY', 'BALANCE', 'STATUS'
      ]);
      
      let globalRow = 0;
      Object.keys(sd.pos).sort().forEach(poNo => {
        const po = sd.pos[poNo];
        const poLines = Object.values(po.lines);
        if (!poLines.length) return;

        const poTotalNeed = poLines.reduce((sum: number, l: any) => sum + l.purchase_qty, 0);
        const poTotalRecv = poLines.reduce((sum: number, l: any) => sum + l.actual_import_qty, 0);
        const poBal = poTotalNeed - poTotalRecv;
        const poStatusText = poBal <= 0 ? '✅ Đủ' : poTotalRecv > 0 ? '📦 Một phần' : '⏳ Chưa về';

        // Add PO Header Subtotal Row
        rows.push([
          'PO Subtotal', poNo, '', 'PO Header', '', '',
          poTotalNeed, poLines[0]?.unit || 'SF', '', '', '', poTotalRecv, poBal, poStatusText
        ]);

        // Add individual material lines
        poLines.forEach((l: any, li: number) => {
          globalRow++;
          const recv = l.actual_import_qty;
          const bal = l.purchase_qty - recv;
          const status = getLineStatus(l.purchase_qty, recv);
          const statusText = status === 'done' ? '✅ Đủ hàng' : status === 'partial' ? '📦 Một phần' : '⏳ Chưa về';

          rows.push([
            li + 1,
            poNo,
            l.mat_en || l.mat_name,
            l.mat_cn || '—',
            l.color_en || '—',
            l.color_cn || '—',
            l.purchase_qty,
            l.unit,
            l.etd ? fDate(l.etd) : '—',
            l.eta ? fDate(l.eta) : '—',
            [...l.inv_nos].join('\n') || '—',
            recv || '',
            bal,
            statusText
          ]);
        });
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      
      // Auto col width estimation
      const maxColWidths = [5, 15, 30, 20, 15, 15, 12, 8, 12, 12, 20, 12, 12, 15];
      ws['!cols'] = maxColWidths.map(w => ({ wch: w }));
      
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    // ── SUMMARY SHEET ──
    const summaryRows: any[] = [];
    summaryRows.push([`F26 LEATHER MATERIAL — FOLLOW UP SUMMARY  ·  ${today}`]);
    summaryRows.push([
      'Nhà cung cấp', 'Mã NCC', 'Tổng PO', 'Lines', 'Cần (SF/SQM/M)', 'Đã nhận', 'Balance', '% Hoàn thành'
    ]);

    Object.keys(followUpData).sort().forEach(sup => {
      const sd = followUpData[sup];
      const allL = Object.values(sd.pos).flatMap(po => Object.values(po.lines));
      const need = allL.reduce((sum: number, l: any) => sum + l.purchase_qty, 0);
      const recv = allL.reduce((sum: number, l: any) => sum + l.actual_import_qty, 0);
      const bal = need - recv;
      const pct = need > 0 ? (recv / need) * 100 : 0;

      summaryRows.push([
        sup,
        sd.supplier_no,
        Object.keys(sd.pos).length,
        allL.length,
        need,
        recv,
        bal,
        `${pct.toFixed(1)}%`
      ]);
    });

    const sumWs = XLSX.utils.aoa_to_sheet(summaryRows);
    sumWs['!cols'] = [{ wch: 25 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, sumWs, '📊 SUMMARY');

    XLSX.writeFile(wb, `F26_FOLLOW_UP_LEATHER_${todayISO}.xlsx`);
  };

  return (
    <div className="page active" id="pg-followup">
      <div className="topbar">
        <div className="pg-title">📋 Follow Up Nhà Cung Cấp</div>
        <div>
          <button className="btn btn-tl btn-sm" onClick={handleExportExcel} disabled={allMat.length === 0}>
            <Download size={14} /> Xuất Follow Up Excel
          </button>
        </div>
      </div>

      <div className="fbar">
        <span className="fl">Lọc</span>
        <select value={fSup} onChange={e => setFSup(e.target.value)}>
          <option value="">Tất cả NCC</option>
          {uniqueSuppliers.map((s, idx) => (
            <option key={idx} value={s}>{s}</option>
          ))}
        </select>
        <select value={fStatus} onChange={e => setFStatus(e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          <option value="done">✅ Đã nhận đủ</option>
          <option value="partial">📦 Nhận một phần</option>
          <option value="none">⏳ Chưa nhận</option>
        </select>
        <div className="sw">
          <span className="sw-ico"><Search size={12} /></span>
          <input
            type="text"
            placeholder="PO#, tên liệu, màu..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <span style={{ fontSize: '11px', color: 'var(--txt3)', whiteSpace: 'nowrap' }}>
          {filteredSuppliers.reduce((sum, s) => sum + s.pos.length, 0)} PO hiển thị
        </span>
      </div>

      {allMat.length > 0 && (
        <div className="fu-kpi">
          <div className="fu-kcard">
            <div className="fu-kcard-v" style={{ color: 'var(--acc)' }}>{kpi.supplierCount}</div>
            <div className="fu-kcard-l">Nhà cung cấp</div>
          </div>
          <div className="fu-kcard">
            <div className="fu-kcard-v" style={{ color: 'var(--acc2)' }}>{kpi.totalPOs}</div>
            <div className="fu-kcard-l">Tổng PO</div>
          </div>
          <div className="fu-kcard">
            <div className="fu-kcard-v" style={{ color: 'var(--txt)' }}>{kpi.totalLines}</div>
            <div className="fu-kcard-l">Lines vật liệu</div>
          </div>
          <div className="fu-kcard">
            <div className="fu-kcard-v" style={{ color: 'var(--green)' }}>{kpi.totalDone}</div>
            <div className="fu-kcard-l">Lines đã đủ hàng</div>
          </div>
          <div className="fu-kcard">
            <div className="fu-kcard-v" style={{ color: kpi.balance > 0 ? 'var(--amber)' : 'var(--green)' }}>
              {Math.abs(kpi.balance).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}
            </div>
            <div className="fu-kcard-l">Balance còn lại ({kpi.balance > 0 ? 'thiếu' : 'đủ/dư'})</div>
          </div>
        </div>
      )}

      <div id="fu-content">
        {filteredSuppliers.map((sup, sIdx) => {
          const isSupOpen = !expandedSups[sup.name]; // default open
          return (
            <div key={sIdx} className="fu-block">
              <div className="fu-sup-hd" onClick={() => toggleSup(sup.name)}>
                <div>
                  <span className="fu-sup-name">{sup.name}</span>
                  <span style={{ fontSize: '10px', color: 'var(--txt3)', marginLeft: '8px' }}>{sup.supplier_no}</span>
                </div>
                <span className="fu-sup-meta">
                  {sup.pos.length} PO &nbsp;·&nbsp; Đặt: {sup.supNeed.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} &nbsp;·&nbsp; Đã về: {sup.supRecv.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}
                </span>
                <span className={`fu-sup-toggle ${isSupOpen ? 'open' : ''}`}>▶</span>
              </div>
              
              {isSupOpen && (
                <div className="fu-sup-body">
                  {sup.pos.map((po: any, pIdx: number) => {
                    const isPoOpen = !!expandedPOs[po.po_no];
                    const poStatusDot = po.poDone ? '🟢' : po.poPartial ? '🟡' : '⚪';
                    return (
                      <div key={pIdx}>
                        <div className="fu-po-hd" onClick={() => togglePO(po.po_no)}>
                          <span>{poStatusDot}</span>
                          <span className="fu-po-no">{po.po_no}</span>
                          <span className="fu-po-meta">
                            {po.lines.length} lines &nbsp;·&nbsp; Cần: {po.poNeed.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} &nbsp;·&nbsp; Đã về: {po.poRecv.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} &nbsp;·&nbsp;
                            <span style={{ color: po.poBal <= 0 ? 'var(--green)' : 'var(--amber)' }}>
                              Balance: {po.poBal <= 0 ? `+${Math.abs(po.poBal).toFixed(1)}` : `-${po.poBal.toFixed(1)}`}
                            </span>
                          </span>
                          <span className={`fu-sup-toggle ${isPoOpen ? 'open' : ''}`} style={{ marginLeft: 'auto' }}>▶</span>
                        </div>

                        {isPoOpen && (
                          <div className="fu-po-detail" style={{ overflowX: 'auto', marginBottom: '6px' }}>
                            <table className="fu-tbl">
                              <thead>
                                <tr>
                                  <th>Mã vật tư</th>
                                  <th>Article (EN)</th>
                                  <th>Article (CN)</th>
                                  <th>Màu EN</th>
                                  <th>Màu CN</th>
                                  <th>Spec</th>
                                  <th style={{ textAlign: 'right' }}>Đặt hàng</th>
                                  <th>ĐVT</th>
                                  <th>ETD</th>
                                  <th>ETA</th>
                                  <th>Invoice No.</th>
                                  <th style={{ textAlign: 'right' }}>Đã nhận</th>
                                  <th style={{ textAlign: 'right' }}>Balance</th>
                                  <th>Trạng thái</th>
                                </tr>
                              </thead>
                              <tbody>
                                {po.lines.map((l: any, li: number) => {
                                  const bal = l.purchase_qty - l.actual_import_qty;
                                  const status = getLineStatus(l.purchase_qty, l.actual_import_qty);
                                  const balCls = bal <= 0 ? 'fu-bal-ok' : l.actual_import_qty > 0 ? 'fu-bal-part' : 'fu-bal-none';
                                  const balStr = bal === 0 ? '0' : bal < 0 ? `+${Math.abs(bal).toFixed(1)}` : `-${bal.toFixed(1)}`;
                                  const dimStr = [l.thickness, l.size_range || l.width].filter(Boolean).join(' · ') || '—';
                                  
                                  const gap = l.eta ? daysBetween(new Date(), l.eta) : null;
                                  const etaHtml = !l.eta ? (
                                    <span style={{ color: 'var(--txt3)' }}>—</span>
                                  ) : (
                                    <span className={status === 'done' ? 'eta-chip eta-stocked' : gap !== null && gap < 0 ? 'eta-chip eta-risk' : gap !== null && gap < 7 ? 'eta-chip eta-warn' : 'eta-chip eta-ok'}>
                                      {fDate(l.eta)}
                                    </span>
                                  );

                                  return (
                                    <tr key={li}>
                                      <td className="mono" style={{ fontSize: '10px', color: 'var(--acc3)' }}>{l.mat_no || '—'}</td>
                                      <td style={{ fontWeight: 500, maxWidth: '170px' }} title={l.mat_name}>{l.mat_en || l.mat_name || '—'}</td>
                                      <td style={{ fontSize: '10px', color: 'var(--txt2)', maxWidth: '90px' }}>{l.mat_cn || '—'}</td>
                                      <td><span style={{ backgroundColor: 'rgba(74,158,255,.14)', color: 'var(--acc2)', padding: '1px 6px', borderRadius: '3px', fontSize: '10px', whiteSpace: 'nowrap' }}>{l.color_en || '—'}</span></td>
                                      <td style={{ fontSize: '10px', color: 'var(--txt3)' }}>{l.color_cn || '—'}</td>
                                      <td className="mono" style={{ fontSize: '10px', color: 'var(--txt3)' }}>{dimStr}</td>
                                      <td className="mono" style={{ textAlign: 'right', fontWeight: 600 }}>{l.purchase_qty.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}</td>
                                      <td style={{ fontSize: '10px', color: 'var(--txt3)' }}>{l.unit}</td>
                                      <td className="mono" style={{ fontSize: '10px', color: 'var(--txt2)' }}>{fDate(l.etd)}</td>
                                      <td>{etaHtml}</td>
                                      <td style={{ maxWidth: '180px', lineHeight: 1.6 }}>
                                        {[...l.inv_nos].slice(0, 4).map((inv, iIdx) => (
                                          <span key={iIdx} className="inv-tag">{inv}</span>
                                        ))}
                                        {[...l.inv_nos].length > 4 && (
                                          <span style={{ color: 'var(--txt3)', fontSize: '9px' }}> +{[...l.inv_nos].length - 4}</span>
                                        )}
                                        {[...l.inv_nos].length === 0 && <span style={{ color: 'var(--txt3)' }}>—</span>}
                                      </td>
                                      <td className="mono" style={{ textAlign: 'right', color: l.actual_import_qty > 0 ? 'var(--acc)' : 'var(--txt3)' }}>
                                        {l.actual_import_qty > 0 ? l.actual_import_qty.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) : '—'}
                                      </td>
                                      <td className={`mono ${balCls}`} style={{ textAlign: 'right' }}>{balStr}</td>
                                      <td>{getStatusBadge(status)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredSuppliers.length === 0 && (
        <div className="empty">
          <div className="empty-icon"><Inbox size={48} /></div>
          <div className="empty-title">Chưa có dữ liệu</div>
          <div className="empty-desc">Nạp dữ liệu từ tab Lịch Lên Chuyền để xem Follow Up theo nhà cung cấp.</div>
        </div>
      )}
    </div>
  );
};
