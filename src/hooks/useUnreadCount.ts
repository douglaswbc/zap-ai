import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/services/supabase';
import { api } from '@/services/api';
import { useAuth } from './useAuth'; // Importe o hook de autenticação

export function useUnreadCount() {
  const [count, setCount] = useState(0);
  const { user } = useAuth(); // Obtenha o usuário logado

  const fetchCount = useCallback(async () => {
  // Garante que só busca se o objeto user e a role existirem
  if (!user || !user.role) return; 

  try {
    const total = await api.conversations.getUnreadCount(user);
    setCount(total);
  } catch (error) {
    // Evita logs de erro vazios
    console.error("Erro ao carregar contador:", error); 
  }
}, [user]);

  useEffect(() => {
    if (user) {
      fetchCount();

      const channel = supabase
        .channel('unread-count-sync')
        .on(
          'postgres_changes', 
          { event: '*', schema: 'public', table: 'messages' }, 
          (payload) => {
            const isNewUserMsg = payload.eventType === 'INSERT' && payload.new.sender === 'USER';
            const isStatusUpdate = payload.eventType === 'UPDATE'; 
            const isDeletion = payload.eventType === 'DELETE';

            if (isNewUserMsg || isStatusUpdate || isDeletion) {
              fetchCount();
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, fetchCount]);

  return count;
}