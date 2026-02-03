import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import { User } from '../types';

interface LayoutProps {
  user: User;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ user, activeTab, setActiveTab, onLogout, children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const titles: Record<string, string> = {
    dashboard: 'Instâncias WhatsApp',
    conversations: 'Central de Conversas',
    calendar: 'Agenda de Atendimentos',
    billing: 'Cobranças & Faturamento',
    business: 'Catálogo & Equipe',
    agents: 'Agentes de IA',
    management: 'Gestão do Sistema',
    settings: 'Configurações'
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Overlay mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[40] lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar responsiva */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-[50] transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <Sidebar 
          user={user} 
          activeTab={activeTab} 
          setActiveTab={(tab) => {
            setActiveTab(tab);
            setIsSidebarOpen(false);
          }} 
          onLogout={onLogout} 
        />
      </div>
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar agora gerencia seu próprio botão de menu e ocupa w-full corretamente */}
        <Topbar 
          user={user} 
          title={titles[activeTab] || 'Painel de Controle'} 
          onOpenMenu={() => setIsSidebarOpen(true)}
        />
        
        <main className="flex-1 overflow-hidden relative animate-in fade-in duration-500">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;