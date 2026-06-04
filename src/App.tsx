import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { ScheduleImport } from './components/ScheduleImport';
import { MaterialTracking } from './components/MaterialTracking';
import { Alerts } from './components/Alerts';
import { FollowUp } from './components/FollowUp';
import { POTracking } from './components/POTracking';
import { Auth } from './components/Auth';
import { ProductionOrder, MaterialLine, POData, Shipment, DBStoreMeta, CoordOrder } from './types';
import { loadAppState, saveAppState } from './db';
import { calcMatRisk, stripSuffix } from './utils';
import { supabase, fetchPODataFromCloud } from './supabase';
import { Session } from '@supabase/supabase-js';

export const App: React.FC = () => {
  const [activePage, setActivePage] = useState<string>('dash');
  const [prodOrders, setProdOrders] = useState<ProductionOrder[]>([]);
  const [matLines, setMatLines] = useState<MaterialLine[]>([]);
  const [matLines2, setMatLines2] = useState<MaterialLine[]>([]);
  const [poData, setPoData] = useState<POData[]>([]);
  const [shpData, setShpData] = useState<Shipment[]>([]);
  const [meta, setMeta] = useState<DBStoreMeta | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Monitor Supabase Auth Session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsAuthChecking(false);
    }).catch(() => {
      setIsAuthChecking(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setIsAuthChecking(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Listen to Supabase Postgres changes for realtime PO sync
  useEffect(() => {
    if (!session) return;

    const channel = supabase
      .channel('po_tracking_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'po_tracking_samples' },
        async (payload) => {
          console.log('Realtime change detected in Supabase:', payload);
          const data = await fetchPODataFromCloud();
          if (data) {
            setPoData(data);
            triggerToast('⚡ Đã cập nhật PO thời gian thực từ đám mây.');
            // Save updated state to IndexedDB
            await saveAppState(prodOrders, matLines, matLines2, data, shpData);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, prodOrders, matLines, matLines2, shpData]);
  
  // Toast notifications state
  const [toastMsg, setToastMsg] = useState('');
  const [showToast, setShowToast] = useState(false);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // Load app state from DB initially
  useEffect(() => {
    const init = async () => {
      try {
        const state = await loadAppState();
        if (state.prodOrders.length > 0) setProdOrders(state.prodOrders);
        if (state.matLines.length > 0) setMatLines(state.matLines);
        if (state.matLines2.length > 0) setMatLines2(state.matLines2);
        if (state.poData.length > 0) setPoData(state.poData);
        if (state.shpData.length > 0) setShpData(state.shpData);
        setMeta(state.meta);
        
        if (state.prodOrders.length > 0 || state.matLines.length > 0 || state.poData.length > 0) {
          triggerToast('✓ Đã tải dữ liệu từ cache offline.');
        }
      } catch (err) {
        console.error('IndexedDB loading error:', err);
      }
    };
    init();
  }, []);

  // Save changes wrapper
  const handleSaveData = async (
    prod: ProductionOrder[],
    m1: MaterialLine[],
    m2: MaterialLine[]
  ) => {
    try {
      await saveAppState(prod, m1, m2, poData, shpData);
      setMeta({
        savedAt: Date.now(),
        prod: prod.length,
        mat: m1.length,
        mat2: m2.length,
        po: poData.length,
        shp: shpData.length
      });
    } catch (err) {
      console.error('Error saving state:', err);
    }
  };

  const handleSavePOSettings = async (po: POData[], shp: Shipment[]) => {
    try {
      await saveAppState(prodOrders, matLines, matLines2, po, shp);
      setMeta({
        savedAt: Date.now(),
        prod: prodOrders.length,
        mat: matLines.length,
        mat2: matLines2.length,
        po: po.length,
        shp: shp.length
      });
    } catch (err) {
      console.error('Error saving state:', err);
    }
  };

  // Joined/Coordination data builder
  const coordData: CoordOrder[] = useMemo(() => {
    const allMat = [...matLines, ...matLines2];
    if (prodOrders.length === 0 || allMat.length === 0) return [];
    
    // Map of normalized order numbers to their material lines
    const matMap: Record<string, MaterialLine[]> = {};
    allMat.forEach(m => {
      const key = m.order_no;
      if (!matMap[key]) matMap[key] = [];
      matMap[key].push(m);
    });

    const seenOrders = new Set<string>();
    const orders: CoordOrder[] = [];

    prodOrders.forEach(o => {
      const key = `${o.order_id_norm}|${o.line_up_str}`;
      if (seenOrders.has(key)) return;
      seenOrders.add(key);

      const mats = matMap[o.order_id_norm] || [];
      let worstRisk: 'ok' | 'warn' | 'risk' | 'stocked' | 'no-mat' = 'ok';
      let riskMats = 0;
      let warnMats = 0;
      let okMats = 0;
      let stockedMats = 0;
      
      let latestEta: Date | null = null;
      let latestEtd: Date | null = null;

      mats.forEach(m => {
        const risk = calcMatRisk(m, o.line_up_date);
        if (risk === 'risk') {
          riskMats++;
          worstRisk = 'risk';
        } else if (risk === 'warn' && worstRisk !== 'risk') {
          warnMats++;
          worstRisk = 'warn';
        } else if (risk === 'stocked') {
          stockedMats++;
        } else if (risk === 'ok') {
          okMats++;
        }
        
        if (m.eta) {
          if (!latestEta || m.eta > latestEta) latestEta = m.eta;
        }
        if (m.etd) {
          if (!latestEtd || m.etd > latestEtd) latestEtd = m.etd;
        }
      });

      if (mats.length === 0) worstRisk = 'no-mat';
      
      orders.push({
        ...o,
        mats,
        worst_risk: worstRisk,
        risk_mats: riskMats,
        warn_mats: warnMats,
        ok_mats: okMats,
        stocked_mats: stockedMats,
        latest_eta: latestEta,
        latest_etd: latestEtd
      });
    });

    return orders;
  }, [prodOrders, matLines, matLines2]);

  const handleBuildCoordination = () => {
    triggerToast('⚙ Đang đối chiếu Lịch LC & Material Tracking...');
    setActivePage('coord');
  };

  const riskOrdersN = useMemo(() => {
    return coordData.filter(o => ['risk', 'warn'].includes(o.worst_risk)).length;
  }, [coordData]);

  const allMatLinesLength = matLines.length + matLines2.length;
  const uniqueMaterialPOs = useMemo(() => {
    const all = [...matLines, ...matLines2];
    return new Set(all.map(m => m.po_no).filter(Boolean)).size;
  }, [matLines, matLines2]);

  if (isAuthChecking) {
    return (
      <div style={{ display: 'flex', width: '100vw', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--txt2)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div className="spinner" style={{ width: '28px', height: '28px', border: '3px solid rgba(0, 212, 170, 0.1)', borderTopColor: 'var(--acc)', borderRadius: '50%' }}></div>
          <span style={{ fontSize: '11px', fontFamily: 'var(--mono)', letterSpacing: '0.8px', color: 'var(--txt3)' }}>ĐANG KIỂM TRA PHIÊN...</span>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="shell">
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        meta={meta}
        prodCount={prodOrders.length}
        coordCount={coordData.length}
        alertsCount={riskOrdersN}
        fuCount={uniqueMaterialPOs}
        poCount={poData.length}
        userEmail={session.user?.email}
        onSignOut={() => supabase.auth.signOut()}
      />
      
      <div className="main">
        <div className="page-area">
          {activePage === 'dash' && (
            <Dashboard
              prodOrders={prodOrders}
              matLines={matLines}
              matLines2={matLines2}
              coordData={coordData}
              poData={poData}
              shpData={shpData}
              onNavigate={setActivePage}
            />
          )}

          {activePage === 'schedule' && (
            <ScheduleImport
              prodOrders={prodOrders}
              setProdOrders={setProdOrders}
              matLines={matLines}
              setMatLines={setMatLines}
              matLines2={matLines2}
              setMatLines2={setMatLines2}
              meta={meta}
              saveData={handleSaveData}
              buildCoordination={handleBuildCoordination}
            />
          )}

          {activePage === 'coord' && (
            <MaterialTracking coordData={coordData} />
          )}

          {activePage === 'alerts' && (
            <Alerts coordData={coordData} />
          )}

          {activePage === 'followup' && (
            <FollowUp matLines={matLines} matLines2={matLines2} />
          )}

          {activePage === 'po' && (
            <POTracking
              poData={poData}
              setPoData={setPoData}
              shpData={shpData}
              setShpData={setShpData}
              saveData={handleSavePOSettings}
              triggerToast={triggerToast}
            />
          )}
        </div>
      </div>

      {/* Global Toast Message */}
      <div className={`toast ${showToast ? 'show' : ''}`} id="toast">
        {toastMsg}
      </div>
    </div>
  );
};

export default App;
