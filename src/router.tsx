import React, { useState, useEffect } from 'react';
import { Routes as RouterRoutes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import Layout from "./lib/layout";

// Páginas
import LoginPage from '@/pages/Login';
import InstancesPage from '@/pages/Instances';
import ConversationsPage from '@/pages/Conversations';
import CalendarPage from '@/pages/Calendar';
import BusinessPage from '@/pages/Business';
import BillingPage from "@/pages/Billing";
import AgentsPage from "@/pages/AgentsPage";
import SettingsPage from "@/pages/SettingsPage";
import Management from './pages/Management';
import LeadsPage from './pages/LeadsPage'; // IMPORTADO
import InstagramManagement from '@/pages/InstagramManagement';
import GoogleCallback from '@/pages/GoogleCallback';

import { ToastType } from '@/components/Toast';

interface RoutesProps {
  showToast: (msg: string, type: ToastType) => void;
}

// Adicionado 'leads' nos perfis permitidos
const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['dashboard', 'conversations', 'leads', 'calendar', 'billing', 'business', 'agents', 'management', 'instagram', 'settings'],
  company: ['dashboard', 'conversations', 'leads', 'calendar', 'billing', 'business', 'agents', 'management', 'instagram', 'settings'],
  profissional: ['conversations', 'calendar'],
  operador: ['conversations', 'leads', 'calendar', 'billing', 'business', 'agents', 'instagram']
};

const Routes: React.FC<RoutesProps> = ({ showToast }) => {
  const { user, loading, login, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    if (user) {
      const userRole = user.role?.toLowerCase();
      const allowedTabs = ROLE_PERMISSIONS[userRole] || [];
      if (!allowedTabs.includes(activeTab)) {
        setActiveTab(allowedTabs[0] || 'conversations');
      }
    }
  }, [user, activeTab]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user && window.location.pathname !== '/google-callback') {
    return <LoginPage onLogin={login} showToast={showToast} />;
  }

  const renderTabContent = () => {
    const userRole = user?.role?.toLowerCase() || '';
    const allowedTabs = ROLE_PERMISSIONS[userRole] || [];

    if (!allowedTabs.includes(activeTab)) {
      return <div className="flex items-center justify-center h-full text-slate-400">Acesso restrito.</div>;
    }

    switch (activeTab) {
      case 'dashboard': return <InstancesPage showToast={showToast} />;
      case 'conversations': return <ConversationsPage showToast={showToast} />;
      case 'leads': return <LeadsPage showToast={showToast} setActiveTab={setActiveTab} />;
      case 'calendar': return <CalendarPage showToast={showToast} />;
      case 'billing': return <BillingPage showToast={showToast} />;
      case 'business': return <BusinessPage showToast={showToast} />;
      case 'agents': return <AgentsPage showToast={showToast} />;
      case 'management': return <Management showToast={showToast} />;
      case 'instagram': return <InstagramManagement showToast={showToast} />;
      case 'settings': return <SettingsPage showToast={showToast} />;
      default: return <InstancesPage showToast={showToast} />;
    }
  };

  return (
    <RouterRoutes>
      <Route path="/google-callback" element={<GoogleCallback showToast={showToast} />} />
      <Route
        path="*"
        element={
          user ? (
            <Layout user={user} activeTab={activeTab} setActiveTab={setActiveTab} onLogout={logout}>
              {renderTabContent()}
            </Layout>
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
    </RouterRoutes>
  );
};

export default Routes;