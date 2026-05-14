'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts';
import styles from './page.module.css';

// ── Configuración ─────────────────────────────────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtCLP  = n => { if (!n) return '$0'; if (n>=1e6) return `$${(n/1e6).toFixed(1)}M`; if (n>=1e3) return `$${(n/1e3).toFixed(0)}K`; return `$${Math.round(n).toLocaleString('es-CL')}`; };
const fmtFull = n => `$${Math.round(n||0).toLocaleString('es-CL')}`;
const fmtN    = n => Math.round(n||0).toLocaleString('es-CL');

function sheetUrl(name) {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`;
}

// Parse CSV text → array of arrays
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

// Parse monto string → number
function parseMonto(s) {
  if (!s) return 0;
  const n = parseFloat(String(s).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

// Parse a single sheet's CSV rows → data rows
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

export default function Dashboard() { return null; }
