import React, { useEffect, useMemo, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseAnonKey) console.error("❌ Missing Supabase env vars. Check .env and RESTART npm start.");
const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "", {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    lock: (_name, _acquireTimeout, fn) => fn(),
  },
});

// ─── SEED DATA ────────────────────────────────────────────────────────────────
const INITIAL_EMPLOYEES = [
  { id:"E001", name:"Marcus Johnson", email:"marcus@company.com", password:"pass123", role:"hourly", position:"Cashier", department:"Retail", hourlyRate:18, salary:null, manager:false, active:true, startDate:"2023-03-15", phone:"555-0101", emergencyContact:"Lisa Johnson", emergencyPhone:"555-0102", address:"123 Main St, New York, NY", notes:"", tax:{filing:"Single",allowances:1,federal:22,state:6}, directDeposit:{bank:"Chase",routing:"021000021",account:"****4521",type:"Checking"}, timeOff:{vacation:80,sick:40,personal:16}, punchHistory:[{date:"2025-02-20",in:"08:02",out:"16:05",hours:8.05},{date:"2025-02-21",in:"08:00",out:"16:00",hours:8.0}], timeOffRequests:[{id:"TO001",type:"Vacation",start:"2025-03-10",end:"2025-03-14",status:"Pending",note:"Family trip"}], payStatements:[{period:"Feb 1-15, 2025",gross:1440,net:1123,date:"2025-02-20"},{period:"Jan 16-31, 2025",gross:1440,net:1123,date:"2025-02-05"}] },
  { id:"E002", name:"Sarah Chen", email:"sarah@company.com", password:"pass123", role:"salary", position:"Store Manager", department:"Management", hourlyRate:null, salary:75000, manager:true, active:true, startDate:"2021-06-01", phone:"555-0201", emergencyContact:"Mike Chen", emergencyPhone:"555-0202", address:"456 Oak Ave, Brooklyn, NY", notes:"Senior manager", tax:{filing:"Married",allowances:2,federal:22,state:6}, directDeposit:{bank:"Bank of America",routing:"026009593",account:"****8834",type:"Checking"}, timeOff:{vacation:120,sick:60,personal:24}, punchHistory:[], timeOffRequests:[], payStatements:[{period:"Feb 1-15, 2025",gross:3125,net:2341,date:"2025-02-20"}] },
  { id:"E003", name:"David Okafor", email:"david@company.com", password:"pass123", role:"hourly", position:"Warehouse Associate", department:"Operations", hourlyRate:20, salary:null, manager:false, active:true, startDate:"2022-11-20", phone:"555-0301", emergencyContact:"Grace Okafor", emergencyPhone:"555-0302", address:"789 Pine Rd, Queens, NY", notes:"", tax:{filing:"Single",allowances:0,federal:22,state:6}, directDeposit:{bank:"Wells Fargo",routing:"121000248",account:"****2209",type:"Savings"}, timeOff:{vacation:80,sick:40,personal:16}, punchHistory:[{date:"2025-02-20",in:"09:00",out:"17:30",hours:8.5}], timeOffRequests:[], payStatements:[{period:"Feb 1-15, 2025",gross:1600,net:1230,date:"2025-02-20"}] },
];
const ADMIN_CREDS = { email:"admin@company.com", password:"admin2025" };

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt = (n) => Number(n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtCurrency = (n) => `$${fmt(n)}`;
const today = () => new Date().toISOString().slice(0,10);
const timeNow = () => new Date().toLocaleTimeString("en-US",{hour12:false,hour:"2-digit",minute:"2-digit"});
const initials = (name) => (name||"").split(" ").filter(Boolean).map(n=>n[0]).join("").toUpperCase();
const calcHours = (a,b) => { const [ah,am]=(a||"00:00").split(":").map(Number); const [bh,bm]=(b||"00:00").split(":").map(Number); return Math.max(0,(bh*60+bm-(ah*60+am))/60); };

// ─── SUPABASE ─────────────────────────────────────────────────────────────────
function toDb(e) {
  return { id:e.id, name:e.name, email:e.email, password:e.password, role:e.role, position:e.position||"", department:e.department||"", hourly_rate:e.role==="hourly"?Number(e.hourlyRate||0):null, salary:e.role==="salary"?Number(e.salary||0):null, manager:!!e.manager, active:e.active!==false, start_date:e.startDate||today(), phone:e.phone||"", emergency_contact:e.emergencyContact||"", emergency_phone:e.emergencyPhone||"", address:e.address||"", notes:e.notes||"", tax:e.tax||{}, direct_deposit:e.directDeposit||{}, time_off:e.timeOff||{vacation:80,sick:40,personal:16} };
}
function fromDb(emps, punches, tos, pays) {
  return (emps||[]).map(e=>({ id:e.id, name:e.name, email:e.email, password:e.password, role:e.role, position:e.position, department:e.department, hourlyRate:e.hourly_rate, salary:e.salary, manager:e.manager, active:e.active, startDate:e.start_date, phone:e.phone||"", emergencyContact:e.emergency_contact||"", emergencyPhone:e.emergency_phone||"", address:e.address||"", notes:e.notes||"", tax:e.tax||{}, directDeposit:e.direct_deposit||{bank:"",routing:"",account:"",type:"Checking"}, timeOff:e.time_off||{vacation:80,sick:40,personal:16}, punchHistory:(punches||[]).filter(p=>p.emp_id===e.id).map(p=>({date:p.work_date,in:p.clock_in,out:p.clock_out,hours:Number(p.hours||0),lat:p.lat,lng:p.lng})), timeOffRequests:(tos||[]).filter(r=>r.emp_id===e.id).map(r=>({id:r.id,type:r.type,start:r.start_date,end:r.end_date,status:r.status,note:r.note})), payStatements:(pays||[]).filter(s=>s.emp_id===e.id).map(s=>({period:s.period,gross:Number(s.gross||0),net:Number(s.net||0),date:s.pay_date})) }));
}

// ─── ICONS ────────────────────────────────────────────────────────────────────
const Icon = ({ name, size=18, color="currentColor" }) => {
  const p = { width:size, height:size, fill:"none", stroke:color, strokeWidth:"2", viewBox:"0 0 24 24", strokeLinecap:"round", strokeLinejoin:"round" };
  const icons = {
    home:     <svg {...p}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>,
    clock:    <svg {...p}><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>,
    dollar:   <svg {...p}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    calendar: <svg {...p}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    users:    <svg {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    shield:   <svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    logout:   <svg {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    check:    <svg {...p}><polyline points="20,6 9,17 4,12"/></svg>,
    x:        <svg {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    download: <svg {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
    plus:     <svg {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    trash:    <svg {...p}><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
    file:     <svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>,
    book:     <svg {...p}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
    bank:     <svg {...p}><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12,2 20,7 4,7"/></svg>,
    key:      <svg {...p}><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>,
    mapPin:   <svg {...p}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
    sun:      <svg {...p}><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
    moon:     <svg {...p}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
    gps:      <svg {...p}><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>,
    edit:     <svg {...p}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    eye:      <svg {...p}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
    eyeOff:   <svg {...p}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
    user:     <svg {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    phone:    <svg {...p}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.56 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.29 6.29l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
    mail:     <svg {...p}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
    building: <svg {...p}><rect x="1" y="3" width="15" height="18"/><path d="M16 8h4l3 3v10h-7V8z"/><line x1="6" y1="8" x2="6" y2="8"/><line x1="10" y1="8" x2="10" y2="8"/><line x1="6" y1="12" x2="6" y2="12"/><line x1="10" y1="12" x2="10" y2="12"/><line x1="6" y1="16" x2="6" y2="16"/><line x1="10" y1="16" x2="10" y2="16"/></svg>,
    settings: <svg {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
    cart:     <svg {...p}><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>,
    tag:      <svg {...p}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
    chart:    <svg {...p}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  };
  return icons[name] || null;
};


// ─── LOGO ─────────────────────────────────────────────────────────────────────
const Logo = ({ size = 36 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width={size} height={size}>
    <defs>
      <linearGradient id="lgBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{stopColor:"#0D1117",stopOpacity:1}} />
        <stop offset="100%" style={{stopColor:"#161B22",stopOpacity:1}} />
      </linearGradient>
      <linearGradient id="lgG1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{stopColor:"#00E676",stopOpacity:1}} />
        <stop offset="100%" style={{stopColor:"#00C853",stopOpacity:1}} />
      </linearGradient>
      <linearGradient id="lgG2" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{stopColor:"#69F0AE",stopOpacity:1}} />
        <stop offset="100%" style={{stopColor:"#00E676",stopOpacity:1}} />
      </linearGradient>
      <filter id="lgGlow">
        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
        <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <clipPath id="lgClip">
        <rect x="40" y="40" width="320" height="320" rx="72" ry="72"/>
      </clipPath>
    </defs>
    <rect x="40" y="40" width="320" height="320" rx="72" ry="72" fill="url(#lgBg)"/>
    <g clipPath="url(#lgClip)" opacity="0.04">
      <line x1="40" y1="100" x2="360" y2="100" stroke="white" strokeWidth="1"/>
      <line x1="40" y1="160" x2="360" y2="160" stroke="white" strokeWidth="1"/>
      <line x1="40" y1="220" x2="360" y2="220" stroke="white" strokeWidth="1"/>
      <line x1="40" y1="280" x2="360" y2="280" stroke="white" strokeWidth="1"/>
      <line x1="100" y1="40" x2="100" y2="360" stroke="white" strokeWidth="1"/>
      <line x1="160" y1="40" x2="160" y2="360" stroke="white" strokeWidth="1"/>
      <line x1="220" y1="40" x2="220" y2="360" stroke="white" strokeWidth="1"/>
      <line x1="280" y1="40" x2="280" y2="360" stroke="white" strokeWidth="1"/>
    </g>
    <circle cx="200" cy="195" r="100" fill="#00E676" opacity="0.04"/>
    <circle cx="130" cy="148" r="22" fill="url(#lgG2)" filter="url(#lgGlow)"/>
    <path d="M88 235 Q88 205 130 205 Q172 205 172 235 L172 248 Q172 252 168 252 L92 252 Q88 252 88 248 Z" fill="url(#lgG2)" opacity="0.9"/>
    <circle cx="200" cy="138" r="26" fill="url(#lgG1)" filter="url(#lgGlow)"/>
    <path d="M154 230 Q154 196 200 196 Q246 196 246 230 L246 248 Q246 254 240 254 L160 254 Q154 254 154 248 Z" fill="url(#lgG1)"/>
    <circle cx="270" cy="148" r="22" fill="url(#lgG2)" filter="url(#lgGlow)"/>
    <path d="M228 235 Q228 205 270 205 Q312 205 312 235 L312 248 Q312 252 308 252 L232 252 Q228 252 228 248 Z" fill="url(#lgG2)" opacity="0.9"/>
    <polyline points="88,280 120,280 138,258 155,300 172,265 188,280 212,280 228,258 245,300 262,265 278,280 312,280"
      fill="none" stroke="url(#lgG1)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" filter="url(#lgGlow)" opacity="0.85"/>
    <rect x="140" y="318" width="120" height="4" rx="2" fill="url(#lgG1)" opacity="0.5"/>
    <rect x="40" y="40" width="320" height="320" rx="72" ry="72" fill="none" stroke="url(#lgG1)" strokeWidth="1.5" opacity="0.25"/>
  </svg>
);

// ─── THEME CSS ────────────────────────────────────────────────────────────────
const getCSS = (dark) => `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  :root{
    --bg:${dark?"#080D1A":"#F1F5FB"};
    --bg2:${dark?"#0E1628":"#FFFFFF"};
    --bg3:${dark?"#162040":"#EBF0FA"};
    --bg4:${dark?"#1C2A50":"#DFE8F6"};
    --surface:${dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.03)"};
    --hover:${dark?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.05)"};
    --border:${dark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.09)"};
    --text:${dark?"#E8EFFF":"#0D1B2A"};
    --text2:${dark?"#8A9BC4":"#5A6A8A"};
    --text3:${dark?"#3D4F75":"#9AAAC4"};
    --blue:#3B82F6; --blue-g:rgba(59,130,246,0.15);
    --green:#10B981; --green-g:rgba(16,185,129,0.15);
    --amber:#F59E0B; --amber-g:rgba(245,158,11,0.15);
    --red:#EF4444; --red-g:rgba(239,68,68,0.15);
    --violet:#8B5CF6; --violet-g:rgba(139,92,246,0.15);
    --cyan:#06B6D4; --cyan-g:rgba(6,182,212,0.15);
    --r:12px; --r-sm:8px; --r-lg:18px;
    --shadow:${dark?"0 2px 16px rgba(0,0,0,0.4)":"0 2px 16px rgba(0,0,0,0.07)"};
    --shadow-lg:${dark?"0 20px 60px rgba(0,0,0,0.6)":"0 20px 60px rgba(0,0,0,0.12)"};
  }
  body{font-family:'Outfit',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;line-height:1.5;transition:background .3s,color .3s}
  ::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}

  /* LAYOUT */
  .shell{display:flex;min-height:100vh}
  .sidebar{width:256px;min-height:100vh;background:var(--bg2);border-right:1px solid var(--border);display:flex;flex-direction:column;position:fixed;left:0;top:0;z-index:100;transition:background .3s}
  .sidebar-logo{padding:20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px}
  .logo-mark{width:38px;height:38px;background:linear-gradient(135deg,var(--blue),var(--violet));border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:17px;color:white;flex-shrink:0}
  .logo-name{font-size:15px;font-weight:800;letter-spacing:-.3px;line-height:1.2}
  .logo-sub{font-size:10px;color:var(--text2);letter-spacing:.5px;text-transform:uppercase}
  .sidebar-nav{flex:1;padding:12px;overflow-y:auto}
  .nav-section{font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:1.2px;padding:12px 8px 5px}
  .nav-item{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:var(--r-sm);cursor:pointer;color:var(--text2);font-size:13.5px;font-weight:500;transition:all .15s;margin-bottom:1px;border:none;background:none;width:100%;text-align:left;font-family:'Outfit',sans-serif}
  .nav-item:hover{color:var(--text);background:var(--surface)}
  .nav-item.active{color:var(--blue);background:var(--blue-g);font-weight:600}
  .sidebar-bottom{padding:12px;border-top:1px solid var(--border)}
  .user-chip{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--r);background:var(--surface);border:1px solid var(--border)}
  .avatar{width:34px;height:34px;border-radius:9px;background:linear-gradient(135deg,var(--blue),var(--violet));display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:white;flex-shrink:0}
  .user-info{flex:1;min-width:0}
  .user-name{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .user-role{font-size:10px;color:var(--text2)}
  .icon-btn{padding:6px;border-radius:7px;background:none;border:none;color:var(--text2);cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center}
  .icon-btn:hover{color:var(--text);background:var(--hover)}
  .main{margin-left:256px;flex:1;min-height:100vh}
  .topbar{height:56px;border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 24px;gap:10px;background:var(--bg2);position:sticky;top:0;z-index:50;transition:background .3s}
  .topbar-title{font-size:15px;font-weight:700;flex:1;letter-spacing:-.2px}
  .page{padding:24px;max-width:1300px}

  /* CARDS */
  .card{background:var(--bg2);border:1px solid var(--border);border-radius:var(--r-lg);padding:22px;box-shadow:var(--shadow);transition:background .3s,border-color .3s}
  .card-sm{padding:14px 18px}
  .card-title{font-size:14.5px;font-weight:700;letter-spacing:-.2px}
  .card-sub{color:var(--text2);font-size:12px;margin-top:2px}

  /* STATS */
  .stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:14px;margin-bottom:20px}
  .stat-card{background:var(--bg2);border:1px solid var(--border);border-radius:var(--r-lg);padding:18px 20px;box-shadow:var(--shadow);transition:all .2s;cursor:default}
  .stat-card:hover{border-color:var(--blue);transform:translateY(-1px)}
  .stat-label{font-size:10.5px;color:var(--text2);margin-bottom:8px;font-weight:600;text-transform:uppercase;letter-spacing:.6px}
  .stat-val{font-size:28px;font-weight:900;line-height:1;letter-spacing:-1px}
  .stat-val.blue{color:var(--blue)}.stat-val.green{color:var(--green)}.stat-val.amber{color:var(--amber)}.stat-val.red{color:var(--red)}.stat-val.violet{color:var(--violet)}

  /* GRID */
  .g2{display:grid;grid-template-columns:1fr 1fr;gap:18px}
  .g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}

  /* TABLE */
  .tbl-wrap{overflow-x:auto;border-radius:var(--r-lg);border:1px solid var(--border);background:var(--bg2);box-shadow:var(--shadow)}
  table{width:100%;border-collapse:collapse}
  th{background:var(--bg3);padding:10px 16px;font-size:10.5px;font-weight:700;color:var(--text2);text-align:left;text-transform:uppercase;letter-spacing:.7px}
  td{padding:12px 16px;font-size:13.5px;border-top:1px solid var(--border);vertical-align:middle}
  tr:hover td{background:var(--surface)}

  /* BADGES & TAGS */
  .badge{display:inline-flex;align-items:center;gap:3px;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:700}
  .b-green{background:var(--green-g);color:var(--green)}.b-amber{background:var(--amber-g);color:var(--amber)}.b-red{background:var(--red-g);color:var(--red)}.b-blue{background:var(--blue-g);color:var(--blue)}.b-violet{background:var(--violet-g);color:var(--violet)}.b-cyan{background:var(--cyan-g);color:var(--cyan)}
  .tag{display:inline-flex;padding:2px 8px;border-radius:5px;font-size:11px;font-weight:700;font-family:'JetBrains Mono',monospace}
  .t-salary{background:var(--violet-g);color:var(--violet)}.t-hourly{background:var(--green-g);color:var(--green)}

  /* BUTTONS */
  .btn{padding:9px 18px;border:none;border-radius:var(--r-sm);font-family:'Outfit',sans-serif;font-size:13.5px;font-weight:600;cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;gap:7px;white-space:nowrap}
  .btn-primary{background:var(--blue);color:white}.btn-primary:hover{background:#2563EB;transform:translateY(-1px);box-shadow:0 4px 14px var(--blue-g)}
  .btn-success{background:var(--green);color:white}.btn-success:hover{background:#059669;transform:translateY(-1px)}
  .btn-danger{background:var(--red-g);color:var(--red);border:1px solid rgba(239,68,68,.2)}.btn-danger:hover{background:rgba(239,68,68,.22)}
  .btn-ghost{background:var(--surface);color:var(--text);border:1px solid var(--border)}.btn-ghost:hover{background:var(--hover)}
  .btn-amber{background:var(--amber-g);color:var(--amber);border:1px solid rgba(245,158,11,.2)}.btn-amber:hover{background:rgba(245,158,11,.22)}
  .btn-violet{background:var(--violet-g);color:var(--violet);border:1px solid rgba(139,92,246,.2)}.btn-violet:hover{background:rgba(139,92,246,.22)}
  .btn-sm{padding:6px 13px;font-size:12.5px}.btn-xs{padding:4px 9px;font-size:11.5px}
  .w-full{width:100%;justify-content:center}

  /* FORMS */
  .fg{margin-bottom:14px}
  .fl{font-size:11px;color:var(--text2);margin-bottom:5px;display:block;font-weight:700;text-transform:uppercase;letter-spacing:.4px}
  .fi,.si{width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r-sm);padding:9px 13px;color:var(--text);font-family:'Outfit',sans-serif;font-size:14px;transition:all .2s;outline:none}
  .fi:focus,.si:focus{border-color:var(--blue);box-shadow:0 0 0 3px var(--blue-g)}
  .fi::placeholder{color:var(--text3)}
  .fi[readonly]{opacity:.55;cursor:not-allowed}
  textarea.fi{resize:vertical;min-height:80px}

  /* MODALS / PANELS */
  .overlay{position:fixed;inset:0;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;z-index:200;backdrop-filter:blur(6px);animation:fadeIn .15s ease}
  .modal{background:var(--bg2);border:1px solid var(--border);border-radius:20px;padding:28px;width:520px;max-width:95vw;max-height:88vh;overflow-y:auto;box-shadow:var(--shadow-lg);animation:slideUp .2s ease}
  .modal-lg{width:680px}
  .modal-title{font-size:18px;font-weight:800;margin-bottom:20px;letter-spacing:-.3px;display:flex;align-items:center;gap:10px}
  .side-panel{position:fixed;right:0;top:0;bottom:0;width:540px;background:var(--bg2);border-left:1px solid var(--border);z-index:150;overflow-y:auto;box-shadow:-20px 0 60px rgba(0,0,0,.3);animation:slideRight .25s ease}
  .panel-hdr{padding:18px 24px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:var(--bg2);z-index:10}
  .panel-body{padding:24px}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes slideUp{from{transform:translateY(12px);opacity:0}to{transform:translateY(0);opacity:1}}
  @keyframes slideRight{from{transform:translateX(20px);opacity:0}to{transform:translateX(0);opacity:1}}

  /* ALERTS */
  .alert{padding:10px 14px;border-radius:var(--r-sm);font-size:13px;margin-bottom:14px;display:flex;align-items:flex-start;gap:8px}
  .a-success{background:var(--green-g);border:1px solid rgba(16,185,129,.25);color:var(--green)}
  .a-error{background:var(--red-g);border:1px solid rgba(239,68,68,.25);color:var(--red)}
  .a-info{background:var(--blue-g);border:1px solid rgba(59,130,246,.25);color:var(--blue)}
  .a-amber{background:var(--amber-g);border:1px solid rgba(245,158,11,.25);color:var(--amber)}
  .a-violet{background:var(--violet-g);border:1px solid rgba(139,92,246,.25);color:var(--violet)}

  /* UTILS */
  .flex{display:flex}.items-c{align-items:center}.j-between{justify-content:space-between}
  .gap-4{gap:4px}.gap-6{gap:6px}.gap-8{gap:8px}.gap-10{gap:10px}.gap-12{gap:12px}.gap-16{gap:16px}
  .mb-8{margin-bottom:8px}.mb-12{margin-bottom:12px}.mb-16{margin-bottom:16px}.mb-20{margin-bottom:20px}.mb-24{margin-bottom:24px}
  .mt-8{margin-top:8px}.mt-12{margin-top:12px}.mt-16{margin-top:16px}
  .tm{color:var(--text2)}.ts{font-size:13px}.txs{font-size:11.5px}.fb{font-weight:700}.fmono{font-family:'JetBrains Mono',monospace}
  .tg{color:var(--green)}.tr{color:var(--red)}.tb{color:var(--blue)}.ta{color:var(--amber)}.tv{color:var(--violet)}
  .irow{display:flex;justify-content:space-between;gap:12px;padding:11px 0;border-bottom:1px solid var(--border);align-items:center}
  .irow:last-child{border-bottom:none}
  .ilbl{color:var(--text2);font-size:13px}.ival{font-weight:600;font-size:13.5px;text-align:right}
  .arow{display:flex;gap:10px;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap}
  .divider{height:1px;background:var(--border);margin:14px 0}

  /* PUNCH SCREEN */
  .punch-screen{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg);background-image:radial-gradient(ellipse at 50% 0%,rgba(59,130,246,.12) 0%,transparent 65%)}
  .punch-card{background:var(--bg2);border:1px solid var(--border);border-radius:24px;padding:44px 40px;width:460px;max-width:95vw;text-align:center;box-shadow:var(--shadow-lg)}
  .ptime{font-family:'Outfit',sans-serif;font-size:58px;font-weight:900;letter-spacing:-3px;color:var(--blue);line-height:1}
  .pdate{color:var(--text2);font-size:14px;margin:5px 0 24px}
  .pbtn{width:100%;padding:17px;font-size:18px;font-weight:800;border-radius:14px;border:none;cursor:pointer;transition:all .2s;font-family:'Outfit',sans-serif}
  .pbtn.in{background:linear-gradient(135deg,var(--green),#047857);color:white}
  .pbtn.out{background:linear-gradient(135deg,var(--red),#b91c1c);color:white}
  .pbtn:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(0,0,0,.3)}

  /* LOGIN */
  .login-screen{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg);background-image:radial-gradient(ellipse at 25% 50%,var(--blue-g) 0%,transparent 55%),radial-gradient(ellipse at 75% 20%,var(--violet-g) 0%,transparent 50%)}
  .login-card{background:var(--bg2);border:1px solid var(--border);border-radius:22px;padding:40px 36px;width:420px;max-width:95vw;box-shadow:var(--shadow-lg)}
  .login-logo{text-align:center;margin-bottom:26px}
  .login-mark{width:52px;height:52px;background:linear-gradient(135deg,var(--blue),var(--violet));border-radius:14px;display:inline-flex;align-items:center;justify-content:center;font-weight:900;font-size:22px;color:white;margin-bottom:10px}
  .login-title{font-size:23px;font-weight:900;letter-spacing:-.5px}
  .login-sub{color:var(--text2);font-size:13px;margin-top:3px}
  .login-tabs{display:flex;gap:5px;margin-bottom:22px;background:var(--bg3);border-radius:var(--r-sm);padding:4px}
  .ltab{flex:1;padding:8px;border:none;border-radius:6px;font-family:'Outfit',sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;background:transparent;color:var(--text2)}
  .ltab.active{background:var(--blue);color:white;box-shadow:0 2px 8px var(--blue-g)}

  /* PROGRESS BAR */
  .pbar{height:5px;background:var(--border);border-radius:3px;overflow:hidden}
  .pfill{height:100%;background:linear-gradient(90deg,var(--blue),var(--violet));transition:width .5s ease}

  /* TABS (panel tabs) */
  .ptabs{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:18px}
  .ptab{padding:6px 13px;border-radius:7px;border:1px solid var(--border);background:var(--surface);color:var(--text2);font-weight:600;font-size:12.5px;cursor:pointer;font-family:'Outfit',sans-serif;transition:all .15s}
  .ptab.active{background:var(--blue);color:white;border-color:var(--blue)}

  /* PUNCH ITEM */
  .punch-item{display:flex;justify-content:space-between;align-items:center;padding:12px 15px;border-radius:var(--r-sm);background:var(--surface);border:1px solid var(--border);margin-bottom:8px}

  /* THEME TOGGLE */
  .theme-btn{display:flex;align-items:center;gap:6px;padding:6px 11px;border-radius:7px;border:1px solid var(--border);background:var(--surface);cursor:pointer;color:var(--text2);font-size:12.5px;font-weight:600;font-family:'Outfit',sans-serif;transition:all .15s}
  .theme-btn:hover{color:var(--text);background:var(--hover)}

  /* GPS BADGES */
  .gps-ok{background:var(--green-g);border:1px solid rgba(16,185,129,.25);color:var(--green);padding:5px 11px;border-radius:7px;font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:5px}
  .gps-fail{background:var(--red-g);border:1px solid rgba(239,68,68,.25);color:var(--red);padding:5px 11px;border-radius:7px;font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:5px}
  .gps-wait{background:var(--amber-g);border:1px solid rgba(245,158,11,.25);color:var(--amber);padding:5px 11px;border-radius:7px;font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:5px}

  @media(max-width:768px){
    .sidebar{width:58px}
    .sidebar .logo-name,.sidebar .logo-sub,.sidebar .nav-item span,.sidebar .user-info,.nav-section{display:none}
    .sidebar .nav-item{justify-content:center;padding:11px}
    .main{margin-left:58px}
    .g2,.g3{grid-template-columns:1fr}
    .stat-grid{grid-template-columns:1fr 1fr}
  }
`;

// ─── LIVE CLOCK ───────────────────────────────────────────────────────────────
function LiveClock() {
  const [t,setT] = useState(new Date());
  useEffect(()=>{const id=setInterval(()=>setT(new Date()),1000);return()=>clearInterval(id)},[]);
  return <>
    <div className="ptime">{t.toLocaleTimeString("en-US",{hour12:false})}</div>
    <div className="pdate">{t.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</div>
  </>;
}

// ─── GPS HOOK ─────────────────────────────────────────────────────────────────
function useGPS() {
  const [pos,setPos] = useState(null);
  const [status,setStatus] = useState("idle");
  const get = useCallback(()=>{
    if(!navigator.geolocation){setStatus("denied");return;}
    setStatus("loading");
    navigator.geolocation.getCurrentPosition(p=>{setPos({lat:p.coords.latitude,lng:p.coords.longitude});setStatus("ok")},()=>setStatus("denied"),{enableHighAccuracy:true,timeout:10000});
  },[]);
  return {pos,status,get};
}
function distM(a,b,c,d){const R=6371000,dL=((c-a)*Math.PI)/180,dN=((d-b)*Math.PI)/180,x=Math.sin(dL/2)**2+Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin(dN/2)**2;return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));}

// ─── CHANGE PASSWORD ──────────────────────────────────────────────────────────
function ChangePasswordModal({empId,onClose}) {
  const [f,setF]=useState({cur:"",nw:"",conf:""});
  const [show,setShow]=useState(false);
  const [msg,setMsg]=useState(null);
  const submit=async()=>{
    setMsg(null);
    if(!f.cur||!f.nw||!f.conf)return setMsg({t:"e",s:"All fields are required."});
    if(f.nw.length<6)return setMsg({t:"e",s:"New password must be at least 6 characters."});
    if(f.nw!==f.conf)return setMsg({t:"e",s:"New passwords do not match."});
    const {data:emp}=await supabase.from("employees").select("password").eq("id",empId).single();
    if(!emp||emp.password!==f.cur)return setMsg({t:"e",s:"Current password is incorrect."});
    const {error}=await supabase.from("employees").update({password:f.nw}).eq("id",empId);
    if(error)return setMsg({t:"e",s:"Update failed: "+error.message});
    setMsg({t:"s",s:"Password updated successfully!"});
    setTimeout(onClose,1500);
  };
  return (
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-title"><Icon name="key" color="var(--blue)"/>Change Password</div>
        {msg&&<div className={`alert ${msg.t==="s"?"a-success":"a-error"}`}>{msg.s}</div>}
        {[["Current Password","cur"],["New Password","nw"],["Confirm New Password","conf"]].map(([lbl,key])=>(
          <div key={key} className="fg">
            <label className="fl">{lbl}</label>
            <div style={{position:"relative"}}>
              <input className="fi" type={show?"text":"password"} value={f[key]} onChange={e=>setF({...f,[key]:e.target.value})} style={{paddingRight:40}}/>
              <button onClick={()=>setShow(!show)} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"var(--text2)"}}>
                <Icon name={show?"eyeOff":"eye"} size={15}/>
              </button>
            </div>
          </div>
        ))}
        <div className="flex gap-8 mt-16">
          <button className="btn btn-primary" style={{flex:1}} onClick={submit}>Update Password</button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── OFFICE LOCATION MODAL ────────────────────────────────────────────────────
function OfficeModal({officeLocation,onSave,onClose}) {
  const {pos,status,get}=useGPS();
  const [lat,setLat]=useState(officeLocation?.lat||"");
  const [lng,setLng]=useState(officeLocation?.lng||"");
  const [radius,setRadius]=useState(officeLocation?.radius||200);
  const [saving,setSaving]=useState(false);
  useEffect(()=>{if(pos){setLat(pos.lat.toFixed(6));setLng(pos.lng.toFixed(6));}},[pos]);
  const save=async()=>{
    if(!lat||!lng)return;
    setSaving(true);
    const val={lat:Number(lat),lng:Number(lng),radius:Number(radius)};
    const {error}=await supabase.from("settings").upsert({key:"office_location",value:val});
    setSaving(false);
    if(error){alert("Save failed: "+error.message);return;}
    onSave(val);onClose();
  };
  return (
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-title"><Icon name="mapPin" color="var(--blue)"/>Set Office Location</div>
        <div className="alert a-info">Employees must be within the radius to clock in/out.</div>
        <div className="fg"><label className="fl">Latitude</label><input className="fi fmono" value={lat} onChange={e=>setLat(e.target.value)} placeholder="e.g. 40.712776"/></div>
        <div className="fg"><label className="fl">Longitude</label><input className="fi fmono" value={lng} onChange={e=>setLng(e.target.value)} placeholder="e.g. -74.005974"/></div>
        <div className="fg"><label className="fl">Allowed Radius (meters)</label><input className="fi" type="number" value={radius} onChange={e=>setRadius(e.target.value)} min="50" max="5000"/></div>
        <button className="btn btn-ghost w-full mb-12" onClick={get} disabled={status==="loading"}>
          <Icon name="gps" size={14}/>{status==="loading"?"Getting Location…":"Use My Current Location"}
        </button>
        {status==="ok"&&<div className="gps-ok mb-12">✓ {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}</div>}
        {status==="denied"&&<div className="gps-fail mb-12">⚠ GPS access denied</div>}
        <div className="flex gap-8">
          <button className="btn btn-primary" style={{flex:1}} onClick={save} disabled={saving}>{saving?"Saving…":"Save Office Location"}</button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── EMPLOYEE PORTAL TABS ─────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function EmpHome({emp,employees,setTab}) {
  const cur=employees.find(e=>e.id===emp.id)||emp;
  const hrs=(cur.punchHistory||[]).reduce((a,r)=>a+Number(r.hours||0),0);
  return (
    <div>
      <div className="flex j-between items-c mb-24">
        <div>
          <div style={{fontFamily:"'Outfit',sans-serif",fontSize:24,fontWeight:900,letterSpacing:"-.5px"}}>Welcome back, {emp.name.split(" ")[0]} 👋</div>
          <div className="tm ts">{emp.position} · {emp.department} · ID: {emp.id}</div>
        </div>
      </div>
      <div className="stat-grid">
        <div className="stat-card"><div className="stat-label">Hours This Period</div><div className="stat-val green">{hrs.toFixed(1)}</div></div>
        <div className="stat-card"><div className="stat-label">Vacation Days Left</div><div className="stat-val blue">{Math.floor((cur.timeOff?.vacation||0)/8)}</div></div>
        <div className="stat-card"><div className="stat-label">Pending Requests</div><div className="stat-val amber">{(cur.timeOffRequests||[]).filter(r=>r.status==="Pending").length}</div></div>
        <div className="stat-card"><div className="stat-label">Last Pay Net</div><div className="stat-val green" style={{fontSize:22}}>{cur.payStatements?.[0]?fmtCurrency(cur.payStatements[0].net):"—"}</div></div>
      </div>
      <div className="g2">
        <div className="card">
          <div className="card-title mb-16">My Profile</div>
          <div className="irow"><span className="ilbl">Full Name</span><span className="ival">{emp.name}</span></div>
          <div className="irow"><span className="ilbl">Email</span><span className="ival">{emp.email}</span></div>
          <div className="irow"><span className="ilbl">Phone</span><span className="ival">{emp.phone||"—"}</span></div>
          <div className="irow"><span className="ilbl">Address</span><span className="ival" style={{maxWidth:200,textAlign:"right",fontSize:12}}>{emp.address||"—"}</span></div>
          <div className="irow"><span className="ilbl">Start Date</span><span className="ival">{emp.startDate}</span></div>
          <div className="irow"><span className="ilbl">Department</span><span className="ival">{emp.department}</span></div>
          <div className="irow"><span className="ilbl">Position</span><span className="ival">{emp.position}</span></div>
          <div className="irow"><span className="ilbl">Pay Type</span><span className="ival"><span className={`tag ${emp.role==="salary"?"t-salary":"t-hourly"}`}>{emp.role}</span></span></div>
          {emp.hourlyRate&&<div className="irow"><span className="ilbl">Hourly Rate</span><span className="ival tg">${emp.hourlyRate}/hr</span></div>}
          {emp.salary&&<div className="irow"><span className="ilbl">Annual Salary</span><span className="ival tg">{fmtCurrency(emp.salary)}</span></div>}
        </div>
        <div className="card">
          <div className="card-title mb-16">Emergency Contact</div>
          <div className="irow"><span className="ilbl">Contact Name</span><span className="ival">{emp.emergencyContact||"—"}</span></div>
          <div className="irow"><span className="ilbl">Contact Phone</span><span className="ival">{emp.emergencyPhone||"—"}</span></div>
          <div className="divider"/>
          <div className="card-title mb-12">Quick Navigation</div>
          {[["timecard","clock","Time Card"],["pay","dollar","Pay Statements"],["timeoff","calendar","Request Time Off"],["directdeposit","bank","Direct Deposit"],["tax","file","Tax Withholding"]].map(([id,icon,label])=>(
            <button key={id} className="btn btn-ghost w-full mb-8" style={{justifyContent:"flex-start"}} onClick={()=>setTab(id)}>
              <Icon name={icon} size={14}/>{label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmpTimeCard({emp}) {
  const h=emp.punchHistory||[];
  const total=h.reduce((a,r)=>a+Number(r.hours||0),0);
  return (
    <div>
      <div className="stat-grid">
        <div className="stat-card"><div className="stat-label">Period Hours</div><div className="stat-val green">{total.toFixed(1)}</div></div>
        <div className="stat-card"><div className="stat-label">Pending Pay</div><div className="stat-val amber">{fmtCurrency(total*(emp.hourlyRate||0))}</div></div>
        <div className="stat-card"><div className="stat-label">Pay Rate</div><div className="stat-val blue" style={{fontSize:20}}>{emp.hourlyRate?`$${emp.hourlyRate}/hr`:"Salary"}</div></div>
      </div>
      <div className="card">
        <div className="card-title mb-16">Punch History</div>
        {!h.length?<div className="tm ts" style={{textAlign:"center",padding:30}}>No punch records yet</div>
          :h.map((r,i)=>(
            <div key={i} className="punch-item">
              <div><div className="fb">{r.date}</div><div className="ts tm">{r.in} → {r.out||"Still Clocked In"}</div>
                {r.lat&&<div className="txs tm" style={{marginTop:3}}><Icon name="mapPin" size={10}/> {Number(r.lat).toFixed(4)}, {Number(r.lng).toFixed(4)}</div>}
              </div>
              <div style={{textAlign:"right"}}><div className="fb tg">{Number(r.hours||0).toFixed(2)} hrs</div><div className="ts tm">{fmtCurrency(Number(r.hours||0)*(emp.hourlyRate||0))}</div></div>
            </div>
          ))}
      </div>
    </div>
  );
}

function EmpPay({emp}) {
  const ytdG=(emp.payStatements||[]).reduce((a,p)=>a+Number(p.gross||0),0);
  const ytdN=(emp.payStatements||[]).reduce((a,p)=>a+Number(p.net||0),0);
  return (
    <div>
      <div className="stat-grid">
        <div className="stat-card"><div className="stat-label">YTD Gross</div><div className="stat-val green">{fmtCurrency(ytdG)}</div></div>
        <div className="stat-card"><div className="stat-label">YTD Net</div><div className="stat-val amber">{fmtCurrency(ytdN)}</div></div>
        <div className="stat-card"><div className="stat-label">Pay Type</div><div className="stat-val blue" style={{fontSize:18}}>{emp.role==="salary"?"Salary":"Hourly"}</div></div>
      </div>
      {emp.payStatements?.[0]&&(
        <div className="card mb-16">
          <div className="card-title mb-16">Last Pay Statement</div>
          <div className="irow"><span className="ilbl">Pay Period</span><span className="ival">{emp.payStatements[0].period}</span></div>
          <div className="irow"><span className="ilbl">Gross Pay</span><span className="ival tg">{fmtCurrency(emp.payStatements[0].gross)}</span></div>
          <div className="irow"><span className="ilbl">Net Pay</span><span className="ival ta" style={{fontSize:18}}>{fmtCurrency(emp.payStatements[0].net)}</span></div>
          <div className="irow"><span className="ilbl">Pay Date</span><span className="ival">{emp.payStatements[0].date}</span></div>
        </div>
      )}
      <div className="card">
        <div className="card-title mb-16">All Pay Statements</div>
        <div className="tbl-wrap">
          <table><thead><tr><th>Period</th><th>Gross</th><th>Net</th><th>Date</th></tr></thead>
            <tbody>
              {(emp.payStatements||[]).map((s,i)=><tr key={i}><td>{s.period}</td><td className="tg">{fmtCurrency(s.gross)}</td><td className="ta">{fmtCurrency(s.net)}</td><td className="tm">{s.date}</td></tr>)}
              {!emp.payStatements?.length&&<tr><td colSpan={4} style={{textAlign:"center",padding:24,color:"var(--text2)"}}>No statements found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function EmpTimeOff({emp,employees,setEmployees,reloadAll}) {
  const [form,setForm]=useState({type:"Vacation",start:"",end:"",note:""});
  const [ok,setOk]=useState(false);
  const submit=async()=>{
    if(!form.start||!form.end)return;
    const req={id:`TO${Date.now()}`,...form,status:"Pending"};
    setEmployees(employees.map(e=>e.id===emp.id?{...e,timeOffRequests:[...(e.timeOffRequests||[]),req]}:e));
    const {error}=await supabase.from("time_off_requests").insert({id:req.id,emp_id:emp.id,type:req.type,start_date:req.start,end_date:req.end,status:"Pending",note:req.note});
    if(error){alert("Save failed: "+error.message);await reloadAll();return;}
    setOk(true);setTimeout(()=>setOk(false),3000);
    setForm({type:"Vacation",start:"",end:"",note:""});
    await reloadAll();
  };
  const to=emp.timeOff||{};
  return (
    <div>
      <div className="stat-grid">
        <div className="stat-card"><div className="stat-label">Vacation Hours</div><div className="stat-val green">{to.vacation||0}</div></div>
        <div className="stat-card"><div className="stat-label">Sick Hours</div><div className="stat-val amber">{to.sick||0}</div></div>
        <div className="stat-card"><div className="stat-label">Personal Hours</div><div className="stat-val blue">{to.personal||0}</div></div>
      </div>
      <div className="g2">
        <div className="card">
          <div className="card-title mb-16">Request Time Off</div>
          {ok&&<div className="alert a-success">✓ Request submitted successfully!</div>}
          <div className="fg"><label className="fl">Type</label>
            <select className="si" value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>
              {["Vacation","Sick","Personal","Bereavement","Other"].map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="fg"><label className="fl">Start Date</label><input type="date" className="fi" value={form.start} onChange={e=>setForm({...form,start:e.target.value})}/></div>
          <div className="fg"><label className="fl">End Date</label><input type="date" className="fi" value={form.end} onChange={e=>setForm({...form,end:e.target.value})}/></div>
          <div className="fg"><label className="fl">Note (optional)</label><input className="fi" value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/></div>
          <button className="btn btn-primary w-full" onClick={submit}>Submit Request</button>
        </div>
        <div className="card">
          <div className="card-title mb-16">My Requests</div>
          {!(emp.timeOffRequests?.length)?<div className="tm ts">No requests submitted yet</div>
            :emp.timeOffRequests.map((r,i)=>(
              <div key={i} style={{padding:12,background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--r-sm)",marginBottom:8}}>
                <div className="flex j-between items-c mb-8"><span className="fb">{r.type}</span><span className={`badge ${r.status==="Approved"?"b-green":r.status==="Denied"?"b-red":"b-amber"}`}>{r.status}</span></div>
                <div className="ts tm">{r.start} → {r.end}</div>
                {r.note&&<div className="txs tm mt-8">{r.note}</div>}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// EMPLOYEE: View direct deposit (read-only — only admin can edit)
function EmpDirectDeposit({emp}) {
  const dd=emp.directDeposit||{};
  return (
    <div>
      <div className="alert a-violet mb-16">
        <Icon name="shield" size={14}/> Your direct deposit information is managed by your administrator. Contact your admin to update banking details.
      </div>
      <div className="card" style={{maxWidth:500}}>
        <div className="flex items-c gap-12 mb-20">
          <div style={{width:42,height:42,background:"var(--blue-g)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center"}}><Icon name="bank" color="var(--blue)" size={20}/></div>
          <div><div className="card-title">Direct Deposit</div><div className="card-sub">Your current payment account on file</div></div>
        </div>
        <div className="irow"><span className="ilbl">Bank Name</span><span className="ival">{dd.bank||"Not set"}</span></div>
        <div className="irow"><span className="ilbl">Account Type</span><span className="ival">{dd.type||"—"}</span></div>
        <div className="irow"><span className="ilbl">Account Number</span><span className="ival fmono">{dd.account||"—"}</span></div>
        <div className="irow"><span className="ilbl">Routing Number</span><span className="ival fmono">{dd.routing||"—"}</span></div>
        {!dd.bank&&<div className="alert a-amber mt-16"><Icon name="key" size={13}/> No banking information on file. Please contact your administrator.</div>}
      </div>
    </div>
  );
}

function EmpTax({emp}) {
  const tax=emp.tax||{};
  const total=Number(tax.federal||0)+Number(tax.state||0)+7.65;
  return (
    <div className="card" style={{maxWidth:500}}>
      <div className="card-title mb-20">Tax Withholding</div>
      <div className="irow"><span className="ilbl">Filing Status</span><span className="ival">{tax.filing||"—"}</span></div>
      <div className="irow"><span className="ilbl">Allowances / Exemptions</span><span className="ival">{tax.allowances??0}</span></div>
      <div className="irow"><span className="ilbl">Federal Income Tax Rate</span><span className="ival">{tax.federal||0}%</span></div>
      <div className="irow"><span className="ilbl">State Income Tax Rate</span><span className="ival">{tax.state||0}%</span></div>
      <div className="irow"><span className="ilbl">FICA (Social Security + Medicare)</span><span className="ival">7.65%</span></div>
      <div style={{marginTop:16,background:"var(--blue-g)",border:"1px solid rgba(59,130,246,.2)",borderRadius:"var(--r-sm)",padding:16}}>
        <div className="ts tm mb-8">Total Effective Withholding</div>
        <div style={{fontFamily:"'Outfit',sans-serif",fontWeight:900,fontSize:34,color:"var(--blue)"}}>{total.toFixed(2)}%</div>
      </div>
    </div>
  );
}

function EmpPolicies() {
  const docs=[{title:"Employee Code of Conduct",updated:"Jan 2025",pages:12},{title:"Attendance & Punctuality Policy",updated:"Jan 2025",pages:4},{title:"Anti-Harassment Policy",updated:"Mar 2024",pages:8},{title:"PTO & Time Off Policy",updated:"Jan 2025",pages:6},{title:"Remote Work Policy",updated:"Jun 2024",pages:5},{title:"Benefits Summary Guide",updated:"Jan 2025",pages:20}];
  return (
    <div>
      <div className="card-title mb-16">Company Policies & Documents</div>
      {docs.map((p,i)=>(
        <div key={i} className="card card-sm flex j-between items-c mb-8">
          <div className="flex items-c gap-12"><Icon name="file" color="var(--blue)" size={17}/>
            <div><div className="fb">{p.title}</div><div className="txs tm">Updated {p.updated} · {p.pages} pages</div></div>
          </div>
          <button className="btn btn-ghost btn-sm"><Icon name="download" size={12}/>Download</button>
        </div>
      ))}
    </div>
  );
}

function EmpLearning() {
  const courses=[{title:"Workplace Safety Fundamentals",progress:100,cat:"Required"},{title:"Customer Service Excellence",progress:65,cat:"Development",due:"2025-03-31"},{title:"Anti-Harassment Training",progress:100,cat:"Required"},{title:"Leadership Essentials",progress:20,cat:"Development",due:"2025-04-15"},{title:"Data Privacy & Security",progress:0,cat:"Required",due:"2025-03-15"}];
  return (
    <div>
      <div className="card-title mb-16">Learning & Development</div>
      {courses.map((c,i)=>(
        <div key={i} className="card mb-10">
          <div className="flex j-between items-c mb-8"><div className="fb">{c.title}</div>
            <div className="flex gap-6 items-c">
              <span className={`badge ${c.cat==="Required"?"b-red":"b-blue"}`}>{c.cat}</span>
              {c.progress===100&&<span className="badge b-green">✓ Done</span>}
            </div>
          </div>
          {c.due&&<div className="txs tm mb-8">Due: {c.due}</div>}
          <div className="pbar"><div className="pfill" style={{width:`${c.progress}%`}}/></div>
          <div className="txs tm mt-8">{c.progress}% complete</div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── MANAGER TABS — only for manager/supervisor role ──────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function MgrTimeOffApproval({employees,setEmployees,reloadAll}) {
  const pending=employees.flatMap(e=>(e.timeOffRequests||[]).filter(r=>r.status==="Pending").map(r=>({...r,empId:e.id,empName:e.name,empPos:e.position})));
  const history=employees.flatMap(e=>(e.timeOffRequests||[]).filter(r=>r.status!=="Pending").map(r=>({...r,empId:e.id,empName:e.name})));
  const update=async(empId,reqId,status)=>{
    setEmployees(employees.map(e=>e.id!==empId?e:{...e,timeOffRequests:(e.timeOffRequests||[]).map(r=>r.id!==reqId?r:{...r,status})}));
    const {error}=await supabase.from("time_off_requests").update({status}).eq("id",reqId);
    if(error)alert("Update failed: "+error.message);
    await reloadAll();
  };
  return (
    <div>
      <div className="flex j-between items-c mb-16">
        <div><div className="card-title">Time Off Approvals</div><div className="card-sub">{pending.length} pending request{pending.length!==1?"s":""}</div></div>
      </div>
      {!pending.length&&<div className="card tm ts" style={{textAlign:"center",padding:40}}>🎉 No pending time off requests</div>}
      {pending.map((r,i)=>(
        <div key={i} className="card mb-12">
          <div className="flex j-between items-c" style={{flexWrap:"wrap",gap:12}}>
            <div>
              <div className="flex items-c gap-8 mb-6"><div className="avatar" style={{width:30,height:30,fontSize:11}}>{initials(r.empName)}</div><div><div className="fb">{r.empName}</div><div className="txs tm">{r.empPos}</div></div></div>
              <div><span className="badge b-blue">{r.type}</span><span className="tm ts" style={{marginLeft:8}}>{r.start} → {r.end}</span></div>
              {r.note&&<div className="ts tm mt-8">{r.note}</div>}
            </div>
            <div className="flex gap-8">
              <button className="btn btn-success btn-sm" onClick={()=>update(r.empId,r.id,"Approved")}><Icon name="check" size={13}/>Approve</button>
              <button className="btn btn-danger btn-sm" onClick={()=>update(r.empId,r.id,"Denied")}><Icon name="x" size={13}/>Deny</button>
            </div>
          </div>
        </div>
      ))}
      {history.length>0&&<>
        <div className="card-title mb-12 mt-16">Decision History</div>
        {history.map((r,i)=>(
          <div key={i} style={{padding:"10px 14px",background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--r-sm)",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><span className="fb">{r.empName}</span><span className="tm"> · {r.type} · {r.start} → {r.end}</span></div>
            <span className={`badge ${r.status==="Approved"?"b-green":"b-red"}`}>{r.status}</span>
          </div>
        ))}
      </>}
    </div>
  );
}

function MgrTeamTimeCards({employees}) {
  const team=employees.filter(e=>e.active);
  return (
    <div>
      <div className="card-title mb-16">Team Time Cards — Current Period</div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Employee</th><th>Type</th><th>Hours</th><th>Est. Pay</th><th>Punch Records</th><th>Status</th></tr></thead>
          <tbody>
            {team.map((e,i)=>{
              const hrs=(e.punchHistory||[]).reduce((a,r)=>a+Number(r.hours||0),0);
              const pay=e.role==="hourly"?hrs*(e.hourlyRate||0):(e.salary||0)/26;
              return (
                <tr key={i}>
                  <td><div className="flex items-c gap-8"><div className="avatar" style={{width:30,height:30,fontSize:11}}>{initials(e.name)}</div><div><div className="fb">{e.name}</div><div className="txs tm">{e.position}</div></div></div></td>
                  <td><span className={`tag ${e.role==="salary"?"t-salary":"t-hourly"}`}>{e.role}</span></td>
                  <td className="tg fb">{hrs.toFixed(1)} hrs</td>
                  <td className="ta">{fmtCurrency(pay)}</td>
                  <td className="tm">{(e.punchHistory||[]).length} records</td>
                  <td><span className="badge b-green">On Track</span></td>
                </tr>
              );
            })}
            {!team.length&&<tr><td colSpan={6} style={{textAlign:"center",padding:30,color:"var(--text2)"}}>No active employees</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MgrTeamSchedule({employees}) {
  const days=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const shifts=["8:00 AM – 4:00 PM","4:00 PM – 12:00 AM","6:00 AM – 2:00 PM"];
  const team=employees.filter(e=>e.active&&e.role==="hourly");
  return (
    <div>
      <div className="flex j-between items-c mb-16">
        <div><div className="card-title">Team Schedule</div><div className="card-sub">Current week overview</div></div>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Employee</th>{days.map(d=><th key={d}>{d}</th>)}</tr></thead>
          <tbody>
            {team.map((e,i)=>(
              <tr key={i}>
                <td><div className="fb">{e.name}</div><div className="txs tm">{e.position}</div></td>
                {days.map((d,j)=>(
                  <td key={d} style={{fontSize:11}}>
                    <span style={{color:j>=5?"var(--text2)":"var(--green)",background:j>=5?"transparent":"var(--green-g)",padding:"3px 7px",borderRadius:5,display:"inline-block"}}>
                      {j>=5?"OFF":shifts[i%shifts.length]}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
            {!team.length&&<tr><td colSpan={8} style={{textAlign:"center",padding:30,color:"var(--text2)"}}>No hourly employees on team</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MgrTeamOverview({employees}) {
  const team=employees.filter(e=>e.active);
  const totalHrs=team.flatMap(e=>e.punchHistory||[]).reduce((a,r)=>a+Number(r.hours||0),0);
  const pendingTO=team.flatMap(e=>e.timeOffRequests||[]).filter(r=>r.status==="Pending").length;
  return (
    <div>
      <div className="stat-grid mb-20">
        <div className="stat-card"><div className="stat-label">Team Size</div><div className="stat-val blue">{team.length}</div></div>
        <div className="stat-card"><div className="stat-label">Total Hours</div><div className="stat-val green">{totalHrs.toFixed(1)}</div></div>
        <div className="stat-card"><div className="stat-label">Pending Requests</div><div className="stat-val amber">{pendingTO}</div></div>
        <div className="stat-card"><div className="stat-label">Hourly Staff</div><div className="stat-val violet">{team.filter(e=>e.role==="hourly").length}</div></div>
      </div>
      <div className="card">
        <div className="card-title mb-16">Team Members</div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Employee</th><th>Role</th><th>Department</th><th>Hours This Period</th><th>Status</th></tr></thead>
            <tbody>
              {team.map((e,i)=>{
                const hrs=(e.punchHistory||[]).reduce((a,r)=>a+Number(r.hours||0),0);
                return (
                  <tr key={i}>
                    <td><div className="flex items-c gap-8"><div className="avatar" style={{width:30,height:30,fontSize:11}}>{initials(e.name)}</div><div><div className="fb">{e.name}</div><div className="txs tm">{e.email}</div></div></div></td>
                    <td><span className={`tag ${e.role==="salary"?"t-salary":"t-hourly"}`}>{e.role}</span></td>
                    <td>{e.department}</td>
                    <td className="tg fb">{hrs.toFixed(1)} hrs</td>
                    <td><span className="badge b-green">Active</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── ADMIN: FULL EMPLOYEE EDIT PANEL ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function AdminEmployeePanel({emp,reloadAll,onClose}) {
  const [tab,setTab]=useState("personal");
  const [form,setForm]=useState({...emp});
  const [dd,setDd]=useState({...emp.directDeposit});
  const [saving,setSaving]=useState(false);
  const [msg,setMsg]=useState(null);

  const save=async()=>{
    setSaving(true);setMsg(null);
    const payload=toDb({...form,directDeposit:dd});
    const {error}=await supabase.from("employees").update(payload).eq("id",emp.id);
    setSaving(false);
    if(error){
      const isSchemaErr = error.message?.includes("column") || error.message?.includes("schema");
      const tip = isSchemaErr ? " → Run the add_missing_columns.sql script in Supabase SQL Editor, then retry." : "";
      setMsg({t:"e",s:error.message+tip});return;
    }
    setMsg({t:"s",s:"Changes saved successfully!"});
    await reloadAll();
    setTimeout(()=>setMsg(null),2500);
  };

  const tabs=[
    {id:"personal",label:"Personal Info"},
    {id:"employment",label:"Employment"},
    {id:"pay",label:"Pay & Rate"},
    {id:"tax",label:"Tax"},
    {id:"deposit",label:"Direct Deposit"},
    {id:"timeoff",label:"Time Off Balances"},
    {id:"emergency",label:"Emergency Contact"},
  ];

  const SF=({label,field,type="text",ro=false,placeholder=""})=>(
    <div className="fg">
      <label className="fl">{label}</label>
      <input className="fi" type={type} value={form[field]??""} readOnly={ro} placeholder={placeholder}
        onChange={e=>!ro&&setForm({...form,[field]:e.target.value})}/>
    </div>
  );

  return (
    <div className="side-panel">
      <div className="panel-hdr">
        <div className="flex items-c gap-12">
          <div className="avatar">{initials(emp.name)}</div>
          <div><div style={{fontWeight:800,fontSize:15}}>{emp.name}</div><div className="txs tm">{emp.position} · {emp.id}</div></div>
        </div>
        <div className="flex gap-8 items-c">
          <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving?"Saving…":"Save All"}</button>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={17}/></button>
        </div>
      </div>
      <div className="panel-body">
        {msg&&<div className={`alert ${msg.t==="s"?"a-success":"a-error"} mb-16`}>{msg.s}</div>}
        <div className="ptabs">
          {tabs.map(t=><button key={t.id} className={`ptab ${tab===t.id?"active":""}`} onClick={()=>setTab(t.id)}>{t.label}</button>)}
        </div>

        {tab==="personal"&&<div>
          <SF label="Full Name" field="name"/>
          <SF label="Email Address" field="email" type="email"/>
          <SF label="Employee ID" field="id" ro/>
          <SF label="Phone Number" field="phone" type="tel" placeholder="555-0100"/>
          <div className="fg"><label className="fl">Address</label><textarea className="fi" value={form.address||""} onChange={e=>setForm({...form,address:e.target.value})} placeholder="Street, City, State, ZIP"/></div>
          <div className="fg"><label className="fl">Internal Notes (admin only)</label><textarea className="fi" value={form.notes||""} onChange={e=>setForm({...form,notes:e.target.value})}/></div>
        </div>}

        {tab==="employment"&&<div>
          <SF label="Position / Job Title" field="position"/>
          <SF label="Department" field="department"/>
          <SF label="Start Date" field="startDate" type="date"/>
          <SF label="Password (reset)" field="password"/>
          <div className="fg">
            <label className="fl" style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="checkbox" checked={!!form.active} onChange={e=>setForm({...form,active:e.target.checked})}/> Employee is Active
            </label>
          </div>
          <div className="fg">
            <label className="fl" style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="checkbox" checked={!!form.manager} onChange={e=>setForm({...form,manager:e.target.checked})}/> Manager / Supervisor Role
            </label>
          </div>
        </div>}

        {tab==="pay"&&<div>
          <div className="fg">
            <label className="fl">Pay Type</label>
            <select className="si" value={form.role} onChange={e=>setForm({...form,role:e.target.value})}>
              <option value="hourly">Hourly</option>
              <option value="salary">Salary</option>
            </select>
          </div>
          {form.role==="hourly"&&<SF label="Hourly Rate ($)" field="hourlyRate" type="number"/>}
          {form.role==="salary"&&<SF label="Annual Salary ($)" field="salary" type="number"/>}
          <div className="alert a-info mt-8"><Icon name="shield" size={13}/> Pay rate changes take effect on the next pay period.</div>
        </div>}

        {tab==="tax"&&<div>
          <div className="fg">
            <label className="fl">Filing Status</label>
            <select className="si" value={form.tax?.filing||"Single"} onChange={e=>setForm({...form,tax:{...form.tax,filing:e.target.value}})}>
              {["Single","Married","Married Filing Separately","Head of Household"].map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="fg"><label className="fl">Allowances / Exemptions</label><input className="fi" type="number" min="0" value={form.tax?.allowances??0} onChange={e=>setForm({...form,tax:{...form.tax,allowances:Number(e.target.value)}})}/></div>
          <div className="fg"><label className="fl">Federal Income Tax Rate (%)</label><input className="fi" type="number" min="0" max="50" value={form.tax?.federal??22} onChange={e=>setForm({...form,tax:{...form.tax,federal:Number(e.target.value)}})}/></div>
          <div className="fg"><label className="fl">State Income Tax Rate (%)</label><input className="fi" type="number" min="0" max="20" value={form.tax?.state??6} onChange={e=>setForm({...form,tax:{...form.tax,state:Number(e.target.value)}})}/></div>
          <div style={{marginTop:14,padding:14,background:"var(--blue-g)",border:"1px solid rgba(59,130,246,.2)",borderRadius:"var(--r-sm)"}}>
            <div className="ts tm mb-4">Total Effective Withholding</div>
            <div style={{fontWeight:900,fontSize:28,color:"var(--blue)"}}>{(Number(form.tax?.federal||0)+Number(form.tax?.state||0)+7.65).toFixed(2)}%</div>
          </div>
        </div>}

        {tab==="deposit"&&<div>
          <div className="alert a-amber mb-16"><Icon name="shield" size={13}/> <strong>Admin Only:</strong> Only administrators can update direct deposit information. This data is confidential.</div>
          <div className="fg"><label className="fl">Bank Name</label><input className="fi" value={dd.bank||""} onChange={e=>setDd({...dd,bank:e.target.value})} placeholder="e.g. Chase, Wells Fargo"/></div>
          <div className="fg">
            <label className="fl">Account Type</label>
            <select className="si" value={dd.type||"Checking"} onChange={e=>setDd({...dd,type:e.target.value})}>
              <option>Checking</option><option>Savings</option>
            </select>
          </div>
          <div className="fg"><label className="fl">Account Number</label><input className="fi fmono" value={dd.account||""} onChange={e=>setDd({...dd,account:e.target.value})} placeholder="****1234"/></div>
          <div className="fg"><label className="fl">Routing Number</label><input className="fi fmono" value={dd.routing||""} onChange={e=>setDd({...dd,routing:e.target.value})} placeholder="9-digit routing number"/></div>
        </div>}

        {tab==="timeoff"&&<div>
          <div className="alert a-info mb-16"><Icon name="calendar" size={13}/> Adjust employee time-off hour balances. Changes are effective immediately.</div>
          <div className="fg"><label className="fl">Vacation Hours</label><input className="fi" type="number" min="0" value={form.timeOff?.vacation??80} onChange={e=>setForm({...form,timeOff:{...form.timeOff,vacation:Number(e.target.value)}})}/></div>
          <div className="fg"><label className="fl">Sick Hours</label><input className="fi" type="number" min="0" value={form.timeOff?.sick??40} onChange={e=>setForm({...form,timeOff:{...form.timeOff,sick:Number(e.target.value)}})}/></div>
          <div className="fg"><label className="fl">Personal Hours</label><input className="fi" type="number" min="0" value={form.timeOff?.personal??16} onChange={e=>setForm({...form,timeOff:{...form.timeOff,personal:Number(e.target.value)}})}/></div>
        </div>}

        {tab==="emergency"&&<div>
          <div className="alert a-info mb-16"><Icon name="phone" size={13}/> Emergency contact information for this employee.</div>
          <SF label="Emergency Contact Name" field="emergencyContact" placeholder="Full name"/>
          <SF label="Emergency Contact Phone" field="emergencyPhone" type="tel" placeholder="555-0100"/>
        </div>}
      </div>
    </div>
  );
}

// ─── ADMIN: EMPLOYEE LIST ─────────────────────────────────────────────────────
function AdminEmployees({employees,setEmployees,reloadAll}) {
  const [search,setSearch]=useState("");
  const [showAdd,setShowAdd]=useState(false);
  const [editEmp,setEditEmp]=useState(null);
  const [filterRole,setFilterRole]=useState("all");
  const [filterDept,setFilterDept]=useState("all");
  const [newEmp,setNewEmp]=useState({name:"",email:"",password:"",role:"hourly",position:"",department:"",hourlyRate:18,salary:75000,manager:false});

  const depts=[...new Set(employees.map(e=>e.department).filter(Boolean))];
  const filtered=employees.filter(e=>{
    const q=search.toLowerCase();
    const matchQ=e.name.toLowerCase().includes(q)||e.email.toLowerCase().includes(q)||e.position.toLowerCase().includes(q)||e.id.toLowerCase().includes(q);
    const matchR=filterRole==="all"||e.role===filterRole;
    const matchD=filterDept==="all"||e.department===filterDept;
    return matchQ&&matchR&&matchD;
  });

  const add=async()=>{
    if(!newEmp.name||!newEmp.email||!newEmp.password)return;
    const emp={...newEmp,id:`E${Date.now()}`,active:true,startDate:today(),phone:"",emergencyContact:"",emergencyPhone:"",address:"",notes:"",hourlyRate:newEmp.role==="hourly"?Number(newEmp.hourlyRate):null,salary:newEmp.role==="salary"?Number(newEmp.salary):null,tax:{filing:"Single",allowances:1,federal:22,state:6},directDeposit:{bank:"",routing:"",account:"",type:"Checking"},timeOff:{vacation:80,sick:40,personal:16},punchHistory:[],timeOffRequests:[],payStatements:[]};
    const {error}=await supabase.from("employees").insert(toDb(emp));
    if(error){alert("Add failed: "+error.message);return;}
    setEmployees([...employees,emp]);
    setShowAdd(false);
    setNewEmp({name:"",email:"",password:"",role:"hourly",position:"",department:"",hourlyRate:18,salary:75000,manager:false});
    await reloadAll();
  };

  const del=async(id)=>{
    if(!window.confirm("Remove this employee? This cannot be undone."))return;
    setEmployees(employees.filter(e=>e.id!==id));
    await supabase.from("employees").delete().eq("id",id);
    await reloadAll();
  };

  return (
    <div>
      {editEmp&&<AdminEmployeePanel emp={editEmp} reloadAll={async()=>{setEditEmp(null);await reloadAll();}} onClose={()=>setEditEmp(null)}/>}

      <div className="arow">
        <div className="flex gap-8 items-c" style={{flexWrap:"wrap"}}>
          <input type="text" className="fi" style={{maxWidth:240,marginBottom:0}} placeholder="Search employees…" value={search} onChange={e=>setSearch(e.target.value)}/>
          <select className="si" style={{width:"auto"}} value={filterRole} onChange={e=>setFilterRole(e.target.value)}>
            <option value="all">All Types</option><option value="hourly">Hourly</option><option value="salary">Salary</option>
          </select>
          <select className="si" style={{width:"auto"}} value={filterDept} onChange={e=>setFilterDept(e.target.value)}>
            <option value="all">All Departments</option>
            {depts.map(d=><option key={d}>{d}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={()=>setShowAdd(true)}><Icon name="plus" size={14}/>Add Employee</button>
      </div>

      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Employee</th><th>Role</th><th>Department / Position</th><th>Pay</th><th>Direct Deposit</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map((e,i)=>(
              <tr key={i}>
                <td>
                  <div className="flex items-c gap-10">
                    <div className="avatar" style={{width:32,height:32,fontSize:11}}>{initials(e.name)}</div>
                    <div><div className="fb">{e.name}</div><div className="txs tm">{e.email} · {e.id}</div></div>
                  </div>
                </td>
                <td>
                  <span className={`tag ${e.role==="salary"?"t-salary":"t-hourly"}`}>{e.role}</span>
                  {e.manager&&<span className="badge b-cyan" style={{marginLeft:5,fontSize:10}}>MGR</span>}
                </td>
                <td><div className="fb">{e.position}</div><div className="txs tm">{e.department}</div></td>
                <td className="tg fb">{e.role==="hourly"?`$${e.hourlyRate}/hr`:`$${((e.salary||0)/1000).toFixed(0)}k/yr`}</td>
                <td>
                  {e.directDeposit?.bank
                    ?<div><div className="txs fb">{e.directDeposit.bank}</div><div className="txs tm fmono">{e.directDeposit.account}</div></div>
                    :<span className="badge b-amber">Not Set</span>}
                </td>
                <td><span className={`badge ${e.active?"b-green":"b-red"}`}>{e.active?"Active":"Inactive"}</span></td>
                <td>
                  <div className="flex gap-6">
                    <button className="icon-btn tb" onClick={()=>setEditEmp(e)} title="Edit employee"><Icon name="edit" size={14}/></button>
                    <button className="icon-btn tr" onClick={()=>del(e.id)} title="Remove"><Icon name="trash" size={14}/></button>
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length&&<tr><td colSpan={7} style={{textAlign:"center",padding:32,color:"var(--text2)"}}>No employees found</td></tr>}
          </tbody>
        </table>
      </div>

      {showAdd&&(
        <div className="overlay" onClick={e=>e.target===e.currentTarget&&setShowAdd(false)}>
          <div className="modal">
            <div className="modal-title"><Icon name="plus" color="var(--blue)"/>Add New Employee</div>
            <div className="g2" style={{gap:12}}>
              <div className="fg"><label className="fl">Full Name</label><input className="fi" value={newEmp.name} onChange={e=>setNewEmp({...newEmp,name:e.target.value})}/></div>
              <div className="fg"><label className="fl">Email</label><input className="fi" type="email" value={newEmp.email} onChange={e=>setNewEmp({...newEmp,email:e.target.value})}/></div>
            </div>
            <div className="fg"><label className="fl">Temporary Password</label><input className="fi" type="password" value={newEmp.password} onChange={e=>setNewEmp({...newEmp,password:e.target.value})}/></div>
            <div className="g2" style={{gap:12}}>
              <div className="fg"><label className="fl">Position</label><input className="fi" value={newEmp.position} onChange={e=>setNewEmp({...newEmp,position:e.target.value})}/></div>
              <div className="fg"><label className="fl">Department</label><input className="fi" value={newEmp.department} onChange={e=>setNewEmp({...newEmp,department:e.target.value})}/></div>
            </div>
            <div className="fg"><label className="fl">Pay Type</label>
              <select className="si" value={newEmp.role} onChange={e=>setNewEmp({...newEmp,role:e.target.value})}>
                <option value="hourly">Hourly</option><option value="salary">Salary</option>
              </select>
            </div>
            {newEmp.role==="hourly"&&<div className="fg"><label className="fl">Hourly Rate ($)</label><input className="fi" type="number" value={newEmp.hourlyRate} onChange={e=>setNewEmp({...newEmp,hourlyRate:e.target.value})}/></div>}
            {newEmp.role==="salary"&&<div className="fg"><label className="fl">Annual Salary ($)</label><input className="fi" type="number" value={newEmp.salary} onChange={e=>setNewEmp({...newEmp,salary:e.target.value})}/></div>}
            <div className="fg"><label className="fl" style={{display:"flex",alignItems:"center",gap:8}}><input type="checkbox" checked={newEmp.manager} onChange={e=>setNewEmp({...newEmp,manager:e.target.checked})}/>Manager / Supervisor</label></div>
            <div className="flex gap-8 mt-16">
              <button className="btn btn-primary" style={{flex:1}} onClick={add}>Create Employee</button>
              <button className="btn btn-ghost" onClick={()=>setShowAdd(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ADMIN: ATTENDANCE ────────────────────────────────────────────────────────
function AdminAttendance({employees}) {
  const all=employees.flatMap(e=>(e.punchHistory||[]).map(p=>({...p,empName:e.name,empId:e.id,position:e.position,rate:e.hourlyRate}))).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  const csv=()=>{
    const rows=all.map(r=>`${r.empName},${r.empId},${r.position},${r.date},${r.in||""},${r.out||""},${Number(r.hours||0).toFixed(2)},${(Number(r.hours||0)*Number(r.rate||0)).toFixed(2)}`);
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([["Employee,ID,Position,Date,Clock In,Clock Out,Hours,Earnings",...rows].join("\n")],{type:"text/csv"}));a.download="attendance.csv";a.click();
  };
  return (
    <div>
      <div className="arow"><div className="card-title">All Punch Records ({all.length})</div>
        <button className="btn btn-ghost btn-sm" onClick={csv}><Icon name="download" size={13}/>Export CSV</button>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Employee</th><th>Date</th><th>Clock In</th><th>Clock Out</th><th>Hours</th><th>Earnings</th><th>GPS Location</th></tr></thead>
          <tbody>
            {!all.length&&<tr><td colSpan={7} style={{textAlign:"center",padding:40,color:"var(--text2)"}}>No records found</td></tr>}
            {all.map((r,i)=>(
              <tr key={i}>
                <td><div className="fb">{r.empName}</div><div className="txs tm">{r.position}</div></td>
                <td>{r.date}</td>
                <td className="tg">{r.in}</td>
                <td className="ta">{r.out||"—"}</td>
                <td className="tb fb">{Number(r.hours||0).toFixed(2)}</td>
                <td className="tg">{r.rate?fmtCurrency(Number(r.hours||0)*Number(r.rate||0)):"—"}</td>
                <td>{r.lat?<span className="gps-ok txs"><Icon name="mapPin" size={10}/>{Number(r.lat).toFixed(3)},{Number(r.lng).toFixed(3)}</span>:<span className="tm txs">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── ADMIN: PAYROLL ───────────────────────────────────────────────────────────
function AdminPayroll({employees}) {
  const total=employees.reduce((a,e)=>{const h=(e.punchHistory||[]).reduce((s,r)=>s+Number(r.hours||0),0);return a+(e.role==="hourly"?h*Number(e.hourlyRate||0):Number(e.salary||0)/26);},0);
  const csv=()=>{
    const rows=employees.map(e=>{const h=(e.punchHistory||[]).reduce((a,r)=>a+Number(r.hours||0),0);const g=e.role==="hourly"?h*Number(e.hourlyRate||0):Number(e.salary||0)/26;return `${e.name},${e.id},${e.role},${e.position},${h.toFixed(2)},${g.toFixed(2)}`;});
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([["Employee,ID,Type,Position,Hours,Gross Pay",...rows].join("\n")],{type:"text/csv"}));a.download="payroll.csv";a.click();
  };
  return (
    <div>
      <div className="stat-grid mb-20">
        <div className="stat-card"><div className="stat-label">Period Payroll</div><div className="stat-val green">{fmtCurrency(total)}</div></div>
        <div className="stat-card"><div className="stat-label">Active Employees</div><div className="stat-val blue">{employees.filter(e=>e.active).length}</div></div>
        <div className="stat-card"><div className="stat-label">Hourly Staff</div><div className="stat-val amber">{employees.filter(e=>e.role==="hourly").length}</div></div>
        <div className="stat-card"><div className="stat-label">Salaried Staff</div><div className="stat-val violet">{employees.filter(e=>e.role==="salary").length}</div></div>
      </div>
      <div className="arow"><div className="card-title">Payroll Summary</div>
        <button className="btn btn-ghost btn-sm" onClick={csv}><Icon name="download" size={13}/>Export CSV</button>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Employee</th><th>Type</th><th>Hours / Period</th><th>Rate</th><th>Gross Pay</th><th>Est. Net</th><th>Direct Deposit</th></tr></thead>
          <tbody>
            {employees.map((e,i)=>{
              const h=(e.punchHistory||[]).reduce((a,r)=>a+Number(r.hours||0),0);
              const g=e.role==="hourly"?h*Number(e.hourlyRate||0):Number(e.salary||0)/26;
              const n=g*(1-35.65/100);
              const dd=e.directDeposit||{};
              return (
                <tr key={i}>
                  <td><div className="fb">{e.name}</div><div className="txs tm">{e.id}</div></td>
                  <td><span className={`tag ${e.role==="salary"?"t-salary":"t-hourly"}`}>{e.role}</span></td>
                  <td>{e.role==="hourly"?`${h.toFixed(1)} hrs`:"Salary"}</td>
                  <td>{e.role==="hourly"?`$${e.hourlyRate}/hr`:`$${((e.salary||0)/1000).toFixed(0)}k/yr`}</td>
                  <td className="tg fb">{fmtCurrency(g)}</td>
                  <td className="ta">{fmtCurrency(n)}</td>
                  <td><div className="txs fb">{dd.bank||<span className="badge b-amber">Not Set</span>}</div>{dd.bank&&<div className="txs tm fmono">{dd.account}</div>}</td>
                </tr>
              );
            })}
            {!employees.length&&<tr><td colSpan={7} style={{textAlign:"center",padding:30,color:"var(--text2)"}}>No employees</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── ADMIN: DASHBOARD ─────────────────────────────────────────────────────────
function AdminDashboard({employees,officeLocation,setShowOffice}) {
  const total=employees.reduce((a,e)=>{const h=(e.punchHistory||[]).reduce((s,r)=>s+Number(r.hours||0),0);return a+(e.role==="hourly"?h*Number(e.hourlyRate||0):Number(e.salary||0)/26);},0);
  const pendingTO=employees.flatMap(e=>e.timeOffRequests||[]).filter(r=>r.status==="Pending").length;
  const totalHrs=employees.flatMap(e=>e.punchHistory||[]).reduce((a,r)=>a+Number(r.hours||0),0);
  return (
    <div>
      <div className="flex j-between items-c mb-24">
        <div><div style={{fontFamily:"'Outfit',sans-serif",fontSize:24,fontWeight:900,letterSpacing:"-.5px"}}>Admin Dashboard</div><div className="tm ts">Real-time workforce overview</div></div>
        <button className="btn btn-ghost btn-sm" onClick={()=>setShowOffice(true)}><Icon name="mapPin" size={13}/>{officeLocation?"Update Office Location":"Set Office Location"}</button>
      </div>
      <div className="stat-grid">
        <div className="stat-card"><div className="stat-label">Total Employees</div><div className="stat-val blue">{employees.length}</div></div>
        <div className="stat-card"><div className="stat-label">Period Payroll</div><div className="stat-val green">{fmtCurrency(total)}</div></div>
        <div className="stat-card"><div className="stat-label">Hours Logged</div><div className="stat-val amber">{totalHrs.toFixed(1)}</div></div>
        <div className="stat-card"><div className="stat-label">Pending Time Off</div><div className="stat-val violet">{pendingTO}</div></div>
        <div className="stat-card"><div className="stat-label">Active Staff</div><div className="stat-val blue">{employees.filter(e=>e.active).length}</div></div>
        <div className="stat-card"><div className="stat-label">Managers</div><div className="stat-val violet">{employees.filter(e=>e.manager).length}</div></div>
      </div>
      {officeLocation&&(
        <div className="card" style={{maxWidth:400,marginBottom:20}}>
          <div className="card-title mb-12 flex items-c gap-8"><Icon name="mapPin" size={15} color="var(--blue)"/>Office Location</div>
          <div className="irow"><span className="ilbl">Coordinates</span><span className="ival fmono txs">{officeLocation.lat.toFixed(5)}, {officeLocation.lng.toFixed(5)}</span></div>
          <div className="irow"><span className="ilbl">Allowed Radius</span><span className="ival">{officeLocation.radius}m</span></div>
        </div>
      )}
      <div className="card">
        <div className="card-title mb-16">Recent Activity</div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Employee</th><th>Role</th><th>Department</th><th>Hours</th><th>Direct Deposit</th><th>Status</th></tr></thead>
            <tbody>
              {employees.slice(0,8).map((e,i)=>{
                const h=(e.punchHistory||[]).reduce((a,r)=>a+Number(r.hours||0),0);
                return (
                  <tr key={i}>
                    <td><div className="flex items-c gap-8"><div className="avatar" style={{width:28,height:28,fontSize:10}}>{initials(e.name)}</div><div><div className="fb">{e.name}</div><div className="txs tm">{e.position}</div></div></div></td>
                    <td><span className={`tag ${e.role==="salary"?"t-salary":"t-hourly"}`}>{e.role}</span>{e.manager&&<span className="badge b-cyan" style={{marginLeft:5,fontSize:10}}>MGR</span>}</td>
                    <td>{e.department}</td>
                    <td className="tg">{h.toFixed(1)} hrs</td>
                    <td className="txs">{e.directDeposit?.bank||<span className="badge b-amber">Not Set</span>}</td>
                    <td><span className={`badge ${e.active?"b-green":"b-red"}`}>{e.active?"Active":"Inactive"}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── APP SHELLS ───────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function ThemeBtn({dark,setDark}) {
  return <button className="theme-btn" onClick={()=>setDark(!dark)}><Icon name={dark?"sun":"moon"} size={14}/>{dark?"Light Mode":"Dark Mode"}</button>;
}

function EmployeeApp({emp,employees,setEmployees,onLogout,reloadAll,dark,setDark,onOpenPOS}) {
  const [tab,setTab]=useState("home");
  const [showPwd,setShowPwd]=useState(false);
 
  const cur=employees.find(e=>e.id===emp.id)||emp;

  // Employee's own tabs
  const myTabs=[
    {id:"home",label:"Home",icon:"home"},
    {id:"timecard",label:"Time Card",icon:"clock"},
    {id:"pay",label:"Pay",icon:"dollar"},
    {id:"timeoff",label:"Time Off",icon:"calendar"},
    {id:"directdeposit",label:"Direct Deposit",icon:"bank"},
    {id:"tax",label:"Tax Withholding",icon:"file"},
    {id:"policies",label:"Policies",icon:"shield"},
    {id:"learning",label:"Learning",icon:"book"},
  ];
  // Manager-only tabs
  const mgrTabs=emp.manager?[
    {id:"mgrteam",label:"Team Overview",icon:"users"},
    {id:"mgrtimeoff",label:"Time Off Approvals",icon:"calendar"},
    {id:"mgrtimecards",label:"Team Time Cards",icon:"clock"},
    {id:"mgrschedule",label:"Team Schedule",icon:"calendar"},
  ]:[];

  const renderContent=()=>{
    switch(tab){
      case "home":           return <EmpHome emp={cur} employees={employees} setTab={setTab}/>;
      case "timecard":       return <EmpTimeCard emp={cur}/>;
      case "pay":            return <EmpPay emp={cur}/>;
      case "timeoff":        return <EmpTimeOff emp={cur} employees={employees} setEmployees={setEmployees} reloadAll={reloadAll}/>;
      case "directdeposit":  return <EmpDirectDeposit emp={cur}/>;
      case "tax":            return <EmpTax emp={cur}/>;
      case "policies":       return <EmpPolicies/>;
      case "learning":       return <EmpLearning/>;
      case "mgrteam":        return <MgrTeamOverview employees={employees}/>;
      case "mgrtimeoff":     return <MgrTimeOffApproval employees={employees} setEmployees={setEmployees} reloadAll={reloadAll}/>;
      case "mgrtimecards":   return <MgrTeamTimeCards employees={employees}/>;
      case "mgrschedule":    return <MgrTeamSchedule employees={employees}/>;
      default: return null;
    }
  };

  const currentTabLabel=[...myTabs,...mgrTabs].find(t=>t.id===tab)?.label||"Dashboard";

  return (
    <div className="shell">
      {showPwd&&<ChangePasswordModal empId={emp.id} onClose={()=>setShowPwd(false)}/>}
      <nav className="sidebar">
        <div className="sidebar-logo">
          <Logo size={38}/>
          <div><div className="logo-name">WorkForce Pro</div><div className="logo-sub">Employee Portal</div></div>
        </div>
        <div className="sidebar-nav">
          <div className="nav-section">My Portal</div>
          {myTabs.map(t=><button key={t.id} className={`nav-item ${tab===t.id?"active":""}`} onClick={()=>setTab(t.id)}><Icon name={t.icon} size={15}/><span>{t.label}</span></button>)}
          {emp.manager&&<>
            <div className="nav-section">Manager Tools</div>
            {mgrTabs.map(t=><button key={t.id} className={`nav-item ${tab===t.id?"active":""}`} onClick={()=>setTab(t.id)}><Icon name={t.icon} size={15}/><span>{t.label}</span></button>)}
          </>}
        </div>
        <div className="sidebar-bottom">
          <div className="user-chip">
            <div className="avatar">{initials(emp.name)}</div>
            <div className="user-info"><div className="user-name">{emp.name}</div><div className="user-role">{emp.manager?"Manager":"Employee"}</div></div>
            <button className="icon-btn" onClick={onLogout} title="Sign out"><Icon name="logout" size={14}/></button>
          </div>
        </div>
      </nav>
      <main className="main">
        <div className="topbar">
          <div className="topbar-title">{currentTabLabel}</div>
          {emp.manager&&<span className="badge b-violet">Manager</span>}
          {emp.manager&&<button className="btn btn-success btn-sm" onClick={onOpenPOS}><Icon name="cart" size={13}/>POS Register</button>}
          <button className="btn btn-ghost btn-sm" onClick={()=>setShowPwd(true)}><Icon name="key" size={13}/>Password</button>
          <ThemeBtn dark={dark} setDark={setDark}/>
          <button className="btn btn-ghost btn-sm" onClick={onLogout}><Icon name="logout" size={13}/>Sign Out</button>
        </div>
        <div className="page">{renderContent()}</div>
      </main>
    </div>
  );
}

function AdminApp({employees,setEmployees,onLogout,reloadAll,officeLocation,setOfficeLocation,dark,setDark,onOpenPOS}) {
  const [tab,setTab]=useState("dashboard");
  const [showOffice,setShowOffice]=useState(false);

  const adminTabs=[
    {id:"dashboard",label:"Dashboard",icon:"home"},
    {id:"employees",label:"Employees",icon:"users"},
    {id:"attendance",label:"Attendance",icon:"clock"},
    {id:"payroll",label:"Payroll",icon:"dollar"},
  ];

  const renderContent=()=>{
    switch(tab){
      case "dashboard":  return <AdminDashboard employees={employees} officeLocation={officeLocation} setShowOffice={setShowOffice}/>;
      case "employees":  return <AdminEmployees employees={employees} setEmployees={setEmployees} reloadAll={reloadAll}/>;
      case "attendance": return <AdminAttendance employees={employees}/>;
      case "payroll":    return <AdminPayroll employees={employees}/>;
      default: return null;
    }
  };

  return (
    <div className="shell">
      {showOffice&&<OfficeModal officeLocation={officeLocation} onSave={setOfficeLocation} onClose={()=>setShowOffice(false)}/>}
      <nav className="sidebar">
        <div className="sidebar-logo">
          <Logo size={38}/>
          <div><div className="logo-name">WorkForce Pro</div><div className="logo-sub">Admin Panel</div></div>
        </div>
        <div className="sidebar-nav">
          <div className="nav-section">Administration</div>
          {adminTabs.map(t=><button key={t.id} className={`nav-item ${tab===t.id?"active":""}`} onClick={()=>setTab(t.id)}><Icon name={t.icon} size={15}/><span>{t.label}</span></button>)}
          <div className="nav-section">Configuration</div>
          <button className="nav-item" onClick={()=>setShowOffice(true)}><Icon name="mapPin" size={15}/><span>Office Location</span></button>
          <div className="nav-section">Point of Sale</div>
          <button className="nav-item" style={{color:"var(--green)"}} onClick={onOpenPOS}><Icon name="cart" size={15}/><span style={{color:"var(--green)"}}>Open POS Register</span></button>
          <button className="nav-item" onClick={()=>setTab("employees")}><Icon name="settings" size={15}/><span>Settings</span></button>
        </div>
        <div className="sidebar-bottom">
          <div className="user-chip">
            <div className="avatar" style={{background:"linear-gradient(135deg,var(--red),var(--amber))"}}>AD</div>
            <div className="user-info"><div className="user-name">Administrator</div><div className="user-role">Super Admin</div></div>
            <button className="icon-btn" onClick={onLogout}><Icon name="logout" size={14}/></button>
          </div>
        </div>
      </nav>
      <main className="main">
        <div className="topbar">
          <div className="topbar-title">{adminTabs.find(t=>t.id===tab)?.label||"Admin"}</div>
          <span className="badge b-red">Admin</span>
          <button className="btn btn-ghost btn-sm" onClick={reloadAll}><Icon name="gps" size={13}/>Refresh</button>
          <ThemeBtn dark={dark} setDark={setDark}/>
          <button className="btn btn-ghost btn-sm" onClick={onLogout}><Icon name="logout" size={13}/>Sign Out</button>
        </div>
        <div className="page">{renderContent()}</div>
      </main>
    </div>
  );
}

// ─── PUNCH STATION ────────────────────────────────────────────────────────────
function PunchStation({employees,setEmployees,onBack,reloadAll,officeLocation}) {
  const [email,setEmail]=useState("");
  const [emp,setEmp]=useState(null);
  const [err,setErr]=useState("");
  const [punched,setPunched]=useState(null);
  const {pos,status,get}=useGPS();
  useEffect(()=>{if(officeLocation)get();},[officeLocation]); // eslint-disable-line react-hooks/exhaustive-deps

  const inRange=()=>{if(!officeLocation)return true;if(!pos)return false;return distM(pos.lat,pos.lng,officeLocation.lat,officeLocation.lng)<=officeLocation.radius;};

  const find=()=>{
    const found=employees.find(e=>e.email.toLowerCase()===email.toLowerCase()&&e.role==="hourly");
    if(!found){setErr("Employee not found or not hourly staff.");return;}
    setErr("");
    const alreadyIn=(found.punchHistory||[]).find(p=>p.date===today()&&!p.out);
    setEmp({...found,alreadyIn:!!alreadyIn});
  };

  const punch=async(type)=>{
    if(officeLocation&&!inRange()){setErr("You must be within office range to clock in/out.");return;}
    const now=timeNow();const d=today();
    if(type==="in"){
      const updated={...emp,punchHistory:[...(emp.punchHistory||[]),{date:d,in:now,out:null,hours:0,lat:pos?.lat,lng:pos?.lng}]};
      setEmployees(employees.map(e=>e.id===updated.id?updated:e));
      const {error}=await supabase.from("punch_history").insert({emp_id:emp.id,work_date:d,clock_in:now,clock_out:null,hours:0,lat:pos?.lat||null,lng:pos?.lng||null});
      if(error){alert("Clock-in failed: "+error.message);await reloadAll();return;}
      setPunched("in");setTimeout(async()=>{setEmp(null);setEmail("");setPunched(null);await reloadAll();},2000);
      return;
    }
    const idx=(emp.punchHistory||[]).findIndex(p=>p.date===d&&!p.out);
    if(idx<0)return;
    const hrs=calcHours(emp.punchHistory[idx].in,now);
    const nh=[...emp.punchHistory];nh[idx]={...nh[idx],out:now,hours:hrs};
    setEmployees(employees.map(e=>e.id===emp.id?{...emp,punchHistory:nh}:e));
    const {error}=await supabase.from("punch_history").update({clock_out:now,hours:hrs}).eq("emp_id",emp.id).eq("work_date",d).is("clock_out",null);
    if(error){alert("Clock-out failed: "+error.message);await reloadAll();return;}
    setPunched("out");setTimeout(async()=>{setEmp(null);setEmail("");setPunched(null);await reloadAll();},2000);
  };

  return (
    <div className="punch-screen">
      <div className="punch-card">
        <div className="flex j-between items-c" style={{marginBottom:6}}>
          <div style={{fontWeight:800,fontSize:13,color:"var(--text2)"}}>WorkForce Pro</div>
          <button className="btn btn-ghost btn-xs" onClick={onBack}>← Back</button>
        </div>
        <LiveClock/>
        {officeLocation&&(
          <div style={{marginBottom:14,textAlign:"center"}}>
            {status==="loading"&&<span className="gps-wait"><Icon name="gps" size={11}/>Getting location…</span>}
            {status==="ok"&&inRange()&&<span className="gps-ok"><Icon name="gps" size={11}/>Within office range</span>}
            {status==="ok"&&!inRange()&&<span className="gps-fail"><Icon name="gps" size={11}/>Outside range ({Math.round(distM(pos.lat,pos.lng,officeLocation.lat,officeLocation.lng))}m)</span>}
            {status==="denied"&&<span className="gps-fail"><Icon name="gps" size={11}/>GPS required — access denied</span>}
          </div>
        )}
        {punched&&(
          <div style={{background:punched==="in"?"var(--green-g)":"var(--red-g)",border:`1px solid ${punched==="in"?"rgba(16,185,129,.3)":"rgba(239,68,68,.3)"}`,borderRadius:16,padding:28,marginTop:8}}>
            <div style={{fontWeight:900,fontSize:24,color:punched==="in"?"var(--green)":"var(--red)",marginBottom:6}}>{punched==="in"?"✓ Clocked In!":"✓ Clocked Out!"}</div>
            <div className="tm">{emp?.name}</div>
          </div>
        )}
        {!punched&&!emp&&(
          <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:12,padding:20,marginBottom:14}}>
            <div style={{fontWeight:800,marginBottom:14,fontSize:14}}>Employee Clock Station</div>
            <div className="fg"><label className="fl">Your Email Address</label><input className="fi" type="email" placeholder="you@company.com" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&find()}/></div>
            {err&&<div className="alert a-error">{err}</div>}
            <button className="btn btn-primary w-full" onClick={find}>Find My Record</button>
          </div>
        )}
        {!punched&&emp&&<>
          <div style={{background:emp.alreadyIn?"var(--amber-g)":"var(--surface)",border:"1px solid var(--border)",borderRadius:12,padding:14,margin:"10px 0"}}>
            <div className="fb" style={{fontSize:15}}>{emp.name}</div>
            <div className="ts tm">{emp.position} · {emp.department}</div>
            <div style={{marginTop:8,fontSize:13,color:emp.alreadyIn?"var(--amber)":"var(--text2)"}}>{emp.alreadyIn?"🟡 Currently Clocked In":"⚪ Not Clocked In"}</div>
          </div>
          {err&&<div className="alert a-error">{err}</div>}
          <div style={{display:"grid",gap:10,marginTop:10}}>
            {!emp.alreadyIn&&<button className="pbtn in" onClick={()=>punch("in")}>CLOCK IN</button>}
            {emp.alreadyIn&&<button className="pbtn out" onClick={()=>punch("out")}>CLOCK OUT</button>}
            <button className="btn btn-ghost" onClick={()=>{setEmp(null);setEmail("");setErr("");}}>Cancel</button>
          </div>
        </>}
      </div>
    </div>
  );
}

// ─── LOGIN ─────────────────────────────────────────────────────────────────────
function Login({employees,onLogin,onPunch,dark,setDark}) {
  const [mode,setMode]=useState("employee");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [err,setErr]=useState("");
  const [showPwd,setShowPwd]=useState(false);
  const login=()=>{
    setErr("");
    if(mode==="admin"){
      if(email===ADMIN_CREDS.email&&password===ADMIN_CREDS.password)onLogin({type:"admin"});
      else setErr("Invalid admin credentials.");
    }else{
      const emp=employees.find(e=>e.email.toLowerCase()===email.toLowerCase()&&e.password===password&&e.active);
      if(emp)onLogin({type:"employee",emp});
      else setErr("Invalid email or password.");
    }
  };
  return (
    <div className="login-screen">
      <div style={{position:"absolute",top:20,right:20}}><ThemeBtn dark={dark} setDark={setDark}/></div>
      <div className="login-card">
        <div className="login-logo">
          <Logo size={52}/>
          <div className="login-title">WorkForce Pro</div>
          <div className="login-sub">Employee Management System</div>
        </div>
        <div className="login-tabs">
          <button className={`ltab ${mode==="employee"?"active":""}`} onClick={()=>{setMode("employee");setErr("");}}>Employee</button>
          <button className={`ltab ${mode==="admin"?"active":""}`} onClick={()=>{setMode("admin");setErr("");}}>Administrator</button>
        </div>
        {err&&<div className="alert a-error">{err}</div>}
        <div className="fg"><label className="fl">Email Address</label><input className="fi" type="email" placeholder={mode==="admin"?"admin@company.com":"your@company.com"} value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()}/></div>
        <div className="fg">
          <label className="fl">Password</label>
          <div style={{position:"relative"}}>
            <input className="fi" type={showPwd?"text":"password"} placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()} style={{paddingRight:42}}/>
            <button onClick={()=>setShowPwd(!showPwd)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"var(--text2)"}}>
              <Icon name={showPwd?"eyeOff":"eye"} size={15}/>
            </button>
          </div>
        </div>
        <button className="btn btn-primary w-full" style={{marginBottom:10}} onClick={login}>{mode==="admin"?"Sign In as Administrator":"Sign In"}</button>
        {mode==="employee"&&<button className="btn btn-ghost w-full" onClick={onPunch}><Icon name="clock" size={14}/>Hourly Clock In / Out Station</button>}
        <div style={{marginTop:16,padding:12,background:"var(--surface)",borderRadius:10,border:"1px solid var(--border)"}}>
          <div style={{fontSize:10,fontWeight:700,color:"var(--text3)",marginBottom:5,textTransform:"uppercase",letterSpacing:".8px"}}>Demo Credentials</div>
          <div className="txs tm">Admin: admin@company.com / admin2025</div>
          <div className="txs tm">Employee: marcus@company.com / pass123</div>
          <div className="txs tm">Manager: sarah@company.com / pass123</div>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// ─── POS MODULE ───────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const TAX_RATE = 0.08; // 8% sales tax — configurable

const SAMPLE_PRODUCTS = [
  { id:"P001", name:"Espresso",       category:"Coffee",    price:3.50,  cost:0.80,  stock:999, sku:"ESP001", active:true, emoji:"☕" },
  { id:"P002", name:"Latte",          category:"Coffee",    price:5.50,  cost:1.20,  stock:999, sku:"LAT001", active:true, emoji:"🥛" },
  { id:"P003", name:"Cappuccino",     category:"Coffee",    price:5.00,  cost:1.10,  stock:999, sku:"CAP001", active:true, emoji:"☕" },
  { id:"P004", name:"Croissant",      category:"Bakery",    price:4.25,  cost:1.50,  stock:30,  sku:"CRO001", active:true, emoji:"🥐" },
  { id:"P005", name:"Muffin",         category:"Bakery",    price:3.75,  cost:1.00,  stock:24,  sku:"MUF001", active:true, emoji:"🧁" },
  { id:"P006", name:"Sandwich",       category:"Food",      price:8.50,  cost:3.00,  stock:15,  sku:"SAN001", active:true, emoji:"🥪" },
  { id:"P007", name:"Orange Juice",   category:"Drinks",    price:4.00,  cost:1.20,  stock:40,  sku:"OJ001",  active:true, emoji:"🍊" },
  { id:"P008", name:"Water Bottle",   category:"Drinks",    price:2.00,  cost:0.40,  stock:60,  sku:"WAT001", active:true, emoji:"💧" },
  { id:"P009", name:"Chocolate Cake", category:"Bakery",    price:6.00,  cost:2.00,  stock:10,  sku:"CHK001", active:true, emoji:"🍰" },
  { id:"P010", name:"Green Tea",      category:"Tea",       price:3.50,  cost:0.60,  stock:999, sku:"GT001",  active:true, emoji:"🍵" },
  { id:"P011", name:"Iced Coffee",    category:"Coffee",    price:5.00,  cost:1.00,  stock:999, sku:"IC001",  active:true, emoji:"🧊" },
  { id:"P012", name:"Bagel",          category:"Bakery",    price:3.00,  cost:0.80,  stock:20,  sku:"BAG001", active:true, emoji:"🥯" },
];

// ─── POS: REGISTER (main checkout screen) ─────────────────────────────────────
function POSRegister({ products, setProducts, cashier, onSaleComplete }) {
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [discount, setDiscount] = useState(0);
  const [payMode, setPayMode] = useState(null); // null | "cash" | "card"
  const [cashGiven, setCashGiven] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [note, setNote] = useState("");

  const cats = ["All", ...new Set((products||[]).map(p => p.category))];
  const active = (products||[]).filter(p => p.active &&
    (catFilter === "All" || p.category === catFilter) &&
    (p.name.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase()))
  );

  const subtotal = cart.reduce((a, i) => a + i.price * i.qty, 0);
  const discAmt  = subtotal * (Number(discount) / 100);
  const taxable  = subtotal - discAmt;
  const tax      = taxable * TAX_RATE;
  const total    = taxable + tax;
  const change   = Number(cashGiven || 0) - total;

  const addToCart = (prod) => {
    if (prod.stock !== 999 && prod.stock <= 0) return;
    setCart(c => {
      const ex = c.find(i => i.id === prod.id);
      if (ex) return c.map(i => i.id === prod.id ? { ...i, qty: i.qty + 1 } : i);
      return [...c, { ...prod, qty: 1 }];
    });
  };

  const updateQty = (id, delta) => {
    setCart(c => c.map(i => i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i).filter(i => i.qty > 0));
  };

  const removeItem = (id) => setCart(c => c.filter(i => i.id !== id));

  const completeSale = async (method) => {
    if (method === "cash" && Number(cashGiven) < total) return;
    const sale = {
      id: `S${Date.now()}`,
      cashier_id: cashier?.id || null,
      cashier_name: cashier?.name || "Admin",
      items: cart.map(i => ({ id: i.id, name: i.name, qty: i.qty, price: i.price, category: i.category })),
      subtotal, discount: discAmt, tax, total,
      payment_method: method,
      cash_given: method === "cash" ? Number(cashGiven) : null,
      change_due: method === "cash" ? change : null,
      note,
      created_at: new Date().toISOString(),
    };
    // Save to Supabase
    const { error } = await supabase.from("pos_sales").insert({
      id: sale.id, cashier_id: sale.cashier_id, cashier_name: sale.cashier_name,
      items: sale.items, subtotal: sale.subtotal, discount_amount: sale.discount,
      tax: sale.tax, total: sale.total, payment_method: sale.payment_method,
      cash_given: sale.cash_given, change_due: sale.change_due, note: sale.note,
    });
    if (error) { alert("Sale save failed: " + error.message); return; }

    // Update stock
    const stockUpdates = cart.filter(i => i.stock !== 999);
    for (const item of stockUpdates) {
      const newStock = Math.max(0, item.stock - item.qty);
      await supabase.from("pos_products").update({ stock: newStock }).eq("id", item.id);
      setProducts(ps => ps.map(p => p.id === item.id ? { ...p, stock: newStock } : p));
    }

    setReceipt({ ...sale, changeDisplay: method === "cash" ? change : null });
    setCart([]); setDiscount(0); setCashGiven(""); setNote(""); setPayMode(null);
    if (onSaleComplete) onSaleComplete(sale);
  };

  if (receipt) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"60vh" }}>
      <div className="card" style={{ maxWidth:420, width:"100%", textAlign:"center" }}>
        <div style={{ fontSize:52, marginBottom:8 }}>✅</div>
        <div style={{ fontSize:22, fontWeight:900, marginBottom:4, color:"var(--green)" }}>Sale Complete!</div>
        <div className="tm ts mb-16">Order #{receipt.id.slice(-6).toUpperCase()}</div>
        <div style={{ background:"var(--bg3)", borderRadius:"var(--r)", padding:16, marginBottom:16, textAlign:"left" }}>
          {receipt.items.map((it, i) => (
            <div key={i} className="flex j-between ts mb-4">
              <span>{it.name} × {it.qty}</span>
              <span className="fb">{fmtCurrency(it.price * it.qty)}</span>
            </div>
          ))}
          <div className="divider"/>
          <div className="flex j-between ts mb-4"><span className="tm">Subtotal</span><span>{fmtCurrency(receipt.subtotal)}</span></div>
          {receipt.discount > 0 && <div className="flex j-between ts mb-4 tr"><span>Discount</span><span>-{fmtCurrency(receipt.discount)}</span></div>}
          <div className="flex j-between ts mb-4"><span className="tm">Tax (8%)</span><span>{fmtCurrency(receipt.tax)}</span></div>
          <div className="flex j-between fb" style={{ fontSize:16 }}><span>Total</span><span className="tg">{fmtCurrency(receipt.total)}</span></div>
          {receipt.changeDisplay !== null && receipt.changeDisplay !== undefined && (
            <div className="flex j-between ts mt-8 tb fb"><span>Change</span><span>{fmtCurrency(receipt.changeDisplay)}</span></div>
          )}
        </div>
        <div className="flex gap-8">
          <button className="btn btn-primary" style={{ flex:1 }} onClick={() => setReceipt(null)}>New Sale</button>
          <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>🖨 Print</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 360px", gap:18, height:"calc(100vh - 110px)" }}>
      {/* LEFT: Product Grid */}
      <div style={{ display:"flex", flexDirection:"column", gap:12, overflow:"hidden" }}>
        <div className="flex gap-8 items-c" style={{ flexWrap:"wrap" }}>
          <input className="fi" style={{ flex:1, minWidth:160 }} placeholder="🔍 Search products or SKU…" value={search} onChange={e => setSearch(e.target.value)}/>
          <div className="flex gap-4" style={{ flexWrap:"wrap" }}>
            {cats.map(c => (
              <button key={c} onClick={() => setCatFilter(c)}
                style={{ padding:"5px 12px", borderRadius:20, border:"1px solid var(--border)", background: catFilter===c ? "var(--blue)" : "var(--surface)", color: catFilter===c ? "white" : "var(--text2)", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'Outfit',sans-serif" }}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(140px, 1fr))", gap:10, overflowY:"auto", paddingBottom:8 }}>
          {active.map(prod => (
            <button key={prod.id} onClick={() => addToCart(prod)} disabled={prod.stock !== 999 && prod.stock <= 0}
              style={{ background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:14, padding:"14px 10px", cursor: prod.stock===999||prod.stock>0 ? "pointer":"not-allowed", transition:"all .15s", textAlign:"center", opacity: prod.stock!==999&&prod.stock<=0?0.4:1, fontFamily:"'Outfit',sans-serif" }}
              onMouseOver={e=>{if(prod.stock===999||prod.stock>0){e.currentTarget.style.borderColor="var(--blue)";e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 6px 20px var(--blue-g)";}}}
              onMouseOut={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}>
              <div style={{ fontSize:28, marginBottom:6 }}>{prod.emoji || "📦"}</div>
              <div style={{ fontWeight:700, fontSize:13, lineHeight:1.2, marginBottom:4 }}>{prod.name}</div>
              <div style={{ color:"var(--green)", fontWeight:900, fontSize:15 }}>{fmtCurrency(prod.price)}</div>
              {prod.stock !== 999 && <div style={{ fontSize:10, color: prod.stock<5?"var(--red)":"var(--text2)", marginTop:3 }}>{prod.stock} left</div>}
              <div style={{ fontSize:10, color:"var(--text3)", marginTop:2 }}>{prod.category}</div>
            </button>
          ))}
          {!active.length && <div style={{ gridColumn:"1/-1", textAlign:"center", padding:40, color:"var(--text2)" }}>No products found</div>}
        </div>
      </div>

      {/* RIGHT: Cart */}
      <div style={{ display:"flex", flexDirection:"column", background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:18, overflow:"hidden", boxShadow:"var(--shadow)" }}>
        <div style={{ padding:"14px 16px", borderBottom:"1px solid var(--border)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontWeight:800, fontSize:15 }}>🛒 Cart ({cart.reduce((a,i)=>a+i.qty,0)} items)</div>
          {cart.length > 0 && <button className="btn btn-danger btn-xs" onClick={() => setCart([])}>Clear</button>}
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:"10px 14px" }}>
          {!cart.length && <div style={{ textAlign:"center", padding:"40px 0", color:"var(--text2)", fontSize:13 }}>
            <div style={{ fontSize:36, marginBottom:8 }}>🛒</div>
            <div>Tap products to add them</div>
          </div>}
          {cart.map(item => (
            <div key={item.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 0", borderBottom:"1px solid var(--border)" }}>
              <div style={{ fontSize:20 }}>{item.emoji||"📦"}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700, fontSize:13, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{item.name}</div>
                <div style={{ color:"var(--green)", fontSize:12, fontWeight:600 }}>{fmtCurrency(item.price)} ea</div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                <button onClick={() => updateQty(item.id, -1)} style={{ width:24, height:24, borderRadius:6, border:"1px solid var(--border)", background:"var(--surface)", cursor:"pointer", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text)", fontFamily:"'Outfit',sans-serif" }}>−</button>
                <span style={{ width:22, textAlign:"center", fontWeight:700, fontSize:13 }}>{item.qty}</span>
                <button onClick={() => updateQty(item.id, 1)} style={{ width:24, height:24, borderRadius:6, border:"1px solid var(--border)", background:"var(--surface)", cursor:"pointer", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text)", fontFamily:"'Outfit',sans-serif" }}>+</button>
              </div>
              <div style={{ fontWeight:700, fontSize:13, minWidth:52, textAlign:"right", color:"var(--blue)" }}>{fmtCurrency(item.price*item.qty)}</div>
              <button onClick={() => removeItem(item.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text2)", padding:2 }}><Icon name="x" size={13}/></button>
            </div>
          ))}
        </div>

        {/* Totals + payment */}
        <div style={{ padding:"12px 14px", borderTop:"1px solid var(--border)", background:"var(--bg3)" }}>
          <div className="flex j-between ts mb-6"><span className="tm">Subtotal</span><span>{fmtCurrency(subtotal)}</span></div>
          <div className="flex gap-8 items-c mb-6">
            <span className="tm ts" style={{ flex:1 }}>Discount %</span>
            <input type="number" min="0" max="100" className="fi" style={{ width:70, padding:"4px 8px", fontSize:13, marginBottom:0 }} value={discount} onChange={e => setDiscount(e.target.value)}/>
            {discAmt > 0 && <span className="tr ts">-{fmtCurrency(discAmt)}</span>}
          </div>
          <div className="flex j-between ts mb-6"><span className="tm">Tax (8%)</span><span>{fmtCurrency(tax)}</span></div>
          <div className="flex j-between fb mb-12" style={{ fontSize:18, borderTop:"1px solid var(--border)", paddingTop:10, marginTop:4 }}>
            <span>Total</span><span className="tg">{fmtCurrency(total)}</span>
          </div>

          <div className="fg mb-8"><label className="fl">Order Note</label><input className="fi" placeholder="Optional note…" value={note} onChange={e=>setNote(e.target.value)}/></div>

          {!payMode && (
            <div className="flex gap-8">
              <button className="btn btn-success" style={{ flex:1 }} disabled={!cart.length} onClick={() => { completeSale("card"); }}>
                💳 Card
              </button>
              <button className="btn btn-amber" style={{ flex:1 }} disabled={!cart.length} onClick={() => setPayMode("cash")}>
                💵 Cash
              </button>
            </div>
          )}

          {payMode === "cash" && (
            <div>
              <div className="fg"><label className="fl">Cash Received</label>
                <input className="fi" type="number" step="0.01" placeholder={`Min $${total.toFixed(2)}`} value={cashGiven} onChange={e=>setCashGiven(e.target.value)} autoFocus/>
              </div>
              {Number(cashGiven) > 0 && (
                <div className={`alert ${change >= 0 ? "a-success" : "a-error"} mb-8`}>
                  {change >= 0 ? `✓ Change due: ${fmtCurrency(change)}` : `⚠ Need ${fmtCurrency(-change)} more`}
                </div>
              )}
              <div className="flex gap-8">
                <button className="btn btn-success" style={{ flex:1 }} disabled={Number(cashGiven) < total} onClick={() => completeSale("cash")}>
                  ✓ Complete Sale
                </button>
                <button className="btn btn-ghost" onClick={() => { setPayMode(null); setCashGiven(""); }}>Back</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── POS: PRODUCT MANAGEMENT ──────────────────────────────────────────────────
function POSProducts({ products, setProducts }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editProd, setEditProd] = useState(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name:"", category:"", price:"", cost:"", stock:"", sku:"", emoji:"📦", active:true });
  const [saving, setSaving] = useState(false);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => { setForm({ name:"", category:"", price:"", cost:"", stock:"", sku:"", emoji:"📦", active:true }); setEditProd(null); setShowAdd(true); };
  const openEdit = (p) => { setForm({ ...p }); setEditProd(p); setShowAdd(true); };

  const save = async () => {
    if (!form.name || !form.price) return;
    setSaving(true);
    const payload = { name:form.name, category:form.category||"General", price:Number(form.price), cost:Number(form.cost||0), stock:Number(form.stock||999), sku:form.sku||"", emoji:form.emoji||"📦", active:form.active!==false };
    if (editProd) {
      const { error } = await supabase.from("pos_products").update(payload).eq("id", editProd.id);
      if (error) { alert("Update failed: " + error.message); setSaving(false); return; }
      setProducts(ps => ps.map(p => p.id === editProd.id ? { ...p, ...payload } : p));
    } else {
      const newId = `P${Date.now()}`;
      const { error } = await supabase.from("pos_products").insert({ id:newId, ...payload });
      if (error) { alert("Add failed: " + error.message); setSaving(false); return; }
      setProducts(ps => [...ps, { id:newId, ...payload }]);
    }
    setSaving(false); setShowAdd(false);
  };

  const del = async (id) => {
    if (!window.confirm("Delete this product?")) return;
    await supabase.from("pos_products").delete().eq("id", id);
    setProducts(ps => ps.filter(p => p.id !== id));
  };

  const toggle = async (id, active) => {
    await supabase.from("pos_products").update({ active }).eq("id", id);
    setProducts(ps => ps.map(p => p.id === id ? { ...p, active } : p));
  };

  return (
    <div>
      <div className="arow">
        <input className="fi" style={{ maxWidth:260 }} placeholder="Search products…" value={search} onChange={e=>setSearch(e.target.value)}/>
        <button className="btn btn-primary" onClick={openAdd}><Icon name="plus" size={14}/>Add Product</button>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Cost</th><th>Margin</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map((p, i) => {
              const margin = p.price > 0 ? ((p.price - p.cost) / p.price * 100) : 0;
              return (
                <tr key={i}>
                  <td><div className="flex items-c gap-8"><span style={{fontSize:20}}>{p.emoji||"📦"}</span><div><div className="fb">{p.name}</div><div className="txs tm fmono">{p.sku}</div></div></div></td>
                  <td><span className="badge b-blue" style={{fontSize:10}}>{p.category}</span></td>
                  <td className="tg fb">{fmtCurrency(p.price)}</td>
                  <td className="tm">{fmtCurrency(p.cost)}</td>
                  <td><span style={{ color: margin>50?"var(--green)":margin>25?"var(--amber)":"var(--red)", fontWeight:700 }}>{margin.toFixed(0)}%</span></td>
                  <td><span style={{ color: p.stock===999?"var(--text2)":p.stock<5?"var(--red)":p.stock<15?"var(--amber)":"var(--green)", fontWeight:700 }}>{p.stock===999?"∞":p.stock}</span></td>
                  <td>
                    <button onClick={() => toggle(p.id, !p.active)} className={`badge ${p.active?"b-green":"b-red"}`} style={{cursor:"pointer",border:"none",background:p.active?"var(--green-g)":"var(--red-g)"}}>
                      {p.active?"Active":"Inactive"}
                    </button>
                  </td>
                  <td>
                    <div className="flex gap-6">
                      <button className="icon-btn tb" onClick={() => openEdit(p)}><Icon name="edit" size={14}/></button>
                      <button className="icon-btn tr" onClick={() => del(p.id)}><Icon name="trash" size={14}/></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!filtered.length && <tr><td colSpan={8} style={{textAlign:"center",padding:32,color:"var(--text2)"}}>No products found</td></tr>}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="overlay" onClick={e=>e.target===e.currentTarget&&setShowAdd(false)}>
          <div className="modal">
            <div className="modal-title"><span style={{fontSize:22}}>{form.emoji||"📦"}</span>{editProd ? "Edit Product" : "New Product"}</div>
            <div className="g2" style={{gap:12}}>
              <div className="fg"><label className="fl">Product Name</label><input className="fi" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
              <div className="fg"><label className="fl">Emoji Icon</label><input className="fi" value={form.emoji} onChange={e=>setForm({...form,emoji:e.target.value})} placeholder="📦"/></div>
            </div>
            <div className="g2" style={{gap:12}}>
              <div className="fg"><label className="fl">Category</label><input className="fi" value={form.category} onChange={e=>setForm({...form,category:e.target.value})} placeholder="Coffee, Bakery…"/></div>
              <div className="fg"><label className="fl">SKU</label><input className="fi" value={form.sku} onChange={e=>setForm({...form,sku:e.target.value})} placeholder="ABC001"/></div>
            </div>
            <div className="g2" style={{gap:12}}>
              <div className="fg"><label className="fl">Sale Price ($)</label><input className="fi" type="number" step="0.01" value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/></div>
              <div className="fg"><label className="fl">Cost ($)</label><input className="fi" type="number" step="0.01" value={form.cost} onChange={e=>setForm({...form,cost:e.target.value})}/></div>
            </div>
            <div className="fg"><label className="fl">Stock (leave blank for unlimited)</label><input className="fi" type="number" value={form.stock===999?"":form.stock} onChange={e=>setForm({...form,stock:e.target.value===""?999:Number(e.target.value)})} placeholder="Leave blank = unlimited"/></div>
            {form.price>0&&form.cost>0&&<div className="alert a-info mb-8">Margin: {((Number(form.price)-Number(form.cost))/Number(form.price)*100).toFixed(1)}% · Profit: {fmtCurrency(form.price-form.cost)} per unit</div>}
            <div className="flex gap-8">
              <button className="btn btn-primary" style={{flex:1}} onClick={save} disabled={saving}>{saving?"Saving…":editProd?"Update Product":"Add Product"}</button>
              <button className="btn btn-ghost" onClick={()=>setShowAdd(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── POS: SALES HISTORY ───────────────────────────────────────────────────────
function POSSalesHistory({ sales }) {
  const [viewSale, setViewSale] = useState(null);
  const [dateFilter, setDateFilter] = useState("");

  const filtered = sales.filter(s => !dateFilter || s.created_at?.slice(0,10) === dateFilter);
  const sorted = [...filtered].sort((a,b) => (b.created_at||"").localeCompare(a.created_at||""));

  return (
    <div>
      <div className="arow">
        <div className="flex gap-8 items-c">
          <label className="fl" style={{marginBottom:0}}>Filter by date:</label>
          <input type="date" className="fi" style={{width:"auto"}} value={dateFilter} onChange={e=>setDateFilter(e.target.value)}/>
          {dateFilter && <button className="btn btn-ghost btn-sm" onClick={()=>setDateFilter("")}>Clear</button>}
        </div>
        <div className="ts tm">{sorted.length} transaction{sorted.length!==1?"s":""}</div>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Order #</th><th>Time</th><th>Cashier</th><th>Items</th><th>Subtotal</th><th>Tax</th><th>Total</th><th>Payment</th><th></th></tr></thead>
          <tbody>
            {sorted.map((s, i) => (
              <tr key={i}>
                <td className="fb fmono" style={{fontSize:12}}>#{(s.id||"").slice(-6).toUpperCase()}</td>
                <td className="ts tm">{s.created_at ? new Date(s.created_at).toLocaleString() : "—"}</td>
                <td>{s.cashier_name||"—"}</td>
                <td className="ts">{(s.items||[]).length} item{(s.items||[]).length!==1?"s":""}</td>
                <td>{fmtCurrency(s.subtotal)}</td>
                <td className="tm">{fmtCurrency(s.tax)}</td>
                <td className="tg fb">{fmtCurrency(s.total)}</td>
                <td><span className={`badge ${s.payment_method==="card"?"b-blue":"b-amber"}`}>{s.payment_method==="card"?"💳 Card":"💵 Cash"}</span></td>
                <td><button className="btn btn-ghost btn-xs" onClick={()=>setViewSale(s)}>View</button></td>
              </tr>
            ))}
            {!sorted.length&&<tr><td colSpan={9} style={{textAlign:"center",padding:32,color:"var(--text2)"}}>No sales found</td></tr>}
          </tbody>
        </table>
      </div>

      {viewSale && (
        <div className="overlay" onClick={e=>e.target===e.currentTarget&&setViewSale(null)}>
          <div className="modal">
            <div className="modal-title">Receipt — #{(viewSale.id||"").slice(-6).toUpperCase()}</div>
            <div className="ts tm mb-16">{viewSale.created_at ? new Date(viewSale.created_at).toLocaleString() : ""} · {viewSale.cashier_name}</div>
            {(viewSale.items||[]).map((it,i)=>(
              <div key={i} className="flex j-between ts mb-6"><span>{it.name} × {it.qty}</span><span className="fb">{fmtCurrency(it.price*it.qty)}</span></div>
            ))}
            <div className="divider"/>
            <div className="flex j-between ts mb-4"><span className="tm">Subtotal</span><span>{fmtCurrency(viewSale.subtotal)}</span></div>
            {viewSale.discount_amount>0&&<div className="flex j-between ts mb-4 tr"><span>Discount</span><span>-{fmtCurrency(viewSale.discount_amount)}</span></div>}
            <div className="flex j-between ts mb-4"><span className="tm">Tax</span><span>{fmtCurrency(viewSale.tax)}</span></div>
            <div className="flex j-between fb mb-16" style={{fontSize:16}}><span>Total</span><span className="tg">{fmtCurrency(viewSale.total)}</span></div>
            {viewSale.note&&<div className="ts tm mb-12">Note: {viewSale.note}</div>}
            <button className="btn btn-ghost w-full" onClick={()=>setViewSale(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── POS: ANALYTICS DASHBOARD ─────────────────────────────────────────────────
function POSAnalytics({ sales, products }) {
  const now = new Date();
  const todayStr = now.toISOString().slice(0,10);
  const thisMonth = now.toISOString().slice(0,7);

  const todaySales = sales.filter(s => s.created_at?.slice(0,10) === todayStr);
  const monthSales = sales.filter(s => s.created_at?.slice(0,7) === thisMonth);

  const todayRev  = todaySales.reduce((a,s) => a + Number(s.total||0), 0);
  const monthRev  = monthSales.reduce((a,s) => a + Number(s.total||0), 0);
  const totalRev  = sales.reduce((a,s) => a + Number(s.total||0), 0);
  const avgTicket = sales.length ? totalRev / sales.length : 0;

  // Best sellers
  const itemCounts = {};
  sales.forEach(s => (s.items||[]).forEach(it => {
    itemCounts[it.name] = (itemCounts[it.name]||0) + it.qty;
  }));
  const topItems = Object.entries(itemCounts).sort((a,b)=>b[1]-a[1]).slice(0,5);

  // Revenue by category
  const catRev = {};
  sales.forEach(s => (s.items||[]).forEach(it => {
    catRev[it.category||"Other"] = (catRev[it.category||"Other"]||0) + it.price * it.qty;
  }));
  const topCats = Object.entries(catRev).sort((a,b)=>b[1]-a[1]);

  // Payment split
  const cardCount = sales.filter(s=>s.payment_method==="card").length;
  const cashCount = sales.filter(s=>s.payment_method==="cash").length;

  // Low stock
  const lowStock = products.filter(p => p.stock !== 999 && p.stock < 10 && p.active);

  return (
    <div>
      <div className="stat-grid mb-20">
        <div className="stat-card"><div className="stat-label">Today's Revenue</div><div className="stat-val green">{fmtCurrency(todayRev)}</div><div className="txs tm mt-8">{todaySales.length} transactions</div></div>
        <div className="stat-card"><div className="stat-label">This Month</div><div className="stat-val blue">{fmtCurrency(monthRev)}</div><div className="txs tm mt-8">{monthSales.length} transactions</div></div>
        <div className="stat-card"><div className="stat-label">All-Time Revenue</div><div className="stat-val violet">{fmtCurrency(totalRev)}</div><div className="txs tm mt-8">{sales.length} total sales</div></div>
        <div className="stat-card"><div className="stat-label">Avg Ticket</div><div className="stat-val amber">{fmtCurrency(avgTicket)}</div><div className="txs tm mt-8">per transaction</div></div>
      </div>

      <div className="g2 mb-18">
        <div className="card">
          <div className="card-title mb-16">🏆 Top Selling Items</div>
          {!topItems.length && <div className="tm ts">No sales data yet</div>}
          {topItems.map(([name, qty], i) => (
            <div key={i} className="flex j-between items-c mb-10">
              <div className="flex items-c gap-10">
                <div style={{ width:24, height:24, borderRadius:6, background:"var(--blue-g)", color:"var(--blue)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:900 }}>{i+1}</div>
                <span className="fb ts">{name}</span>
              </div>
              <div className="flex items-c gap-10">
                <div style={{ width:80, height:6, background:"var(--bg3)", borderRadius:3, overflow:"hidden" }}>
                  <div style={{ height:"100%", background:"var(--blue)", width:`${(qty/(topItems[0]?.[1]||1))*100}%`, borderRadius:3 }}/>
                </div>
                <span className="tb fb ts">{qty} sold</span>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-title mb-16">📊 Revenue by Category</div>
          {!topCats.length && <div className="tm ts">No sales data yet</div>}
          {topCats.map(([cat, rev], i) => (
            <div key={i} className="flex j-between items-c mb-10">
              <span className="fb ts">{cat}</span>
              <div className="flex items-c gap-10">
                <div style={{ width:80, height:6, background:"var(--bg3)", borderRadius:3, overflow:"hidden" }}>
                  <div style={{ height:"100%", background:"var(--green)", width:`${(rev/(topCats[0]?.[1]||1))*100}%`, borderRadius:3 }}/>
                </div>
                <span className="tg fb ts">{fmtCurrency(rev)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="g2">
        <div className="card">
          <div className="card-title mb-16">💳 Payment Methods</div>
          <div style={{ display:"flex", gap:12, marginBottom:16 }}>
            <div style={{ flex:1, padding:16, background:"var(--blue-g)", borderRadius:12, textAlign:"center" }}>
              <div style={{ fontSize:28 }}>💳</div>
              <div style={{ fontWeight:900, fontSize:22, color:"var(--blue)" }}>{cardCount}</div>
              <div className="ts tm">Card Payments</div>
              <div className="txs tm">{sales.length ? Math.round(cardCount/sales.length*100) : 0}%</div>
            </div>
            <div style={{ flex:1, padding:16, background:"var(--amber-g)", borderRadius:12, textAlign:"center" }}>
              <div style={{ fontSize:28 }}>💵</div>
              <div style={{ fontWeight:900, fontSize:22, color:"var(--amber)" }}>{cashCount}</div>
              <div className="ts tm">Cash Payments</div>
              <div className="txs tm">{sales.length ? Math.round(cashCount/sales.length*100) : 0}%</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title mb-12">⚠️ Low Stock Alert</div>
          {!lowStock.length && <div className="alert a-success">All products are well stocked!</div>}
          {lowStock.map((p, i) => (
            <div key={i} className="flex j-between items-c mb-8 p-10" style={{ background:"var(--red-g)", borderRadius:8, padding:"8px 12px" }}>
              <div className="flex items-c gap-8"><span>{p.emoji}</span><span className="fb ts">{p.name}</span></div>
              <span style={{ color:"var(--red)", fontWeight:700, fontSize:13 }}>{p.stock} left</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── POS APP SHELL ─────────────────────────────────────────────────────────────
function POSApp({ cashier, onBack, dark, setDark }) {
  const [tab, setTab] = useState("register");
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadPOS = useCallback(async () => {
    const [pr, sr] = await Promise.all([
      supabase.from("pos_products").select("*").order("name"),
      supabase.from("pos_sales").select("*").order("created_at", { ascending:false }).limit(500),
    ]);
    if (pr.data) setProducts(pr.data.length ? pr.data : SAMPLE_PRODUCTS);
    if (sr.data) setSales(sr.data);
    if (!pr.data?.length) {
      // seed sample products
      await supabase.from("pos_products").insert(SAMPLE_PRODUCTS.map(p=>({
        id:p.id,name:p.name,category:p.category,price:p.price,cost:p.cost,stock:p.stock,sku:p.sku,emoji:p.emoji,active:p.active
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadPOS(); }, [loadPOS]);

  const onSaleComplete = (sale) => {
    setSales(s => [{ ...sale, discount_amount: sale.discount }, ...s]);
  };

  const posTabs = [
    { id:"register",  label:"Register",  icon:"dollar" },
    { id:"products",  label:"Products",  icon:"book" },
    { id:"sales",     label:"Sales Log", icon:"file" },
    { id:"analytics", label:"Analytics", icon:"home" },
  ];

  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="sidebar-logo">
          <Logo size={38}/>
          <div><div className="logo-name">WorkForce POS</div><div className="logo-sub">Point of Sale</div></div>
        </div>
        <div className="sidebar-nav">
          <div className="nav-section">Point of Sale</div>
          {posTabs.map(t => (
            <button key={t.id} className={`nav-item ${tab===t.id?"active":""}`} onClick={() => setTab(t.id)}>
              <Icon name={t.icon} size={15}/><span>{t.label}</span>
            </button>
          ))}
          <div className="nav-section">Navigation</div>
          <button className="nav-item" onClick={onBack}><Icon name="home" size={15}/><span>Back to HR</span></button>
        </div>
        <div className="sidebar-bottom">
          <div className="user-chip">
            <div className="avatar" style={{ background:"linear-gradient(135deg,var(--green),var(--cyan))" }}>{initials(cashier?.name||"AD")}</div>
            <div className="user-info"><div className="user-name">{cashier?.name||"Administrator"}</div><div className="user-role">Cashier</div></div>
          </div>
        </div>
      </nav>
      <main className="main">
        <div className="topbar">
          <div className="topbar-title">{posTabs.find(t=>t.id===tab)?.label}</div>
          <span className="badge b-green">POS</span>
          <button className="btn btn-ghost btn-sm" onClick={loadPOS}><Icon name="gps" size={13}/>Refresh</button>
          <ThemeBtn dark={dark} setDark={setDark}/>
          <button className="btn btn-ghost btn-sm" onClick={onBack}><Icon name="logout" size={13}/>HR Portal</button>
        </div>
        <div className="page">
          {loading ? (
            <div style={{ textAlign:"center", padding:60, color:"var(--text2)" }}>Loading POS…</div>
          ) : (
            <>
              {tab==="register"  && <POSRegister products={products} setProducts={setProducts} cashier={cashier} onSaleComplete={onSaleComplete}/>}
              {tab==="products"  && <POSProducts products={products} setProducts={setProducts}/>}
              {tab==="sales"     && <POSSalesHistory sales={sales}/>}
              {tab==="analytics" && <POSAnalytics sales={sales} products={products}/>}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

// ─── ROOT ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [employees,setEmployees]=useState([]);
  const [session,setSession]=useState(null);
  const [showPunch,setShowPunch]=useState(false);
  const [loading,setLoading]=useState(true);
  const [fatal,setFatal]=useState("");
  const [dark,setDark]=useState(true);
  const [officeLocation,setOfficeLocation]=useState(null);
  const [posMode,setPosMode]=useState(false);

  useEffect(()=>{
    const el=document.createElement("style");el.textContent=getCSS(dark);
    document.head.appendChild(el);return()=>document.head.removeChild(el);
  },[dark]);

  const reloadAll=useMemo(()=>async function reloadAll(){
    setFatal("");
    try{
      const [e,p,t,s]=await Promise.all([
        supabase.from("employees").select("*").order("id"),
        supabase.from("punch_history").select("*"),
        supabase.from("time_off_requests").select("*"),
        supabase.from("pay_statements").select("*"),
      ]);
      if(e.error)throw new Error(e.error.message);
      setEmployees(fromDb(e.data||[],p.data||[],t.data||[],s.data||[]));
      const locRes = await supabase.from("settings").select("value").eq("key","office_location").maybeSingle();
      const loc = locRes.data;
      if(loc?.value)setOfficeLocation(loc.value);
    }catch(err){setFatal(String(err.message||err));}
  },[]);

  useEffect(()=>{
    (async()=>{
      setLoading(true);
      try{
        const {data:ex}=await supabase.from("employees").select("id").limit(1);
        if(!ex?.length){
          await supabase.from("employees").insert(INITIAL_EMPLOYEES.map(toDb));
          const pr=INITIAL_EMPLOYEES.flatMap(e=>(e.punchHistory||[]).map(p=>({emp_id:e.id,work_date:p.date,clock_in:p.in,clock_out:p.out,hours:Number(p.hours||0)})));
          if(pr.length)await supabase.from("punch_history").insert(pr);
          const tr=INITIAL_EMPLOYEES.flatMap(e=>(e.timeOffRequests||[]).map(r=>({id:r.id,emp_id:e.id,type:r.type,start_date:r.start,end_date:r.end,status:r.status,note:r.note})));
          if(tr.length)await supabase.from("time_off_requests").insert(tr);
          const sr=INITIAL_EMPLOYEES.flatMap(e=>(e.payStatements||[]).map(s=>({emp_id:e.id,period:s.period,gross:s.gross,net:s.net,pay_date:s.date})));
          if(sr.length)await supabase.from("pay_statements").insert(sr);
        }
        await reloadAll();
      }catch(err){setFatal(String(err.message||err));}
      finally{setLoading(false);}
    })();
  },[reloadAll]);

  if(loading)return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:dark?"#080D1A":"#F1F5FB",color:dark?"#E8EFFF":"#0D1B2A",fontFamily:"'Outfit',sans-serif"}}>
      <div style={{textAlign:"center"}}><div style={{marginBottom:10}}><Logo size={52}/></div><div style={{opacity:.5,fontSize:14}}>Loading WorkForce Pro…</div></div>
    </div>
  );

  if(fatal)return(
    <div style={{padding:30,fontFamily:"'Outfit',sans-serif",color:dark?"#E8EFFF":"#0D1B2A",background:dark?"#080D1A":"#F1F5FB",minHeight:"100vh"}}>
      <h2 style={{marginBottom:10}}>⚠ Supabase Error</h2>
      <p style={{opacity:.7,marginBottom:16}}>Check F12 Console + RLS policies. Run the SQL setup script if you haven't.</p>
      <pre style={{whiteSpace:"pre-wrap",background:"rgba(128,128,128,.1)",padding:16,borderRadius:12,fontSize:13,marginBottom:16}}>{fatal}</pre>
      <button onClick={reloadAll} style={{padding:"10px 20px",background:"#3B82F6",color:"white",border:"none",borderRadius:8,cursor:"pointer",fontFamily:"'Outfit',sans-serif",fontWeight:700}}>Retry</button>
    </div>
  );

  if(posMode)return <POSApp cashier={session?.type==="employee"?session.emp:null} onBack={()=>setPosMode(false)} dark={dark} setDark={setDark}/>;
  if(showPunch)return <PunchStation employees={employees} setEmployees={setEmployees} onBack={()=>setShowPunch(false)} reloadAll={reloadAll} officeLocation={officeLocation}/>;
  if(!session)return <Login employees={employees} onLogin={setSession} onPunch={()=>setShowPunch(true)} dark={dark} setDark={setDark}/>;
  // EmployeeApp needs access to setPosMode — handled via prop threading
  if(session.type==="admin")return <AdminApp employees={employees} setEmployees={setEmployees} onLogout={()=>setSession(null)} reloadAll={reloadAll} officeLocation={officeLocation} setOfficeLocation={setOfficeLocation} dark={dark} setDark={setDark} onOpenPOS={()=>setPosMode(true)}/>;
  return <EmployeeApp emp={session.emp} employees={employees} setEmployees={setEmployees} onLogout={()=>setSession(null)} reloadAll={reloadAll} dark={dark} setDark={setDark} onOpenPOS={()=>setPosMode(true)}/>;
}
