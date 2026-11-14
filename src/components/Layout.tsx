import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Activity, BookOpen, Boxes, ChevronDown, CircleHelp, Database, FlaskConical, GitBranch, LayoutDashboard, Menu, ShieldCheck, TriangleAlert, X } from 'lucide-react';
import { shortDate, useApi } from '../api';
import type { Meta } from '../types';

const navigation = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/risks', label: 'Stockout risk', icon: TriangleAlert },
  { to: '/planner', label: 'Scenario planner', icon: FlaskConical },
  { to: '/funding', label: 'Funding trace', icon: GitBranch },
  { to: '/data', label: 'Data & evidence', icon: Database },
  { to: '/methodology', label: 'Methodology', icon: BookOpen },
];
export function Layout() {
  const [open, setOpen] = useState(false);
  const { data: meta } = useApi<Meta>('/meta');
  const country = meta?.country ?? 'Demo Republic';
  const synthetic = meta?.manifest.synthetic ?? true;
  const initials = country.split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase();
  return <div className="app-shell"><a className="skip-link" href="#main-content">Skip to content</a>
    {open && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setOpen(false)} />}
    <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}><div className="brand"><span className="brand-mark"><Boxes size={25} /></span><div><strong>StockSense</strong><span>AFRICA</span></div><button className="icon-button mobile-close" aria-label="Close navigation" onClick={() => setOpen(false)}><X size={20} /></button></div>
      <div className="workspace-switch"><span className="workspace-avatar">{initials}</span><div><strong>{country}</strong><span>{synthetic ? 'Synthetic demonstration workspace' : 'Authorized aggregate workspace'}</span></div><ChevronDown size={15} /></div>
      <div className="nav-label">WORKSPACE</div><nav aria-label="Main navigation">{navigation.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><Icon size={18} /><span>{label}</span></NavLink>)}</nav>
      <div className="sidebar-bottom"><div className="demo-note"><ShieldCheck size={19} /><div><strong>Built for responsible use</strong><p>{synthetic ? 'Synthetic data. Transparent decisions. Human review first.' : 'Authorized aggregate data. No patient records. Human review first.'}</p></div></div><div className="sidebar-user"><span className="avatar">DA</span><div><strong>Demo analyst</strong><span>Local demonstration workspace</span></div><CircleHelp size={17} /></div></div>
    </aside>
    <div className="main-shell"><header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setOpen(true)}><Menu size={21} /></button><span className="breadcrumb">Workspace <span>/</span> <strong>{country}</strong></span></div><div className="topbar-right"><span className="synthetic-badge"><span className="status-dot" />{synthetic ? 'Synthetic demo' : 'Authorized aggregate'}</span><span className="topbar-divider" /><span className="snapshot-date"><Activity size={15} />Snapshot · {meta ? shortDate(meta.asOf) : 'Nov 14, 2026'}</span></div></header>
      <main id="main-content" className="main-content"><Outlet /></main><footer className="app-footer"><span><FlaskConical size={14} />Independent portfolio prototype · Not an official Gates Foundation product</span><span>No live procurement, payments, or LLM connection</span></footer>
    </div></div>;
}
