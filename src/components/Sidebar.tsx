import React from 'react';
import { User } from '../types';
import { useUnreadCount } from '@/hooks/useUnreadCount';

interface SidebarProps {
  user: User;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ user, activeTab, setActiveTab, onLogout }) => {
  const unreadCount = useUnreadCount();

  const menuItems = [
    { id: 'dashboard', label: 'Instâncias', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
    { id: 'conversations', label: 'Conversas', icon: 'M8 10h.01M12 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
    // NOVO ITEM: LEADS
    { id: 'leads', label: 'Leads CRM', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
    { id: 'calendar', label: 'Agenda', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { id: 'billing', label: 'Financeiro', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'business', label: 'Negócio', icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z' },
    { id: 'agents', label: 'Agentes IA', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
    { id: 'management', label: 'Gestão', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
    { id: 'instagram', label: 'Instagram', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { id: 'settings', label: 'Ajustes', icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4' },
  ];

  const rolePermissions: Record<string, string[]> = {
    admin: ['dashboard', 'conversations', 'leads', 'calendar', 'billing', 'business', 'agents', 'management', 'instagram', 'settings'],
    company: ['dashboard', 'conversations', 'leads', 'calendar', 'billing', 'business', 'agents', 'management', 'instagram', 'settings'],
    profissional: ['conversations', 'calendar'],
    operador: ['conversations', 'leads', 'calendar', 'billing', 'business', 'agents', 'instagram']
  };

  const userRole = user.role?.toLowerCase() || 'operador';
  const allowedTabs = rolePermissions[userRole] || [];
  const filteredMenuItems = menuItems.filter(item => allowedTabs.includes(item.id));

  return (
    <div className="w-64 bg-slate-900 h-screen flex flex-col flex-shrink-0 text-slate-300">
      <div className="p-6 border-b border-slate-800 flex items-center gap-3">
        <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-bold text-white shadow-lg text-lg">Z</div>
        <span className="text-xl font-bold text-white tracking-tight">ZapAI <span className="text-indigo-400">Pro</span></span>
      </div>

      <nav className="flex-1 py-6 px-4 space-y-1 overflow-y-auto custom-scrollbar">
        {filteredMenuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group ${activeTab === item.id
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20'
                : 'hover:bg-slate-800 hover:text-white'
              }`}
          >
            <div className="flex items-center gap-3">
              <svg className={`w-5 h-5 ${activeTab === item.id ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} />
              </svg>
              <span className="font-medium text-sm">{item.label}</span>
            </div>

            {item.id === 'conversations' && unreadCount > 0 && (
              <span className={`flex h-5 min-w-[1.25rem] px-1 items-center justify-center rounded-full text-[10px] font-black ${activeTab === 'conversations' ? 'bg-white text-indigo-600' : 'bg-rose-500 text-white animate-pulse'
                }`}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="px-6 py-4 bg-slate-800/50">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">Logado como</p>
        <p className="text-xs font-bold text-slate-200 truncate">{user.name}</p>
        <p className="text-[9px] text-indigo-400 font-bold uppercase">{user.role}</p>
      </div>

      <div className="p-4 border-t border-slate-800">
        <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-rose-500/10 hover:text-rose-400 text-slate-400 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="font-medium text-sm">Sair</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;