import React, { useEffect, useState } from 'react';
import { BarChart3, Link as LinkIcon, Calendar, AlertTriangle, ClipboardList, Package, Settings, LogOut, User } from 'lucide-react';
import { DBStoreMeta } from '../types';

interface SidebarProps {
  activePage: string;
  setActivePage: (p: string) => void;
  meta: DBStoreMeta | null;
  prodCount: number;
  coordCount: number;
  alertsCount: number;
  fuCount: number;
  poCount: number;
  userEmail?: string;
  onSignOut?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  setActivePage,
  meta,
  prodCount,
  coordCount,
  alertsCount,
  fuCount,
  poCount,
  userEmail,
  onSignOut
}) => {
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const tick = () => {
      const n = new Date();
      const D = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
      const day = D[n.getDay()];
      const date = String(n.getDate()).padStart(2, '0');
      const month = String(n.getMonth() + 1).padStart(2, '0');
      const year = n.getFullYear();
      const hours = String(n.getHours()).padStart(2, '0');
      const minutes = String(n.getMinutes()).padStart(2, '0');
      setTimeStr(`${day} ${date}/${month}/${year}\n${hours}:${minutes}`);
    };
    tick();
    const interval = setInterval(tick, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStorageText = () => {
    if (meta && meta.savedAt) {
      const d = new Date(meta.savedAt);
      const hrs = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `💾 ${meta.prod || 0} đơn · ${meta.mat || 0}+${meta.mat2 || 0} mat · ${meta.po || 0} PO · ${hrs}:${mins}`;
    }
    return 'Chưa có dữ liệu đã lưu';
  };

  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <div className="sb-logo">
          <div className="sb-mark">
            <Settings size={18} />
          </div>
          <div>
            <div className="sb-title">F26 Division</div>
            <div className="sb-div">Purchasing &amp; Production</div>
          </div>
        </div>
      </div>
      <div className="sb-nav">
        <div className="sb-sec">Tổng quan</div>
        <div
          className={`sb-item ${activePage === 'dash' ? 'active' : ''}`}
          onClick={() => setActivePage('dash')}
        >
          <span className="sb-ico"><BarChart3 size={14} /></span> Dashboard
        </div>
        
        <div className="sb-sec">Sản xuất</div>
        <div
          className={`sb-item ${activePage === 'coord' ? 'active' : ''}`}
          onClick={() => setActivePage('coord')}
        >
          <span className="sb-ico"><LinkIcon size={14} /></span> Material Tracking
          {coordCount > 0 && <span className="sb-bdg">{coordCount}</span>}
        </div>
        <div
          className={`sb-item ${activePage === 'schedule' ? 'active' : ''}`}
          onClick={() => setActivePage('schedule')}
        >
          <span className="sb-ico"><Calendar size={14} /></span> Lịch Lên Chuyền
          {prodCount > 0 && <span className="sb-bdg">{prodCount}</span>}
        </div>
        <div
          className={`sb-item ${activePage === 'alerts' ? 'active' : ''}`}
          onClick={() => setActivePage('alerts')}
        >
          <span className="sb-ico"><AlertTriangle size={14} /></span> Cảnh báo
          {alertsCount > 0 && <span className="sb-bdg red">{alertsCount}</span>}
        </div>
        
        <div className="sb-sec">Mua hàng</div>
        <div
          className={`sb-item ${activePage === 'followup' ? 'active' : ''}`}
          onClick={() => setActivePage('followup')}
        >
          <span className="sb-ico"><ClipboardList size={14} /></span> Follow Up NCC
          {fuCount > 0 && <span className="sb-bdg blue">{fuCount}</span>}
        </div>
        <div
          className={`sb-item ${activePage === 'po' ? 'active' : ''}`}
          onClick={() => setActivePage('po')}
        >
          <span className="sb-ico"><Package size={14} /></span> PO Tracking — Mẫu
          {poCount > 0 && <span className="sb-bdg">{poCount}</span>}
        </div>
      </div>
      <div className="sb-foot" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {userEmail && (
          <div className="sb-user" style={{ display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '8px', marginBottom: '4px' }}>
            <span style={{ color: 'var(--acc)', opacity: 0.8, display: 'flex', alignItems: 'center' }}><User size={13} /></span>
            <span style={{ fontSize: '11px', color: 'var(--txt2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }} title={userEmail}>
              {userEmail.split('@')[0]}
            </span>
            {onSignOut && (
              <button 
                type="button" 
                onClick={onSignOut} 
                className="btn btn-d btn-xs" 
                style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', padding: 0 }}
                title="Đăng xuất"
              >
                <LogOut size={11} />
              </button>
            )}
          </div>
        )}
        <div className="sb-clock">{timeStr}</div>
        <div className={`sb-storage ${meta ? 'ok' : ''}`}>{getStorageText()}</div>
      </div>
    </aside>
  );
};
