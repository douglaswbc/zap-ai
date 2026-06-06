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

const PROF_COLORS = [
  { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-100' },
  { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' },
  { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' },
  { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-100' },
  { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-100' },
];

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

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    client_name: '',
    client_phone: '',
    professional_id: '',
    room_id: '',
    date: new Date().toLocaleDateString('en-CA'),
    time: '09:00',
    duration: '60',
    status: 'confirmed'
  });

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

  // LOGICA DE FILTRO DE DISPONIBILIDADE
  const availability = useMemo(() => {
    if (!formData.date || !formData.time || !formData.duration) return { rooms: rooms, professionals: professionals };

    const newStart = new Date(`${formData.date}T${formData.time}:00`);
    const newEnd = new Date(newStart.getTime() + parseInt(formData.duration) * 60000);

    const busyRoomIds = new Set<string>();
    const busyProfIds = new Set<string>();

    appointments.forEach(ap => {
      if (ap.id === editingId) return; // Ignora o próprio agendamento na edição
      if (ap.status === 'cancelled') return; // Ignora cancelados

      const apStart = new Date(ap.start_time);
      const apEnd = new Date(ap.end_time);

      // Checa sobreposição: (Início1 < Fim2) && (Fim1 > Início2)
      if (newStart < apEnd && newEnd > apStart) {
        busyRoomIds.add(ap.room_id);
        busyProfIds.add(ap.professional_id);
      }
    });

    return {
      rooms: rooms.filter(r => !busyRoomIds.has(r.id)),
      professionals: professionals.filter(p => !busyProfIds.has(p.id))
    };
  }, [formData.date, formData.time, formData.duration, appointments, rooms, professionals, editingId]);

  const handleOpenNew = () => {
    setEditingId(null);
    setFormData({
      client_name: '',
      client_phone: '',
      professional_id: professionals[0]?.id || '',
      room_id: rooms[0]?.id || '',
      date: dateStr,
      time: '09:00',
      duration: '60',
      status: 'confirmed'
    });
    setShowModal(true);
  };

  const handleOpenEdit = (ap: AppointmentLog) => {
    const start = new Date(ap.start_time);
    const end = new Date(ap.end_time);
    const duration = (end.getTime() - start.getTime()) / 60000;

    setEditingId(ap.id);
    setFormData({
      client_name: ap.client_name,
      client_phone: ap.client_phone,
      professional_id: ap.professional_id,
      room_id: ap.room_id,
      date: ap.start_time.split('T')[0],
      time: start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      duration: duration.toString(),
      status: ap.status
    });
    setShowModal(true);
  };

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
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const redirectUri = import.meta.env.VITE_GOOGLE_REDIRECT_URI || (window.location.origin + '/google-callback');

    if (!clientId) {
      showToast('VITE_GOOGLE_CLIENT_ID não configurado no seu arquivo .env', 'error');
      return;
    }

    const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
    const options = {
      redirect_uri: redirectUri,
      client_id: clientId,
      access_type: 'offline',
      response_type: 'code',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.readonly'].join(' '),
      state: user?.id || 'anonymous'
    };
    window.location.href = `${rootUrl}?${new URLSearchParams(options).toString()}`;
  };

  const handleSaveAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.professional_id || !formData.room_id) {
        showToast('Selecione um profissional e uma sala disponíveis.', 'error');
        return;
    }

    setIsSaving(true);
    try {
        const start = new Date(`${formData.date}T${formData.time}:00`);
        const end = new Date(start.getTime() + parseInt(formData.duration) * 60000);

        const payload = {
            client_name: formData.client_name,
            client_phone: formData.client_phone,
            professional_id: formData.professional_id,
            room_id: formData.room_id,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            status: formData.status
        };

        let resultId = editingId;

        if (editingId) {
            const { error } = await supabase.from('agendamentos').update(payload).eq('id', editingId);
            if (error) throw error;
        } else {
            const { data, error } = await supabase.from('agendamentos').insert(payload).select().single();
            if (error) throw error;
            resultId = data.id;
        }

        if (payload.status === 'confirmed') {
            await supabase.functions.invoke('google-calendar-sync', {
                body: { appointmentId: resultId }
            });
        } else if (editingId && payload.status === 'cancelled') {
            await supabase.functions.invoke('google-calendar-sync', {
                body: { appointmentId: resultId, action: 'DELETE' }
            });
        }

        showToast(editingId ? 'Agendamento atualizado!' : 'Agendamento realizado!', 'success');
        setShowModal(false);
        loadData();
    } catch (err: any) {
        showToast('Erro ao agendar: ' + err.message, 'error');
    } finally {
        setIsSaving(false);
    }
  };

  const handleCancelAppointment = async () => {
    if (!editingId) return;
    if (!confirm('Tem certeza que deseja cancelar este agendamento?')) return;
    
    setIsSaving(true);
    try {
        const { error } = await supabase.from('agendamentos').update({ status: 'cancelled' }).eq('id', editingId);
        if (error) throw error;

        await supabase.functions.invoke('google-calendar-sync', {
            body: { appointmentId: editingId, action: 'DELETE' }
        });

        showToast('Agendamento cancelado!', 'success');
        setShowModal(false);
        loadData();
    } catch (err: any) {
        showToast('Erro ao cancelar: ' + err.message, 'error');
    } finally {
        setIsSaving(false);
    }
  };

  const getProfColor = (id: string) => {
    const idx = professionals.findIndex(p => p.id === id);
    return idx === -1 ? PROF_COLORS[0] : PROF_COLORS[idx % PROF_COLORS.length];
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
                    const top = (start.getHours() * 2 + (start.getMinutes() >= 30 ? 1 : 0)) * 64;
                    const durationMin = (end.getTime() - start.getTime()) / 60000;
                    const height = (durationMin / 30) * 64;
                    const profColor = getProfColor(ap.professional_id);
                    
                    return (
                      <div 
                        key={ap.id}
                        onClick={() => handleOpenEdit(ap)}
                        className={`absolute left-1 right-1 rounded-xl p-3 shadow-sm border ${ap.status === 'confirmed' ? `${profColor.bg} ${profColor.text} ${profColor.border}` : `${STATUS_CONFIG[ap.status]?.bg} ${STATUS_CONFIG[ap.status]?.color} ${STATUS_CONFIG[ap.status]?.ring}`} z-10 transition-all hover:scale-[1.02] cursor-pointer`}
                        style={{ top: `${top}px`, height: `${height}px` }}
                      >
                        <p className="text-[10px] font-black uppercase mb-1">{start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                        <p className="text-xs font-bold truncate">{ap.client_name}</p>
                        <p className="text-[9px] opacity-70 truncate">{viewMode === 'professional' ? rooms.find(r => r.id === ap.room_id)?.nome : professionals.find(p => p.id === ap.professional_id)?.nome}</p>
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

  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    const monthName = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    return (
      <div className="flex flex-col h-full bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-lg font-black uppercase tracking-tighter text-slate-900">{monthName}</h2>
          <div className="flex gap-2">
            <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-2 hover:bg-white rounded-xl border border-slate-200 shadow-sm"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth="2" strokeLinecap="round" /></svg></button>
            <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-2 hover:bg-white rounded-xl border border-slate-200 shadow-sm"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth="2" strokeLinecap="round" /></svg></button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/30">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
            <div key={d} className="p-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">{d}</div>
          ))}
        </div>

        <div className="flex-1 grid grid-cols-7 overflow-y-auto custom-scrollbar">
          {days.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} className="border-b border-r border-slate-50 bg-slate-50/10 min-h-[120px]"></div>;
            
            const currentDayStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            const dayApts = appointments.filter(ap => ap.start_time.startsWith(currentDayStr));
            const isToday = new Date().toLocaleDateString('en-CA') === currentDayStr;

            return (
              <div 
                key={day} 
                onClick={() => { setCurrentDate(new Date(year, month, day)); setActiveTab('parallel'); }}
                className={`border-b border-r border-slate-50 min-h-[120px] p-2 hover:bg-slate-50 transition-colors cursor-pointer relative ${isToday ? 'bg-indigo-50/30' : ''}`}
              >
                <span className={`text-xs font-black ${isToday ? 'text-indigo-600 bg-indigo-100 w-6 h-6 flex items-center justify-center rounded-full' : 'text-slate-400'}`}>{day}</span>
                <div className="mt-2 space-y-1">
                  {dayApts.slice(0, 4).map(ap => {
                    const profColor = getProfColor(ap.professional_id);
                    return (
                      <div key={ap.id} className={`text-[9px] p-1 rounded-md truncate font-bold ${ap.status === 'confirmed' ? `${profColor.bg} ${profColor.text}` : `${STATUS_CONFIG[ap.status]?.bg} ${STATUS_CONFIG[ap.status]?.color}`}`}>
                        {new Date(ap.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} {ap.client_name}
                      </div>
                    );
                  })}
                  {dayApts.length > 4 && <div className="text-[8px] text-slate-400 font-bold ml-1">+{dayApts.length - 4} mais</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderListView = () => {
    return (
      <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm flex flex-col h-full">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
           <h2 className="text-lg font-black uppercase tracking-tighter text-slate-900">Agendamentos de {currentDate.toLocaleDateString('pt-BR')}</h2>
           <span className="bg-slate-900 text-white text-[10px] font-black px-3 py-1 rounded-full">{filteredAppointments.length} TOTAL</span>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <div className="space-y-4">
            {filteredAppointments.length === 0 && (
              <div className="py-20 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                   <svg className="w-8 h-8 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeWidth="2" strokeLinecap="round" /></svg>
                </div>
                <p className="text-slate-400 font-bold">Nenhum agendamento para este dia.</p>
              </div>
            )}
            
            {filteredAppointments.sort((a,b) => a.start_time.localeCompare(b.start_time)).map(ap => {
              const prof = professionals.find(p => p.id === ap.professional_id);
              const room = rooms.find(r => r.id === ap.room_id);
              const profColor = getProfColor(ap.professional_id);

              return (
                <div 
                  key={ap.id} 
                  onClick={() => handleOpenEdit(ap)} 
                  className="group flex items-center gap-6 p-5 border border-slate-100 hover:border-indigo-100 hover:bg-slate-50/50 cursor-pointer rounded-2xl transition-all"
                >
                  <div className="w-20 flex-shrink-0 text-center">
                    <p className="text-xl font-black text-slate-900 leading-none">{new Date(ap.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase mt-1">Início</p>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-black text-slate-900 text-base">{ap.client_name}</p>
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${STATUS_CONFIG[ap.status]?.bg} ${STATUS_CONFIG[ap.status]?.color}`}>
                        {STATUS_CONFIG[ap.status]?.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                       <span className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${profColor.bg} border ${profColor.border}`}></div>
                          {prof?.nome}
                       </span>
                       <span className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" strokeWidth="2" strokeLinecap="round" /></svg>
                          {room?.nome}
                       </span>
                       <span className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" strokeWidth="2" strokeLinecap="round" /></svg>
                          {ap.client_phone}
                       </span>
                    </div>
                  </div>

                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                     <button className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeWidth="2" strokeLinecap="round" /></svg>
                     </button>
                  </div>
                </div>
              );
            })}
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
            onClick={handleOpenNew}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-indigo-100 transition-all flex items-center gap-2 active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Novo Agendamento
          </button>

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
            Sincronizar
          </button>

          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button onClick={() => setViewMode('professional')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'professional' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Profissionais</button>
            <button onClick={() => setViewMode('room')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'room' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Salas</button>
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
        ) : activeTab === 'month' ? (
          renderMonthView()
        ) : (
          renderListView()
        )}
      </div>

      {/* MODAL NOVO/EDITAR AGENDAMENTO */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">
                {editingId ? 'Editar Agendamento' : 'Novo Agendamento'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2" strokeLinecap="round" /></svg></button>
            </div>
            
            <form onSubmit={handleSaveAppointment} className="p-8 space-y-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Nome do Cliente</label>
                  <input required type="text" value={formData.client_name} onChange={e => setFormData({...formData, client_name: e.target.value})} className="w-full px-5 py-3 rounded-xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 font-bold" placeholder="Ex: João Silva" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">WhatsApp</label>
                  <input required type="text" value={formData.client_phone} onChange={e => setFormData({...formData, client_phone: e.target.value})} className="w-full px-5 py-3 rounded-xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 font-bold" placeholder="Ex: 11999999999" />
                </div>
                
                <div className="col-span-2 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Data</label>
                      <input required type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full px-5 py-3 rounded-xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 font-bold" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Hora</label>
                      <input required type="time" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="w-full px-5 py-3 rounded-xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 font-bold" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Duração (Minutos)</label>
                    <input required type="number" step="30" value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value})} className="w-full px-5 py-3 rounded-xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 font-bold" />
                  </div>
                </div>

                <div className="col-span-2 border-t border-slate-100 pt-6 mt-2 space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest flex justify-between">
                      Profissionais Disponíveis
                      {availability.professionals.length === 0 && <span className="text-rose-500 normal-case font-bold">Nenhum disponível</span>}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {availability.professionals.map(p => (
                        <button 
                          key={p.id} 
                          type="button" 
                          onClick={() => setFormData({...formData, professional_id: p.id})}
                          className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${formData.professional_id === p.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-105' : 'bg-white text-slate-400 border-slate-100 hover:border-indigo-200'}`}
                        >
                          {p.nome || p.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest flex justify-between">
                      Salas Livres
                      {availability.rooms.length === 0 && <span className="text-rose-500 normal-case font-bold">Todas as salas ocupadas</span>}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {availability.rooms.map(r => (
                        <button 
                          key={r.id} 
                          type="button" 
                          onClick={() => setFormData({...formData, room_id: r.id})}
                          className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${formData.room_id === r.id ? 'bg-slate-900 text-white border-slate-900 shadow-md scale-105' : 'bg-white text-slate-400 border-slate-100 hover:border-indigo-200'}`}
                        >
                          {r.nome || r.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {editingId && (
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Status</label>
                        <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className={`w-full px-5 py-3 rounded-xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 font-bold ${STATUS_CONFIG[formData.status]?.color}`}>
                            <option value="confirmed">Confirmado</option>
                            <option value="cancelled">Cancelado</option>
                            <option value="pending">Pendente</option>
                        </select>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                {editingId ? (
                   <>
                    <button type="button" onClick={handleCancelAppointment} disabled={isSaving} className="flex-1 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all">Cancelar</button>
                    <button type="submit" disabled={isSaving || !formData.professional_id || !formData.room_id} className="flex-1 bg-slate-900 hover:bg-black text-white px-6 py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                        {isSaving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Salvar'}
                    </button>
                   </>
                ) : (
                    <>
                        <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all">Descartar</button>
                        <button type="submit" disabled={isSaving || !formData.professional_id || !formData.room_id} className="flex-2 bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-indigo-100 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                        {isSaving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Confirmar'}
                        </button>
                    </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarPage;