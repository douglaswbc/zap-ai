// src/pages/Dashboard.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { ToastType } from '@/components/Toast';

interface DashboardProps {
  showToast: (msg: string, type: ToastType) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ showToast }) => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [aptData, roomData] = await Promise.all([
        api.appointments.list(),
        api.rooms.list(),
      ]);
      setAppointments(aptData || []);
      setRooms(roomData || []);
    } catch (error) {
      console.error(error);
      showToast('Erro ao carregar métricas', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { if (user) loadData(); }, [user]);

  const todayStr = new Date().toLocaleDateString('en-CA');
  const now = new Date();
  const nowTime = now.getTime();

  const metrics = useMemo(() => {
    // Filtrar apenas agendamentos que NÃO estão cancelados para as métricas operacionais
    const activeDailyApts = appointments.filter(ap => ap.start_time.startsWith(todayStr) && ap.status !== 'cancelled');
    
    // Ocupação atual (agendamento ocorrendo agora e NÃO cancelado)
    const currentOccupancy = activeDailyApts.filter(ap => {
      const start = new Date(ap.start_time).getTime();
      const end = new Date(ap.end_time).getTime();
      return nowTime >= start && nowTime < end;
    }).length;

    const totalDaily = activeDailyApts.length;
    
    // Supondo que agendamentos confirmados vieram do fluxo do WhatsApp
    const aiConversions = activeDailyApts.filter(ap => ap.status === 'confirmed').length;

    return {
      occupancy: currentOccupancy,
      totalDaily,
      aiConversions
    };
  }, [appointments, todayStr, nowTime]);

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const statCards = [
    { label: 'Ocupação de Salas', value: `${metrics.occupancy} de 4`, sub: 'Salas em uso agora', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', color: 'bg-blue-500' },
    { label: 'Atendimentos Hoje', value: metrics.totalDaily, sub: 'Total agendado para o dia', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', color: 'bg-emerald-500' },
    { label: 'Conversões IA', value: metrics.aiConversions, sub: 'Via WhatsApp Webhook', icon: 'M13 10V3L4 14h7v7l9-11h-7z', color: 'bg-indigo-500' },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto w-full h-full overflow-y-auto custom-scrollbar">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Painel de Controle</h1>
          <p className="text-slate-500 mt-1">Resumo operacional do dia.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {statCards.map((stat, i) => (
          <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-lg transition-all group">
            <div className={`w-12 h-12 ${stat.color} rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg shadow-inner`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={stat.icon} /></svg>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
            <h3 className="text-2xl font-black text-slate-900">{stat.value}</h3>
            <p className="text-[10px] text-slate-400 mt-2 font-medium">{stat.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
          <h3 className="text-xl font-bold text-slate-900 mb-6">Status das Salas</h3>
          <div className="grid grid-cols-2 gap-4">
            {rooms.length > 0 ? rooms.map(room => (
              <div key={room.id} className="p-6 rounded-3xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900">{room.name}</p>
                  <p className={`text-[10px] font-black uppercase ${room.is_available ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {room.is_available ? 'Disponível' : 'Manutenção'}
                  </p>
                </div>
                <div className={`w-3 h-3 rounded-full ${room.is_available ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`}></div>
              </div>
            )) : (
              <p className="col-span-2 text-center text-slate-400 py-10">Nenhuma sala cadastrada.</p>
            )}
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
          <h3 className="text-xl font-bold text-slate-900 mb-6">Próximos Atendimentos</h3>
          <div className="space-y-4">
            {appointments.filter(ap => ap.start_time.startsWith(todayStr)).slice(0, 5).map(ap => {
              const start = new Date(ap.start_time);
              return (
                <div key={ap.id} className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl transition-colors border border-transparent hover:border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs uppercase">
                      {start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{ap.client_name}</p>
                      <p className="text-[10px] text-slate-500 font-medium">{ap.roomName} • {ap.professionalName}</p>
                    </div>
                  </div>
                  <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${ap.status === 'confirmed' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                    {ap.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
