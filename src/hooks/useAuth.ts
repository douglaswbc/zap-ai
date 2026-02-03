// src/hooks/useAuth.ts
import { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { supabase } from '../services/supabase';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Função interna para buscar o perfil completo
  const fetchProfile = async (basicUser: any) => {
    const { data: profile, error } = await supabase
      .from('users_profile')
      .select('role, company_id, name, google_connected')
      .eq('id', basicUser.id)
      .single();

    if (!error && profile) {
      return { 
        ...basicUser, 
        name: profile.name || basicUser.name,
        role: profile.role as UserRole,
        company_id: profile.company_id,
        google_connected: profile.google_connected 
      };
    }
    return basicUser;
  };

  useEffect(() => {
    const initAuth = async () => {
      const saved = localStorage.getItem('zap_user');
      if (saved) {
        const fullUser = await fetchProfile(JSON.parse(saved));
        setUser(fullUser);
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const login = async (userData: User) => {
    setLoading(true);
    // Busca o perfil imediatamente no login para evitar a página bloqueada
    const fullUser = await fetchProfile(userData);
    setUser(fullUser);
    localStorage.setItem('zap_user', JSON.stringify(fullUser));
    setLoading(false);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('zap_user');
    setUser(null);
  };

  return { user, loading, login, logout };
};