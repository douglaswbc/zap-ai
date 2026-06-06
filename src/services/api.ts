import { User, Professional, Room, AppointmentLog } from '../types';
import { supabase } from './supabase';

const EVO_URL = import.meta.env.VITE_EVO_API_URL;
const EVO_KEY = import.meta.env.VITE_EVO_API_KEY;

const headers = {
  apikey: EVO_KEY || '',
  'Content-Type': 'application/json',
};

export const api = {
  /* ================= CONFIGURAÇÕES ================= */
  config: {
    get: async () => {
      const { data, error } = await supabase.from('configuracoes').select('*');
      if (error) throw error;
      const config: Record<string, string> = {};
      data?.forEach(row => { config[row.chave] = row.valor; });
      return config;
    },
    save: async (chave: string, valor: string) => {
      const { error } = await supabase.from('configuracoes').upsert({ chave, valor }, { onConflict: 'chave' });
      if (error) throw error;
    }
  },

  /* ================= PROFISSIONAIS ================= */
  professionals: {
    list: async (): Promise<Professional[]> => {
      const { data, error } = await supabase.from('profissionais').select('*').order('nome');
      if (error) throw error;
      // Mapeia nome -> name para compatibilidade com types.ts se necessário, 
      // mas o ideal é que types.ts reflita o banco.
      return (data || []).map(p => ({
        ...p,
        name: p.nome,
        specialty: p.especialidade
      }));
    },
    upsert: async (p: any) => {
      const payload = {
        id: p.id || undefined,
        nome: p.name || p.nome,
        especialidade: p.specialty || p.especialidade,
        google_calendar_id: p.google_calendar_id,
        is_active: p.is_active ?? true
      };
      const { data, error } = await supabase.from('profissionais').upsert(payload).select().single();
      if (error) throw error;
      return data;
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('profissionais').delete().eq('id', id);
      if (error) throw error;
    }
  },

  /* ================= SALAS ================= */
  rooms: {
    list: async (): Promise<Room[]> => {
      const { data, error } = await supabase.from('salas').select('*').order('nome');
      if (error) throw error;
      return (data || []).map(r => ({
        ...r,
        name: r.nome
      }));
    },
    upsert: async (r: any) => {
      const payload = {
        id: r.id || undefined,
        nome: r.name || r.nome,
        is_available: r.is_available ?? true
      };
      const { data, error } = await supabase.from('salas').upsert(payload).select().single();
      if (error) throw error;
      return data;
    }
  },

  /* ================= AGENDAMENTOS ================= */
  appointments: {
    list: async (): Promise<any[]> => {
      const { data, error } = await supabase
        .from('agendamentos')
        .select('*, profissionais(nome), salas(nome)')
        .order('start_time');
      if (error) throw error;
      return (data || []).map(ap => ({
        ...ap,
        professionalName: ap.profissionais?.nome || 'N/A',
        roomName: ap.salas?.nome || 'N/A'
      }));
    },
    save: async (ap: any) => {
      const { data, error } = await supabase.from('agendamentos').upsert(ap).select().single();
      if (error) throw error;
      
      // Trigger Google Sync via Edge Function
      if (data.status === 'confirmed') {
        supabase.functions.invoke('google-calendar-sync', { body: { appointmentId: data.id, action: 'UPSERT' } });
      }
      return data;
    },
    delete: async (id: string) => {
      // Tenta remover do Google primeiro
      const { data: apt } = await supabase.from('agendamentos').select('google_event_id').eq('id', id).single();
      if (apt?.google_event_id) {
        await supabase.functions.invoke('google-calendar-sync', { body: { appointmentId: id, action: 'DELETE' } });
      }
      const { error } = await supabase.from('agendamentos').delete().eq('id', id);
      if (error) throw error;
    }
  },

  /* ================= WHATSAPP / CONVERSAS ================= */
  // Mantemos o básico de instâncias para o bot funcionar
  instances: {
    list: async () => {
      const { data, error } = await supabase.from('instances').select('*');
      if (error) throw error;
      return data || [];
    },
    connect: async (instanceName: string) => {
      const res = await fetch(`${EVO_URL}/instance/connect/${instanceName}`, { headers });
      const data = await res.json();
      return data.base64 || data.code || '';
    }
  },
  
  conversations: {
    list: async () => {
      // No novo schema, conversas são baseadas no client_phone dos agendamentos
      // mas podemos manter a tabela de conversas se ela ainda existir no banco
      const { data, error } = await supabase.from('conversations').select('*, contacts(*)').order('last_timestamp', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  }
};
