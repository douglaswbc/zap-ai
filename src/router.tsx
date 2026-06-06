import React, { useState, useEffect } from 'react';
import { Routes as RouterRoutes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import Layout from "./lib/layout";

// Páginas
import LoginPage from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import CalendarPage from '@/pages/Calendar';
import SettingsPage from '@/pages/SettingsPage';
import Management from './pages/Management';
import GoogleCallback from '@/pages/GoogleCallback';

import { ToastType } from '@/components/Toast';

interface RoutesProps {
  showToast: (msg: string, type: ToastType) => void;
}

const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['dashboard', 'management', 'calendar', 'settings'],
  profissional: ['calendar'],
  operador: ['calendar', 'management']
};

const Routes: React.FC<RoutesProps> = ({ showToast }) => {
  const { user, loading, login, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    if (user) {
      const userRole = user.role?.toLowerCase();
      const allowedTabs = ROLE_PERMISSIONS[userRole] || [];
      if (!allowedTabs.includes(activeTab)) {
        setActiveTab(allowedTabs[0] || 'calendar');
      }
    }
  }, [user]);

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
      case 'dashboard': return <Dashboard showToast={showToast} />;
      case 'calendar': return <CalendarPage showToast={showToast} />;
      case 'management': return <Management showToast={showToast} />;
      case 'settings': return <SettingsPage showToast={showToast} />;
      default: return <Dashboard showToast={showToast} />;
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