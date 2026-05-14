'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts';
import styles from './page.module.css';

const SHEET_ID = '1dvMmTMgiCGiF_1P_f9LhzfaTFCvuy2qa7O2lJ6C8pxc';

const SHEETS = [
  { name: 'JUN 25', mes: 6,  anio: 2025 },
  { name: 'JUL 25', mes: 7,  anio: 2025 },
  { name: 'AGO 25', mes: 8,  anio: 2025 },
  { name: 'SEP 25', mes: 9,  anio: 2025 },
  { name: 'OCT 25', mes: 10, anio: 2025 },
  { name: 'NOV 25', mes: 11, anio: 2025 },
  { name: 'DIC 25', mes: 12, anio: 2025 },
  { name: 'ENE 26', mes: 1,  anio: 2026 },
  { name: 'FEB 26', mes: 2,  anio: 2026 },
  { name: 'MAR 26', mes: 3,  anio: 2026 },
  { name: 'ABR 26', mes: 4,  anio: 2026 },
  { name: 'MAY 26', mes: 5,  anio: 2026 },
  { name: 'JUN 26', mes: 6,  anio: 2026 },
  { name: 'JUL 26', mes: 7,  anio: 2026 },
  { name: 'AGO 26', mes: 8,  anio: 2026 },
  { name: 'SEP 26', mes: 9,  anio: 2026 },
  { name: 'OCT 26', mes: 10, anio: 2026 },
  { name: 'NOV 26', mes: 11, anio: 2026 },
  { name: 'DIC 26', mes: 12, anio: 2026 },
];

const MES_NAMES = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MES_FULL  = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const SKIP      = new Set(['CC','CLIENTE','TOTAL','TOTAL FACTURA','','NONE','NULL']);
const COLORS    = ['#7C3AED','#2563EB','#059669','#D97706','#DC2626','#8B5CF6','#0EA5E9','#10B981'];

const fmtCLP  = n => { if (!n) return '$0'; if (n>=1e6) return `$${(n/1e6).toFixed(1)}M`; if (n>=1e3) return `$${(n/1e3).toFixed(0)}K`; return `$${Math.round(n).toLocaleString('es-CL')}`; };
const fmtFull = n => `$${Math.round(n||0).toLocaleString('es-CL')}`;
const fmtN    = n => Math.round(n||0).toLocaleString('es-CL');

function sheetUrl(name) {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`;
}

function parseCSV(text) {
  const rows = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const cells = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQ = !inQ; }
      else if (c === ',' && !inQ) { cells.push(cur.trim()); cur = ''; }
      else { cur += c; }
    }
    cells.push(cur.trim());
    rows.push(cells);
  }
  return rows;
}

function parseMonto(s) {
  if (!s) return 0;
  const n = parseFloat(String(s).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function parseSheet(csvText, mes, anio) {
  const rows = parseCSV(csvText);
  const result = [];
  for (const row of rows) {
    if (row.length < 6) continue;
    const [cc, cliente, trabajador, dcmto, fechaRaw, montoRaw] = row;
    const ccS   = cc.replace(/^"|"$/g,'').trim();
    const cliS  = cliente.replace(/^"|"$/g,'').trim();
    const trabS = trabajador.replace(/^"|"$/g,'').trim();
    const dcmS  = dcmto.replace(/^"|"$/g,'').trim();
    const monto = parseMonto(montoRaw);
    if (!ccS || !cliS || !trabS) continue;
    if (SKIP.has(ccS.toUpperCase()) || SKIP.has(cliS.toUpperCase())) continue;
    if (monto <= 0) continue;
    let fecha = `${anio}-${String(mes).padStart(2,'0')}-01`;
    const fStr = fechaRaw.replace(/^"|"$/g,'').trim();
    const m1 = fStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    const m2 = fStr.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (m1) fecha = `${m1[3]}-${m1[1].padStart(2,'0')}-${m1[2].padStart(2,'0')}`;
    else if (m2) fecha = `${m2[1]}-${m2[2].padStart(2,'0')}-${m2[3].padStart(2,'0')}`;
    result.push({ mes, anio, cc: ccS, cliente: cliS, trabajador: trabS, dcmto: dcmS, fecha, monto });
  }
  return result;
}

function aggregate(rows) {
  const map = {};
  for (const r of rows) {
    const k = `${r.anio}-${String(r.mes).padStart(2,'0')}`;
    if (!map[k]) map[k] = { anio:r.anio, mes:r.mes,
      label:`${MES_NAMES[r.mes]} ${r.anio}`, viajes:0, monto:0,
      trabajadores:new Set(), clientes:new Set(), relaciones:new Set() };
    map[k].viajes++;
    map[k].monto += r.monto;
    map[k].trabajadores.add(r.trabajador);
    map[k].clientes.add(r.cliente);
    map[k].relaciones.add(r.cc);
  }
  return Object.values(map)
    .sort((a,b) => a.anio !== b.anio ? a.anio-b.anio : a.mes-b.mes)
    .map(m => ({ ...m, trabajadores:m.trabajadores.size, clientes:m.clientes.size, relaciones:m.relaciones.size }));
}

const CustomTooltip = ({ active, payload, label, isMoney }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:8,
                  padding:'10px 14px', boxShadow:'0 4px 12px rgba(0,0,0,0.1)', fontSize:13 }}>
      <p style={{ fontWeight:600, marginBottom:6, color:'#111827' }}>{label}</p>
      {payload.map((p,i) => (
        <p key={i} style={{ color:p.color, margin:'2px 0' }}>
          {p.name}: <strong>{isMoney ? fmtFull(p.value) : fmtN(p.value)}</strong>
        </p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const [allRows, setAllRows]           = useState([]);
  const [loading, setLoading]           = useState(false);
  const [loadProgress, setLoadProgress] = useState({ done: 0, total: SHEETS.length });
  const [error, setError]               = useState(null);
  const [filterYear, setFilterYear]     = useState('all');
  const [filterMonth, setFilterMonth]   = useState('all');
  const [activeTab, setActiveTab]       = useState('resumen');
  const [lastFetch, setLastFetch]       = useState(null);

  const fetchAllSheets = useCallback(async () => {
    setLoading(true); setError(null);
    setLoadProgress({ done: 0, total: SHEETS.length });
    const rows = []; let done = 0;
    for (const sheet of SHEETS) {
      try {
        const res = await fetch(sheetUrl(sheet.name));
        if (!res.ok) { done++; setLoadProgress({ done, total: SHEETS.length }); continue; }
        const text = await res.text();
        if (text.includes('<!DOCTYPE') || text.includes('errorMessage')) {
          done++; setLoadProgress({ done, total: SHEETS.length }); continue;
        }
        rows.push(...parseSheet(text, sheet.mes, sheet.anio));
      } catch (e) {}
      done++; setLoadProgress({ done, total: SHEETS.length });
    }
    if (rows.length === 0) setError('No se pudieron cargar datos. Verifica que el Google Sheets sea público.');
    setAllRows(rows); setLastFetch(new Date()); setLoading(false);
  }, []);

  useEffect(() => { fetchAllSheets(); }, [fetchAllSheets]);

  const years    = [...new Set(allRows.map(r => r.anio))].sort();
  const filtered = allRows.filter(r =>
    (filterYear  === 'all' || r.anio === +filterYear) &&
    (filterMonth === 'all' || r.mes  === +filterMonth)
  );
  const monthly = aggregate(filterYear === 'all' ? allRows : allRows.filter(r => r.anio === +filterYear));

  const totalMonto   = filtered.reduce((a,r) => a+r.monto, 0);
  const totalViajes  = filtered.length;
  const trabajadores = new Set(filtered.map(r => r.trabajador)).size;
  const relaciones   = new Set(filtered.map(r => r.cc)).size;
  const clientes     = new Set(filtered.map(r => r.cliente)).size;
  const avgTicket    = totalViajes > 0 ? totalMonto/totalViajes : 0;

  const byCliente = {};
  filtered.forEach(r => {
    if (!byCliente[r.cliente]) byCliente[r.cliente] = { viajes:0, monto:0 };
    byCliente[r.cliente].viajes++; byCliente[r.cliente].monto += r.monto;
  });
  const topClientes = Object.entries(byCliente).sort((a,b) => b[1].monto-a[1].monto).slice(0,10);

  const byTrab = {};
  filtered.forEach(r => {
    if (!byTrab[r.trabajador]) byTrab[r.trabajador] = { viajes:0, monto:0 };
    byTrab[r.trabajador].viajes++; byTrab[r.trabajador].monto += r.monto;
  });
  const topTrab  = Object.entries(byTrab).sort((a,b) => b[1].monto-a[1].monto).slice(0,10);
  const pieData  = topClientes.slice(0,6).map(([name,v]) => ({ name, value: v.monto }));

  const kpis = [
    { label:'Total gastado',   value:fmtFull(totalMonto), sub:fmtCLP(totalMonto),                color:'#7C3AED', bg:'#EDE9FE', icon:'💳' },
    { label:'Viajes',          value:fmtN(totalViajes),   sub:`Prom. ${fmtCLP(avgTicket)}/viaje`, color:'#2563EB', bg:'#DBEAFE', icon:'🚗' },
    { label:'Trabajadores',    value:fmtN(trabajadores),  sub:'activos en período',               color:'#059669', bg:'#D1FAE5', icon:'👤' },
    { label:'Relaciones (CC)', value:fmtN(relaciones),    sub:'CCs facturados',                   color:'#D97706', bg:'#FEF3C7', icon:'🔗' },
    { label:'Clientes',        value:fmtN(clientes),      sub:'cuentas distintas',                color:'#DC2626', bg:'#FEE2E2', icon:'🏢' },
  ];

  if (loading) {
    const pct = Math.round((loadProgress.done / loadProgress.total) * 100);
    return (
      <div className={styles.loadingWrap}>
        <div className={styles.loadingBox}>
          <div className={styles.loadingLogo}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="white" fillOpacity="0.9"/>
              <circle cx="12" cy="9" r="2.5" fill="#7C3AED"/>
            </svg>
          </div>
          <h2 className={styles.loadingTitle}>Cargando datos de Cabify</h2>
          <p className={styles.loadingSub}>Leyendo hojas del Google Sheets… {loadProgress.done}/{loadProgress.total}</p>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${pct}%` }} />
          </div>
          <p className={styles.progressPct}>{pct}%</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.loadingWrap}>
        <div className={styles.loadingBox}>
          <div style={{ fontSize:48, marginBottom:16 }}>⚠️</div>
          <h2 className={styles.loadingTitle}>Error al cargar datos</h2>
          <p className={styles.loadingSub} style={{ color:'#DC2626' }}>{error}</p>
          <button className={styles.retryBtn} onClick={fetchAllSheets}>Reintentar</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>

      <header className={styles.header}>
        <div className={styles.logoWrap}>
          <div className={styles.logo}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="white" fillOpacity="0.9"/>
              <circle cx="12" cy="9" r="2.5" fill="#7C3AED"/>
            </svg>
          </div>
          <div>
            <h1 className={styles.title}>Dashboard Cabify</h1>
            <p className={styles.subtitle}>
              {lastFetch ? `Actualizado ${lastFetch.toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric'})} ${lastFetch.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'})}` : 'Cargando…'}
              {' · '}{fmtN(allRows.length)} viajes totales
            </p>
          </div>
        </div>
        <div className={styles.headerRight}>
          <button className={styles.refreshBtn} onClick={fetchAllSheets}>↻ Actualizar</button>
        </div>
      </header>

      <div className={styles.toolbar}>
        <select className={styles.select} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
          <option value="all">Todos los años</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select className={styles.select} value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
          <option value="all">Todos los meses</option>
          {Array.from({length:12},(_,i) => (<option key={i+1} value={i+1}>{MES_FULL[i+1]}</option>))}
        </select>
        {(filterYear !== 'all' || filterMonth !== 'all') && (
          <button className={styles.clearBtn} onClick={() => { setFilterYear('all'); setFilterMonth('all'); }}>
            ✕ Limpiar filtros
          </button>
        )}
        <span className={styles.resultCount}>{fmtN(filtered.length)} viajes</span>
      </div>

      <div className={styles.kpiGrid}>
        {kpis.map(k => (
          <div key={k.label} className={styles.kpiCard} style={{ borderTop:`3px solid ${k.color}` }}>
            <div className={styles.kpiHeader}>
              <span className={styles.kpiIcon} style={{ background:k.bg }}>{k.icon}</span>
              <span className={styles.kpiLabel}>{k.label}</span>
            </div>
            <div className={styles.kpiValue} style={{ color:k.color }}>{k.value}</div>
            <div className={styles.kpiSub}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div className={styles.tabs}>
        {['resumen','clientes','trabajadores','detalle'].map(t => (
          <button key={t} className={`${styles.tab} ${activeTab===t ? styles.tabActive : ''}`}
                  onClick={() => setActiveTab(t)}>
            {t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'resumen' && (
        <div className={styles.tabContent}>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Gasto mensual (CLP)</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthly} margin={{top:5,right:10,left:10,bottom:5}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6"/>
                <XAxis dataKey="label" tick={{fontSize:11,fill:'#9CA3AF'}}/>
                <YAxis tickFormatter={fmtCLP} tick={{fontSize:11,fill:'#9CA3AF'}} width={62}/>
                <Tooltip content={<CustomTooltip isMoney/>}/>
                <Bar dataKey="monto" name="Total" fill="#7C3AED" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className={styles.grid2}>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Viajes por mes</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthly} margin={{top:5,right:10,left:0,bottom:5}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6"/>
                  <XAxis dataKey="label" tick={{fontSize:10,fill:'#9CA3AF'}}/>
                  <YAxis tick={{fontSize:10,fill:'#9CA3AF'}} width={28}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Bar dataKey="viajes" name="Viajes" fill="#2563EB" radius={[3,3,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Trabajadores · Clientes · Relaciones</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={monthly} margin={{top:5,right:10,left:0,bottom:5}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6"/>
                  <XAxis dataKey="label" tick={{fontSize:10,fill:'#9CA3AF'}}/>
                  <YAxis tick={{fontSize:10,fill:'#9CA3AF'}} width={25}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{fontSize:11,paddingTop:8}}/>
                  <Line type="monotone" dataKey="trabajadores" name="Trabajadores" stroke="#059669" strokeWidth={2} dot={{r:3}}/>
                  <Line type="monotone" dataKey="clientes"     name="Clientes"     stroke="#DC2626" strokeWidth={2} dot={{r:3}}/>
                  <Line type="monotone" dataKey="relaciones"   name="Relaciones"   stroke="#D97706" strokeWidth={2} dot={{r:3}} strokeDasharray="4 2"/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Resumen por mes</h3>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr>{['Período','Total (CLP)','Viajes','Ticket prom.','Trabajadores','Relaciones','Clientes'].map(h=><th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {monthly.map((m,i) => (
                    <tr key={i}>
                      <td><strong>{MES_FULL[m.mes]} {m.anio}</strong></td>
                      <td className={styles.money}>{fmtFull(m.monto)}</td>
                      <td>{fmtN(m.viajes)}</td>
                      <td>{fmtCLP(m.monto/m.viajes)}</td>
                      <td><span className={styles.pill} style={{background:'#D1FAE5',color:'#065F46'}}>{m.trabajadores}</span></td>
                      <td><span className={styles.pill} style={{background:'#FEF3C7',color:'#92400E'}}>{m.relaciones}</span></td>
                      <td><span className={styles.pill} style={{background:'#DBEAFE',color:'#1E40AF'}}>{m.clientes}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'clientes' && (
        <div className={styles.tabContent}>
          <div className={styles.grid2}>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Distribución por cliente</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} paddingAngle={2}
                       label={({name,percent}) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                    {pieData.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                  </Pie>
                  <Tooltip formatter={v => fmtFull(v)}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Gasto por cliente</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topClientes.map(([name,v])=>({name,monto:v.monto}))} layout="vertical" margin={{left:80,right:20}}>
                  <XAxis type="number" tickFormatter={fmtCLP} tick={{fontSize:10,fill:'#9CA3AF'}}/>
                  <YAxis type="category" dataKey="name" tick={{fontSize:11,fill:'#374151'}} width={80}/>
                  <Tooltip content={<CustomTooltip isMoney/>}/>
                  <Bar dataKey="monto" name="Monto" fill="#7C3AED" radius={[0,4,4,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Detalle por cliente</h3>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr>{['#','Cliente','Viajes','Monto total','% del total','Ticket prom.'].map(h=><th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {topClientes.map(([cli,v],i) => {
                    const pct = totalMonto>0 ? v.monto/totalMonto*100 : 0;
                    return (
                      <tr key={i}>
                        <td style={{color:'#9CA3AF',width:30}}>{i+1}</td>
                        <td><strong>{cli}</strong></td>
                        <td>{fmtN(v.viajes)}</td>
                        <td className={styles.money}>{fmtFull(v.monto)}</td>
                        <td><div className={styles.barWrap}><div className={styles.barFill} style={{width:`${Math.min(pct,100)}%`,background:COLORS[i%COLORS.length]}}/><span>{pct.toFixed(1)}%</span></div></td>
                        <td>{fmtCLP(v.monto/v.viajes)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'trabajadores' && (
        <div className={styles.tabContent}>
          <div className={styles.grid2}>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Viajes por trabajador</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topTrab.map(([name,v])=>({name:name.split(' ')[0],viajes:v.viajes}))} layout="vertical" margin={{left:70,right:20}}>
                  <XAxis type="number" tick={{fontSize:10,fill:'#9CA3AF'}}/>
                  <YAxis type="category" dataKey="name" tick={{fontSize:11,fill:'#374151'}} width={70}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Bar dataKey="viajes" name="Viajes" fill="#059669" radius={[0,4,4,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Monto por trabajador</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topTrab.map(([name,v])=>({name:name.split(' ')[0],monto:v.monto}))} layout="vertical" margin={{left:70,right:20}}>
                  <XAxis type="number" tickFormatter={fmtCLP} tick={{fontSize:10,fill:'#9CA3AF'}}/>
                  <YAxis type="category" dataKey="name" tick={{fontSize:11,fill:'#374151'}} width={70}/>
                  <Tooltip content={<CustomTooltip isMoney/>}/>
                  <Bar dataKey="monto" name="Monto" fill="#7C3AED" radius={[0,4,4,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Detalle por trabajador</h3>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr>{['#','Trabajador','Viajes','Monto total','% del total','Ticket prom.'].map(h=><th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {topTrab.map(([trab,v],i) => {
                    const pct = totalMonto>0 ? v.monto/totalMonto*100 : 0;
                    const initials = trab.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
                    return (
                      <tr key={i}>
                        <td style={{color:'#9CA3AF',width:30}}>{i+1}</td>
                        <td>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <div style={{width:28,height:28,borderRadius:'50%',background:'#EDE9FE',color:'#7C3AED',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,flexShrink:0}}>
                              {initials}
                            </div>
                            <strong>{trab}</strong>
                          </div>
                        </td>
                        <td>{fmtN(v.viajes)}</td>
                        <td className={styles.money}>{fmtFull(v.monto)}</td>
                        <td><div className={styles.barWrap}><div className={styles.barFill} style={{width:`${Math.min(pct,100)}%`,background:'#059669'}}/><span>{pct.toFixed(1)}%</span></div></td>
                        <td>{fmtCLP(v.monto/v.viajes)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'detalle' && (
        <div className={styles.tabContent}>
          <div className={styles.card}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
              <h3 className={styles.cardTitle} style={{marginBottom:0}}>Detalle de viajes</h3>
              <span className={styles.pill} style={{background:'#DBEAFE',color:'#1E40AF',fontSize:12}}>
                {fmtN(filtered.length)} registros
              </span>
            </div>
            <div className={styles.tableWrap} style={{maxHeight:520}}>
              <table className={styles.table}>
                <thead><tr>{['Fecha','CC','Cliente','Trabajador','Tipo','Monto'].map(h=><th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {filtered.slice(0,500).map((r,i) => (
                    <tr key={i}>
                      <td style={{whiteSpace:'nowrap',color:'#6B7280'}}>{r.fecha}</td>
                      <td style={{fontFamily:'monospace',fontSize:12,color:'#6B7280'}}>{r.cc}</td>
                      <td><strong>{r.cliente}</strong></td>
                      <td>{r.trabajador}</td>
                      <td>
                        <span className={styles.pill} style={{background:r.dcmto==='FX'?'#DBEAFE':'#D1FAE5',color:r.dcmto==='FX'?'#1E40AF':'#065F46'}}>
                          {r.dcmto||'—'}
                        </span>
                      </td>
                      <td className={styles.money}>{fmtFull(r.monto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length > 500 && (
                <p style={{textAlign:'center',padding:12,fontSize:12,color:'#9CA3AF'}}>
                  Mostrando 500 de {fmtN(filtered.length)} registros. Usa los filtros para acotar.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
