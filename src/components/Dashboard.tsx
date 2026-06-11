import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ProductionOrder, MaterialLine, POData, Shipment, CoordOrder } from '../types';
import { calcMatRisk, daysBetween, fDate } from '../utils';

interface DashboardProps {
  prodOrders: ProductionOrder[];
  matLines: MaterialLine[];
  matLines2: MaterialLine[];
  coordData: CoordOrder[];
  poData: POData[];
  shpData: Shipment[];
  onNavigate: (page: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  prodOrders,
  matLines,
  matLines2,
  coordData,
  poData,
  shpData,
  onNavigate
}) => {
  const hasData = prodOrders.length > 0 || matLines.length > 0 || matLines2.length > 0 || poData.length > 0;
  
  const allMat = useMemo(() => [...matLines, ...matLines2], [matLines, matLines2]);

  // Calculations
  const stats = useMemo(() => {
    const totalProd = prodOrders.length;
    const totalMatCount = allMat.length;
    const riskCount = coordData.filter(o => o.worst_risk === 'risk').length;
    const warnCount = coordData.filter(o => o.worst_risk === 'warn').length;
    
    // Group allMat by Supplier to get Supplier count
    const uniqueSuppliers = new Set(allMat.map(m => m.supplier).filter(Boolean));
    // Unique POs from materials
    const uniquePOs = new Set(allMat.map(m => m.po_no).filter(Boolean));
    
    const samplePOCount = poData.length;
    const overduePO = poData.filter(p => {
      if (!p.deliveryDate) return false;
      const days = Math.round((new Date(p.deliveryDate).getTime() - new Date().getTime()) / 86400000);
      return days < 0 && p.status !== 'Completed';
    }).length;
    
    const shippingCount = shpData.length;
    const inTransitCount = shpData.filter(s => ['In Transit', 'Arrived'].includes(s.status)).length;
    
    return {
      totalProd,
      totalMatCount,
      riskCount,
      warnCount,
      supplierCount: uniqueSuppliers.size,
      materialPOCount: uniquePOs.size,
      samplePOCount,
      overduePO,
      shippingCount,
      inTransitCount
    };
  }, [prodOrders, allMat, coordData, poData, shpData]);

  // Chart Data 1: Supplier performance (Top 5 suppliers by purchase qty vs stock-in)
  const chartSupplierData = useMemo(() => {
    const suppliers: Record<string, { name: string; ordered: number; received: number }> = {};
    allMat.forEach(m => {
      const name = m.supplier || 'Unknown';
      if (!suppliers[name]) {
        suppliers[name] = { name, ordered: 0, received: 0 };
      }
      suppliers[name].ordered += m.purchase_qty;
      suppliers[name].received += (m.actual_import_qty || m.stock_in_qty || 0);
    });
    
    return Object.values(suppliers)
      .sort((a, b) => b.ordered - a.ordered)
      .slice(0, 5);
  }, [allMat]);

  // Chart Data 2: Risk distribution
  const chartRiskData = useMemo(() => {
    const ok = coordData.filter(o => ['ok', 'stocked', 'no-mat'].includes(o.worst_risk)).length;
    const warn = coordData.filter(o => o.worst_risk === 'warn').length;
    const risk = coordData.filter(o => o.worst_risk === 'risk').length;
    
    return [
      { name: 'Đúng tiến độ', value: ok, color: '#22c55e' },
      { name: 'Cần theo dõi', value: warn, color: '#f59e0b' },
      { name: 'Rủi ro', value: risk, color: '#ef4444' }
    ].filter(d => d.value > 0);
  }, [coordData]);

  const riskOrders = useMemo(() => {
    return coordData
      .filter(o => o.worst_risk === 'risk')
      .slice(0, 5);
  }, [coordData]);

  // Follow Up summary (Top 5 suppliers completion percentage)
  const followUpSummary = useMemo(() => {
    const suppliers: Record<string, { name: string; pos: Set<string>; purchase: number; recv: number }> = {};
    allMat.forEach(m => {
      const sup = m.supplier || 'Unknown';
      if (!suppliers[sup]) {
        suppliers[sup] = { name: sup, pos: new Set(), purchase: 0, recv: 0 };
      }
      if (m.po_no) suppliers[sup].pos.add(m.po_no);
      suppliers[sup].purchase += m.purchase_qty;
      suppliers[sup].recv += (m.actual_import_qty || m.stock_in_qty || 0);
    });

    return Object.values(suppliers)
      .map(s => {
        const pct = s.purchase > 0 ? (s.recv / s.purchase) * 100 : 0;
        return { ...s, pct };
      })
      .sort((a, b) => b.purchase - a.purchase)
      .slice(0, 5);
  }, [allMat]);

  // PO status distribution
  const poSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    poData.forEach(p => {
      // Logic for status
      const ss = shpData.filter(s => s.pono === p.no);
      let status = p.status;
      if (ss.length > 0) {
        if (ss.every(s => s.status === 'Delivered')) status = 'Completed';
        else if (ss.some(s => ['Arrived', 'Customs'].includes(s.status))) status = 'Arrived';
        else if (ss.some(s => s.status === 'In Transit')) status = 'In Transit';
      }
      counts[status] = (counts[status] || 0) + 1;
    });
    return Object.entries(counts);
  }, [poData, shpData]);

  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const renderPOStatusBadge = (s: string) => {
    const m: Record<string, string> = {
      'Sample (样品)': 'b-violet',
      'Open': 'b-gray',
      'In Transit': 'b-blue',
      'Arrived': 'b-teal',
      'Completed': 'b-ok',
      'Delivered': 'b-ok',
      'Pending': 'b-gray',
      'Customs': 'b-warn'
    };
    return <span className={`bdg ${m[s] || 'b-gray'}`}>{s}</span>;
  };

  return (
    <div className="page active" id="pg-dash">
      <div className="topbar">
        <div className="pg-title">📊 Dashboard</div>
        <span style={{ fontSize: '10px', color: 'var(--txt3)', fontFamily: 'var(--mono)' }}>{dateStr}</span>
      </div>

      {!hasData && (
        <div id="dash-welcome" style={{
          background: 'linear-gradient(135deg, var(--s2), var(--s3))',
          border: '1px solid var(--acc)',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{ fontSize: '42px', flexShrink: 0 }}>🏭</div>
          <div>
            <div style={{ fontSize: '17px', fontWeight: 800, marginBottom: '5px' }}>F26 Leather · Unified Web App</div>
            <div style={{ fontSize: '12px', color: 'var(--txt2)', lineHeight: 1.6 }}>
              Import dữ liệu để bắt đầu. Hỗ trợ Lịch Lên Chuyền · Material Tracking Da/PU/PVC/Vải · PO Tracking Hàng Mẫu.
            </div>
            <div style={{ display: 'flex', gap: '9px', marginTop: '10px', flexWrap: 'wrap' }}>
              <button className="btn btn-p" onClick={() => onNavigate('schedule')}>📅 Import Lịch LC</button>
              <button className="btn btn-nv" onClick={() => onNavigate('schedule')}>🐄 Import Material</button>
              <button className="btn btn-g" onClick={() => onNavigate('po')}>📦 PO Tracking</button>
            </div>
          </div>
        </div>
      )}

      {/* KPI Row */}
      <div className="dash-krow">
        <div className="dk dk-acc">
          <div className="dk-v" style={{ color: 'var(--acc)' }}>{stats.totalProd.toLocaleString()}</div>
          <div className="dk-l">Đơn SX</div>
          <div className="dk-s">{[...new Set(prodOrders.map(o => o.factory))].length} nhà máy</div>
        </div>
        <div className="dk dk-acc2">
          <div className="dk-v" style={{ color: 'var(--acc2)' }}>{stats.totalMatCount.toLocaleString()}</div>
          <div className="dk-l">Vật tư lines</div>
          <div className="dk-s">DA · PU · PVC · Vải</div>
        </div>
        <div className="dk dk-red">
          <div className="dk-v" style={{ color: 'var(--red)' }}>{stats.riskCount}</div>
          <div className="dk-l">Rủi ro</div>
          <div className="dk-s">{stats.warnCount} theo dõi</div>
        </div>
        <div className="dk dk-violet">
          <div className="dk-v" style={{ color: 'var(--violet)' }}>{stats.materialPOCount}</div>
          <div className="dk-l">PO vật liệu</div>
          <div className="dk-s">{stats.supplierCount} nhà cung cấp</div>
        </div>
        <div className="dk dk-amber">
          <div className="dk-v" style={{ color: stats.overduePO > 0 ? 'var(--red)' : 'var(--amber)' }}>{stats.samplePOCount}</div>
          <div className="dk-l">PO Hàng Mẫu</div>
          <div className="dk-s">{stats.overduePO > 0 ? `${stats.overduePO} quá hạn` : 'on track'}</div>
        </div>
        <div className="dk dk-green">
          <div className="dk-v" style={{ color: 'var(--green)' }}>{stats.shippingCount}</div>
          <div className="dk-l">Shipments</div>
          <div className="dk-s">{stats.inTransitCount} đang về</div>
        </div>
      </div>

      {/* Recharts Graphics */}
      {hasData && (
        <div className="dash-2col" style={{ marginBottom: '12px' }}>
          <div className="dash-card" style={{ padding: '16px', minHeight: '300px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--txt2)', marginBottom: '10px' }}>
              📊 Top 5 NCC theo sản lượng (Đặt hàng vs Nhập kho)
            </div>
            <div style={{ width: '100%', height: '240px' }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={chartSupplierData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--brd)" />
                  <XAxis dataKey="name" stroke="var(--txt3)" style={{ fontSize: 9 }} />
                  <YAxis stroke="var(--txt3)" style={{ fontSize: 9 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--s3)', borderColor: 'var(--brd)', color: 'var(--txt)' }}
                    labelStyle={{ fontWeight: 'bold' }} 
                  />
                  <Bar dataKey="ordered" name="Đặt hàng" fill="var(--acc2)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="received" name="Đã nhận" fill="var(--acc)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="dash-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--txt2)', marginBottom: '10px' }}>
              🔴 Tỷ lệ rủi ro của các đơn sản xuất
            </div>
            {chartRiskData.length > 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
                <div style={{ width: '150px', height: '150px' }}>
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <PieChart>
                      <Pie
                        data={chartRiskData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {chartRiskData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginLeft: '20px' }}>
                  {chartRiskData.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                      <span style={{ width: '10px', height: '10px', backgroundColor: d.color, borderRadius: '2px' }}></span>
                      <span>{d.name}: <strong>{d.value} đơn ({((d.value / coordData.length) * 100).toFixed(0)}%)</strong></span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--txt3)' }}>
                Chưa có dữ liệu phân tích rủi ro
              </div>
            )}
          </div>
        </div>
      )}

      {/* Split lists */}
      <div className="dash-2col">
        <div className="dash-card">
          <div className="dash-card-hd">
            <div className="dash-card-title">
              ⚠ Rủi ro sản xuất {stats.riskCount > 0 && <span className="sb-bdg red" style={{ display: 'inline', marginLeft: '6px' }}>{stats.riskCount}</span>}
            </div>
            <button className="btn btn-g btn-sm" onClick={() => onNavigate('alerts')}>Xem tất cả →</button>
          </div>
          <div style={{ padding: '6px 0' }}>
            {riskOrders.length > 0 ? (
              <>
                {riskOrders.map((o, idx) => {
                  const factoryClass = o.factory === '二厂' ? 'chip-二厂' : o.factory === '三厂' ? 'chip-三厂' : o.factory === '四厂' ? 'chip-四厂' : 'chip-五厂板房';
                  const rMats = o.mats.filter(m => ['risk', 'warn'].includes(calcMatRisk(m, o.line_up_date)));
                  return (
                    <div key={idx} className="qi" onClick={() => onNavigate('alerts')}>
                      <span className="qi-ico">🔴</span>
                      <div>
                        <div className="qi-title">{o.order_id} — {o.shoe_name || '—'}</div>
                        <div className="qi-sub">
                          <span className={`fac-chip ${factoryClass}`} style={{ fontSize: '9px' }}>{o.factory}</span>
                          &nbsp;·&nbsp;LC: {o.line_up_str}&nbsp;·&nbsp;{rMats.length} vật tư rủi ro
                        </div>
                      </div>
                      <span className="qi-badge" style={{ color: 'var(--red)' }}>{rMats.length}</span>
                    </div>
                  );
                })}
                <div onClick={() => onNavigate('alerts')} style={{ textAlign: 'center', padding: '8px', fontSize: '11px', color: 'var(--txt3)', cursor: 'pointer' }}>
                  Xem tất cả {stats.riskCount} cảnh báo →
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', fontSize: '11px', color: 'var(--txt3)' }}>
                {prodOrders.length > 0 ? '✅ Không có rủi ro sản xuất' : 'Import dữ liệu để xem rủi ro'}
              </div>
            )}
          </div>
        </div>
        
        <div>
          {/* Follow up summary */}
          <div className="dash-card" style={{ marginBottom: '10px' }}>
            <div className="dash-card-hd">
              <div className="dash-card-title">📋 Follow Up NCC</div>
              <button className="btn btn-g btn-sm" onClick={() => onNavigate('followup')}>→</button>
            </div>
            <div style={{ padding: '7px 14px' }}>
              {followUpSummary.length > 0 ? (
                followUpSummary.map((s, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: '1px solid var(--brd)' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, flex: 1, color: 'var(--acc)' }}>{s.name}</span>
                    <span style={{ fontSize: '10px', color: 'var(--txt3)' }}>{s.pos.size} PO</span>
                    <div style={{ width: '60px', height: '4px', backgroundColor: 'var(--brd)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${s.pct}%`, height: '100%', backgroundColor: s.pct >= 100 ? 'var(--green)' : s.pct > 50 ? 'var(--amber)' : 'var(--red)' }}></div>
                    </div>
                    <span className="mono" style={{ fontSize: '10px', minWidth: '32px', textAlign: 'right', color: s.pct >= 100 ? 'var(--green)' : 'var(--txt2)' }}>
                      {s.pct.toFixed(0)}%
                    </span>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '14px', fontSize: '11px', color: 'var(--txt3)' }}>
                  Import Material Tracking
                </div>
              )}
            </div>
          </div>
          
          {/* PO summary */}
          <div className="dash-card">
            <div className="dash-card-hd">
              <div className="dash-card-title">📦 PO Tracking — Mẫu</div>
              <button className="btn btn-g btn-sm" onClick={() => onNavigate('po')}>→</button>
            </div>
            <div style={{ padding: '7px 14px' }}>
              {poSummary.length > 0 ? (
                poSummary.map(([s, n], idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--brd)' }}>
                    {renderPOStatusBadge(s)}
                    <span className="mono" style={{ fontSize: '11px', fontWeight: 600 }}>{n}</span>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '14px', fontSize: '11px', color: 'var(--txt3)' }}>
                  Chưa có PO hàng mẫu
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
