import React, { useMemo } from 'react';
import { AlertCircle, ShieldAlert } from 'lucide-react';
import { CoordOrder, MaterialLine } from '../types';
import { calcMatRisk, daysBetween, fDate } from '../utils';

interface AlertsProps {
  coordData: CoordOrder[];
}

export const Alerts: React.FC<AlertsProps> = ({ coordData }) => {
  const riskOrders = useMemo(() => {
    return coordData
      .filter(o => ['risk', 'warn'].includes(o.worst_risk))
      .sort((a, b) => (a.worst_risk === 'risk' ? 0 : 1) - (b.worst_risk === 'risk' ? 0 : 1));
  }, [coordData]);

  const getRiskLabel = (r: string) => {
    if (r === 'risk') return <span className="badge b-risk">🔴 Rủi ro</span>;
    return <span className="badge b-warn">🟡 Theo dõi</span>;
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

  return (
    <div className="page active" id="pg-alerts">
      <div className="topbar">
        <div className="pg-title">⚠ Cảnh báo rủi ro sản xuất</div>
        <span style={{ fontSize: '11px', color: 'var(--txt3)' }}>
          Phát hiện {riskOrders.length} sự cố ảnh hưởng lịch lên chuyền
        </span>
      </div>

      <div id="alerts-list">
        {riskOrders.map((o, idx) => {
          const factoryClass = o.factory === '二厂' ? 'chip-二厂' : o.factory === '三厂' ? 'chip-三厂' : o.factory === '四厂' ? 'chip-四厂' : 'chip-五厂+板房';
          const isRisk = o.worst_risk === 'risk';
          const delayedMats = o.mats.filter(m => ['risk', 'warn'].includes(calcMatRisk(m, o.line_up_date)));
          
          return (
            <div key={idx} className="al-card">
              <div className={`al-hd ${isRisk ? 'risk' : 'warn'}`}>
                <span className="mono" style={{ fontSize: '11px', color: 'var(--acc)' }}>{o.order_id}</span>
                <span className={`fac-chip ${factoryClass}`}>{o.factory}</span>
                <span style={{ fontSize: '13px', fontWeight: 600, flex: 1 }}>{o.shoe_name || '—'}</span>
                <span className="mono" style={{ fontSize: '11px', color: 'var(--acc2)' }}>LC: {o.line_up_str}</span>
                {getRiskLabel(o.worst_risk)}
              </div>
              <div className="al-bd">
                {delayedMats.map((m, mIdx) => {
                  const risk = calcMatRisk(m, o.line_up_date);
                  const gap = m.eta ? daysBetween(o.line_up_date, m.eta) : null;
                  const shortName = m.mat_en || m.mat_name.slice(0, 50);
                  const colorDisp = [m.color_en, m.color_cn].filter(Boolean).join(' / ');
                  
                  return (
                    <div key={mIdx} className="al-line">
                      <span className={`badge ${risk === 'risk' ? 'b-risk' : 'b-warn'}`} style={{ minWidth: '60px' }}>
                        {risk === 'risk' ? 'Rủi ro' : 'Theo dõi'}
                      </span>
                      {getMatTypeBadge(m.mat_type)}
                      <span className="al-mat">{shortName}</span>
                      <span style={{ color: 'var(--txt3)' }}>{colorDisp}</span>
                      <span className="mono" style={{ fontSize: '11px', color: gap !== null && gap < 0 ? 'var(--red)' : 'var(--amber)' }}>
                        ETA {fDate(m.eta)} · {gap !== null ? (gap < 0 ? `${gap}d` : `+${gap}d`) : '?'}
                      </span>
                      <span style={{ color: 'var(--txt3)', fontSize: '10px' }}>· NCC: {m.supplier || '?'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {riskOrders.length === 0 && (
        <div className="empty">
          <div className="empty-icon" style={{ color: 'var(--green)' }}><ShieldAlert size={48} /></div>
          <div className="empty-title">Không có rủi ro nào</div>
          <div className="empty-desc">Tất cả vật liệu dự kiến đều sẽ về kho trước ngày lên chuyền sản xuất.</div>
        </div>
      )}
    </div>
  );
};
