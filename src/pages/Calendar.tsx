// src/pages/Calendar.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { api } from '@/services/api';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/hooks/useAuth';
import { ToastType } from '@/components/Toast';
import { Professional, Room, AppointmentLog } from '@/types';

interface CalendarPageProps {
  showToast: (msg: string, type: ToastType) => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; ring: string }> = {
  pending: { label: 'Pendente', color: 'text-amber-600', bg: 'bg-amber-50', ring: 'ring-amber-100' },
  confirmed: { label: 'Confirmado', color: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'ring-emerald-100' },
  cancelled: { label: 'Cancelado', color: 'text-rose-600', bg: 'bg-rose-50', ring: 'ring-rose-100' },
};

const CalendarPage: React.FC<CalendarPageProps> = ({ showToast }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'month' | 'parallel' | 'list'>('parallel');
  const [appointments, setAppointments] = useState<AppointmentLog[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'professional' | 'room'>('professional');

  const loadData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [aptData, profData, roomData] = await Promise.all([
        api.appointments.list(),
        api.professionals.list(),
        api.rooms.list(),
      ]);
      setAppointments(aptData || []);
      setProfessionals(profData || []);
      setRooms(roomData || []);
    } catch (error) {
      showToast('Erro ao carregar dados', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { if (user) loadData(); }, [user]);

  const dateStr = currentDate.toLocaleDateString('en-CA');
  
  const timeSlots = Array.from({ length: 24 }, (_, i) => {
    const hour = i.toString().padStart(2, '0');
    return [`${hour}:00`, `${hour}:30`];
  }).flat();

  const filteredAppointments = useMemo(() => {
    return appointments.filter(ap => ap.start_time.startsWith(dateStr));
  }, [appointments, dateStr]);

  const handleGoogleSync = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
        body: { action: 'SYNC_DAY', date: dateStr }
      });

      if (error) {
        if (error.message?.includes("Token não configurado")) {
          if (confirm("Google não conectado. Deseja conectar agora?")) {
            handleConnectGoogle();
          }
        } else {
          throw error;
        }
      } else {
        showToast(`${data.count} agendamentos sincronizados!`, 'success');
        loadData();
      }
    } catch (err: any) {
      showToast('Erro na sincronização: ' + err.message, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConnectGoogle = () => {
    const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
    const options = {
      redirect_uri: import.meta.env.VITE_GOOGLE_REDIRECT_URI,
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      access_type: 'offline',
      response_type: 'code',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.readonly'].join(' '),
      state: user?.id
    };
    window.location.href = `${rootUrl}?${new URLSearchParams(options).toString()}`;
  };

  const renderParallelView = () => {
    const columns = viewMode === 'professional' ? professionals : rooms;
    
    return (
      <div className="flex flex-col h-full bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
        <div className="flex border-b border-slate-100 bg-slate-50/50">
          <div className="w-20 border-r border-slate-100"></div>
          {columns.map(col => (
            <div key={col.id} className="flex-1 p-4 text-center border-r border-slate-100 last:border-r-0">
              <span className="text-xs font-black text-slate-900 uppercase tracking-widest">{col.nome || col.name}</span>
            </div>
          ))}
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
          <div className="flex">
            <div className="w-20 flex-shrink-0 bg-slate-50/30">
              {timeSlots.map(slot => (
                <div key={slot} className="h-16 border-b border-slate-100 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-slate-400">{slot}</span>
                </div>
              ))}
            </div>
            
            {columns.map(col => (
              <div key={col.id} className="flex-1 border-r border-slate-100 last:border-r-0 relative">
                {timeSlots.map(slot => (
                  <div key={slot} className="h-16 border-b border-slate-100"></div>
                ))}
                
                {filteredAppointments
                  .filter(ap => (viewMode === 'professional' ? ap.professional_id === col.id : ap.room_id === col.id))
                  .map(ap => {
                    const start = new Date(ap.start_time);
                    const end = new Date(ap.end_time);
                    
                    const startHours = start.getHours();
                    const startMinutes = start.getMinutes();
                    const top = (startHours * 2 + (startMinutes >= 30 ? 1 : 0)) * 64;
                    
                    const durationMs = end.getTime() - start.getTime();
                    const durationMin = durationMs / (1000 * 60);
                    const height = (durationMin / 30) * 64;
                    
                    return (
                      <div 
                        key={ap.id}
                        className={`absolute left-1 right-1 rounded-xl p-3 shadow-sm border ${STATUS_CONFIG[ap.status]?.bg} ${STATUS_CONFIG[ap.status]?.color} ${STATUS_CONFIG[ap.status]?.ring} z-10 transition-all hover:scale-[1.02] cursor-pointer`}
                        style={{ top: `${top}px`, height: `${height}px` }}
                      >
                        <p className="text-[10px] font-black uppercase mb-1">{start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                        <p className="text-xs font-bold truncate">{ap.client_name}</p>
                        <p className="text-[9px] opacity-70 truncate">{ap.client_phone}</p>
                      </div>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-8 h-full flex flex-col bg-slate-50/30">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">Agenda Clínica</h1>
          <div className="flex bg-white border border-slate-200 rounded-2xl p-1 shadow-sm">
            <button onClick={() => setActiveTab('parallel')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'parallel' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500'}`}>Visão em Colunas</button>
            <button onClick={() => setActiveTab('month')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'month' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500'}`}>Mensal</button>
            <button onClick={() => setActiveTab('list')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'list' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500'}`}>Lista</button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={handleGoogleSync}
            disabled={isSyncing}
            className="bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 px-6 py-3 rounded-2xl font-bold shadow-sm transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
          >
            {isSyncing ? (
              <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg" className="w-4 h-4" alt="Google" />
            )}
            Sincronizar Google
          </button>

          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button onClick={() => setViewMode('professional')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'professional' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Por Profissional</button>
            <button onClick={() => setViewMode('room')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'room' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Por Sala</button>
          </div>
          
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm">
            <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 1)))} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth="2" strokeLinecap="round" /></svg></button>
            <span className="text-xs font-bold text-slate-900 min-w-[100px] text-center">{currentDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
            <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 1)))} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth="2" strokeLinecap="round" /></svg></button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : activeTab === 'parallel' ? (
          renderParallelView()
        ) : (
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 text-center text-slate-400 font-bold">
            {activeTab === 'list' ? (
              <div className="space-y-4">
                {filteredAppointments.map(ap => (
                  <div key={ap.id} className="flex items-center justify-between p-4 border-b">
                    <div className="text-left">
                      <p className="font-bold">{ap.client_name}</p>
                      <p className="text-xs text-slate-500">{new Date(ap.start_time).toLocaleTimeString()}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${STATUS_CONFIG[ap.status]?.bg} ${STATUS_CONFIG[ap.status]?.color}`}>
                      {ap.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : "Visão Mensal em desenvolvimento..."}
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarPage;
