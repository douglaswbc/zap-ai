import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/hooks/useAuth';
import { ToastType } from '@/components/Toast';

interface CalendarPageProps {
  showToast: (msg: string, type: ToastType) => void;
}

// Definição de cores e labels para os status
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; ring: string }> = {
  PENDING: { label: 'Pendente', color: 'text-amber-600', bg: 'bg-amber-50', ring: 'ring-amber-100' },
  CONFIRMED: { label: 'Confirmado', color: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'ring-emerald-100' },
  CANCELLED: { label: 'Cancelado', color: 'text-rose-600', bg: 'bg-rose-50', ring: 'ring-rose-100' },
  RESCHEDULED: { label: 'Reagendado', color: 'text-indigo-600', bg: 'bg-indigo-50', ring: 'ring-indigo-100' },
};

const CalendarPage: React.FC<CalendarPageProps> = ({ showToast }) => {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'calendar' | 'list'>('calendar');
  const [appointments, setAppointments] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterType, setFilterType] = useState<'day' | 'week' | 'month'>('month');
  const [selectedDayAppointments, setSelectedDayAppointments] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formDeps, setFormDeps] = useState({ contacts: [], services: [], professionals: [] });
  const [formData, setFormData] = useState({
    contactId: '',
    serviceId: '',
    professionalId: '',
    date: '',
    time: '',
    status: 'PENDING'
  });

  // Horários disponíveis
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [isFetchingSlots, setIsFetchingSlots] = useState(false);

  const formatDateToLocal = (dateStr: string) => new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR');
  const getTodayBR = () => new Date().toLocaleDateString('en-CA');
  const todayStr = getTodayBR();

  const loadData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [aptData, deps] = await Promise.all([
        api.appointments.list(user),
        api.helpers.fetchFormDeps(user), // Agora esta função existe!
      ]);
      setAppointments(aptData || []);
      setFormDeps(deps); // Aqui os selects serão preenchidos
    } catch (error: any) {
      console.error("ERRO DETALHADO:", error);
      showToast('Erro ao carregar dados', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { if (user) loadData(); }, [user]);

  const triggerNotification = async (id: string) => {
    try {
      await api.appointments.sendConfirmation(id, user!);
      showToast('Notificação enviada ao cliente!', 'success');
    } catch (error: any) {
      console.error(error);
      showToast('Agendamento confirmado, mas houve erro no WhatsApp.', 'info');
    }
  };

  // Monitorar mudanças para buscar horários
  useEffect(() => {
    const fetchSlots = async () => {
      const { professionalId, serviceId, date } = formData;

      // Só busca se tivermos os 3 campos preenchidos
      if (professionalId && serviceId && date) {
        setIsFetchingSlots(true);
        try {
          const slots = await api.appointments.getAvailableSlots(professionalId, serviceId, date);
          setAvailableSlots(slots);

          // Se o horário selecionado não estiver nos novos slots (e não for edição), limpa o campo
          if (!editingId && !slots.includes(formData.time)) {
            setFormData(prev => ({ ...prev, time: '' }));
          }
        } catch (error) {
          console.error("Erro ao buscar slots:", error);
        } finally {
          setIsFetchingSlots(false);
        }
      } else {
        setAvailableSlots([]);
      }
    };

    fetchSlots();
  }, [formData.professionalId, formData.serviceId, formData.date]);

  const updateAptStatus = async (id: string, newStatus: string) => {
    try {
      // A API agora cuida de enviar o WhatsApp e sincronizar o Google
      await api.appointments.updateStatus(id, newStatus, user!);
      showToast(`Status: ${newStatus}`, 'success');
      loadData();
    } catch (error) {
      showToast('Erro ao atualizar status', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsLoading(true);
    try {
      // A API save agora centraliza Google e WhatsApp
      await api.appointments.save(formData, user, editingId);

      showToast(editingId ? 'Atualizado com sucesso!' : 'Agendado com sucesso!', 'success');
      setIsModalOpen(false);
      loadData();
    } catch (error) {
      showToast('Erro ao salvar', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendReminder = async (id: string) => {
    try {
      showToast('Enviando lembrete...', 'info');
      await api.appointments.sendManualReminder(id);
      showToast('Lembrete enviado com sucesso!', 'success');
    } catch (error) {
      showToast('Erro ao enviar lembrete via WhatsApp.', 'error');
    }
  };

  const handleDateClick = (day: number, isPast: boolean) => {
    const clickedDateKey = new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toLocaleDateString('en-CA');
    const dayApts = appointments.filter(ap => ap.date === clickedDateKey);

    if (isPast && dayApts.length === 0) {
      showToast('Não é possível realizar agendamentos em datas passadas.', 'info');
      return;
    }

    setSelectedDayAppointments(dayApts);
    setFormData({ ...formData, date: clickedDateKey, status: 'PENDING' });
    setEditingId(null);
    setIsModalOpen(true);
  };

  const handleEdit = (ap: any) => {
    setEditingId(ap.id);
    setFormData({
      contactId: ap.contactId || '',
      serviceId: ap.serviceId || '',
      professionalId: ap.professionalId || '',
      date: ap.date,
      time: ap.time,
      status: ap.status || 'PENDING'
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este agendamento?')) return;
    try {
      // Adicionado o 'user!' como segundo argumento
      await api.appointments.delete(id, user!);
      showToast('Agendamento excluído', 'success');
      loadData();
      setIsModalOpen(false);
    } catch (error) {
      showToast('Erro ao excluir', 'error');
    }
  };

  // Lógica de Filtro
  const filteredAppointments = appointments.filter(ap => {
    // Criamos a data garantindo que não haja erro de fuso horário
    const apDate = new Date(ap.date + 'T00:00:00');

    if (filterType === 'day') return ap.date === todayStr;

    if (filterType === 'week') {
      const today = new Date();
      const start = new Date(today.setDate(today.getDate() - today.getDay()));
      const end = new Date(today.setDate(today.getDate() - today.getDay() + 6));
      return apDate >= start && apDate <= end;
    }

    // Filtro de Mês: PRECISA checar mês E ano
    return (
      apDate.getMonth() === currentDate.getMonth() &&
      apDate.getFullYear() === currentDate.getFullYear()
    );
  });

  const { firstDay, days } = (date => {
    const y = date.getFullYear(), m = date.getMonth();
    return { firstDay: new Date(y, m, 1).getDay(), days: new Date(y, m + 1, 0).getDate() };
  })(currentDate);

  return (
    <div className="p-8 h-full overflow-y-auto custom-scrollbar bg-slate-50/30">
      {/* Header com Abas e Filtros */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-4">Agenda</h1>
          <div className="flex bg-white border border-slate-200 rounded-2xl p-1 shadow-sm">
            {['calendar', 'list'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-6 py-2 rounded-xl text-sm font-bold capitalize transition-all ${activeTab === tab ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500'}`}>{tab === 'calendar' ? 'Calendário' : 'Lista'}</button>
            ))}
          </div>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          {['day', 'week', 'month'].map(t => (
            <button key={t} onClick={() => setFilterType(t as any)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filterType === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>{t === 'day' ? 'Hoje' : t === 'week' ? 'Semana' : 'Mês'}</button>
          ))}
        </div>
        {user?.google_connected && (
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm" title="Google Calendar Sincronizado">
            <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg" className="w-5 h-5" alt="Google" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Sincronizado</span>
          </div>
        )}
      </div>

      {activeTab === 'calendar' ? (
        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm animate-in fade-in duration-500">
          <div className="flex items-center justify-center gap-8 mb-8">
            <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="p-2 hover:bg-slate-100 rounded-xl"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth="2" /></svg></button>
            <h2 className="text-xl font-bold text-slate-900 capitalize">{currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</h2>
            <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="p-2 hover:bg-slate-100 rounded-xl"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth="2" /></svg></button>
          </div>
          <div className="grid grid-cols-7 gap-4">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => <div key={d} className="text-center text-[10px] font-black text-slate-300 uppercase tracking-widest mb-4">{d}</div>)}
            {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
            {Array.from({ length: days }).map((_, i) => {
              const day = i + 1;
              const dKey = new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toLocaleDateString('en-CA');
              const isPast = dKey < todayStr, isToday = dKey === todayStr;
              const dayApts = appointments.filter(ap => ap.date === dKey);
              return (
                <div key={day} onClick={() => handleDateClick(day, isPast)} className={`aspect-square rounded-[1.8rem] border flex flex-col items-center justify-center p-2 transition-all cursor-pointer relative ${isPast ? 'bg-slate-50 opacity-40' : 'bg-white hover:border-indigo-300'} ${isToday ? 'ring-2 ring-indigo-600 ring-offset-2' : ''}`}>
                  <span className={`text-sm font-black ${isToday ? 'text-indigo-600' : 'text-slate-900'}`}>{day}</span>
                  {dayApts.length > 0 && <span className="mt-1 w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
          {/* TABELA COM SCROLL RESPONSIVO */}
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left min-w-[800px]">
              <thead>
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50">
                  <th className="px-8 py-6">Cliente</th>
                  <th className="px-8 py-6">Serviço</th>
                  <th className="px-8 py-6">Data/Hora</th>
                  <th className="px-8 py-6">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredAppointments.length > 0 ? (
                  filteredAppointments.map(ap => (
                    <tr key={ap.id} className="border-t border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-6">
                        <div className="font-bold text-slate-900">{ap.contactName}</div>
                        <div className="text-[10px] text-slate-400">ID: {ap.id.substring(0, 8)}</div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-sm font-bold text-slate-700">{ap.serviceName}</div>
                        <div className="text-[10px] text-indigo-500 font-bold uppercase">{ap.professionalName}</div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="font-bold text-slate-900">{formatDateToLocal(ap.date)}</div>
                        <div className="text-xs text-slate-400">{ap.time}</div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <select
                            value={ap.status}
                            onChange={(e) => updateAptStatus(ap.id, e.target.value)}
                            className={`text-[10px] font-black uppercase px-3 py-2 rounded-xl border-none outline-none ring-1 ring-inset ${STATUS_CONFIG[ap.status]?.bg} ${STATUS_CONFIG[ap.status]?.color} ${STATUS_CONFIG[ap.status]?.ring}`}
                          >
                            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                              <option key={key} value={key}>{cfg.label}</option>
                            ))}
                          </select>

                          {/* BOTÃO DE CAMPAINHA ADICIONADO AQUI */}
                          <button
                            onClick={() => handleSendReminder(ap.id)}
                            className="p-2 text-slate-400 hover:text-amber-500 transition-colors"
                            title="Enviar Lembrete WhatsApp"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                          </button>

                          <button onClick={() => handleEdit(ap)} className="p-2 text-slate-400 hover:text-indigo-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeWidth="2" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={4} className="px-8 py-10 text-center text-slate-400 font-medium">Nenhum agendamento encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Agendamento */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl p-10 max-h-[90vh] overflow-y-auto custom-scrollbar">

            {selectedDayAppointments.length > 0 && (
              <div className="mb-8 pb-8 border-b border-slate-100">
                <h3 className="text-lg font-black text-slate-900 uppercase mb-4 text-indigo-600">Agendamentos do Dia</h3>
                <div className="space-y-3">
                  {selectedDayAppointments.map(ap => (
                    <div key={ap.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900 truncate">{ap.contactName}</p>
                        <p className="text-xs text-slate-500">{ap.time} • {ap.serviceName}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <select value={ap.status} onChange={(e) => updateAptStatus(ap.id, e.target.value)} className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg border-none ${STATUS_CONFIG[ap.status]?.bg} ${STATUS_CONFIG[ap.status]?.color}`}>
                          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
                        </select>

                        {/* BOTÃO DE CAMPAINHA ADICIONADO AQUI */}
                        <button
                          onClick={() => handleSendReminder(ap.id)}
                          className="p-2 text-slate-400 hover:text-amber-500 transition-colors"
                          title="Enviar Lembrete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                          </svg>
                        </button>

                        <button onClick={() => handleEdit(ap)} className="p-2 text-indigo-600 hover:bg-white rounded-lg"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeWidth="2" /></svg></button>
                        <button onClick={() => handleDelete(ap.id)} className="p-2 text-rose-600 hover:bg-white rounded-lg"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth="2" /></svg></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {formData.date < todayStr && !editingId ? (
              <div className="p-6 bg-amber-50 rounded-2xl text-amber-700 text-center font-bold">Modo de Visualização Histórica. Novos registros bloqueados.</div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h3 className="text-2xl font-bold text-slate-900 mb-6">{editingId ? 'Editar Agendamento' : 'Novo Agendamento'}</h3>

                <select required className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none font-medium" value={formData.contactId} onChange={e => setFormData({ ...formData, contactId: e.target.value })}>
                  <option value="">Selecione o Cliente</option>
                  {formDeps.contacts.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>

                <div className="grid grid-cols-2 gap-4">
                  <select required className="px-5 py-4 rounded-2xl bg-slate-50 border-none font-medium" value={formData.serviceId} onChange={e => setFormData({ ...formData, serviceId: e.target.value })}>
                    <option value="">Qual o Serviço?</option>
                    {formDeps.services.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.duration_minutes}min)</option>)}
                  </select>

                  <select required className="px-5 py-4 rounded-2xl bg-slate-50 border-none font-medium" value={formData.professionalId} onChange={e => setFormData({ ...formData, professionalId: e.target.value })}>
                    <option value="">Qual o Profissional?</option>
                    {formDeps.professionals.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <input type="date" className="px-5 py-4 rounded-2xl bg-slate-50 opacity-60 font-medium" value={formData.date} readOnly />

                  {/* SELETOR DE HORA DINÂMICO */}
                  <select
                    required
                    className={`px-5 py-4 rounded-2xl bg-slate-50 border-none font-medium transition-all ${isFetchingSlots ? 'animate-pulse opacity-50' : ''}`}
                    value={formData.time}
                    onChange={e => setFormData({ ...formData, time: e.target.value })}
                    disabled={!formData.serviceId || !formData.professionalId || isFetchingSlots}
                  >
                    <option value="">{isFetchingSlots ? 'Buscando...' : 'Hora'}</option>
                    {editingId && formData.time && !availableSlots.includes(formData.time.substring(0, 5)) && (
                      <option value={formData.time}>{formData.time.substring(0, 5)} (Atual)</option>
                    )}
                    {availableSlots.map(slot => (
                      <option key={slot} value={slot}>{slot}</option>
                    ))}
                  </select>

                  <select className="px-5 py-4 rounded-2xl bg-slate-50 font-bold" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
                  </select>
                </div>

                {user?.google_connected && (
                  <div className="flex items-center gap-2 p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-[10px] font-bold text-emerald-700">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg" className="w-4 h-4" alt="Google" />
                    {formData.status === 'CONFIRMED'
                      ? "Este agendamento será sincronizado com seu Google Calendar."
                      : "Sincronização ativa: mude o status para 'Confirmado' para espelhar no Google."}
                  </div>
                )}

                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 font-bold text-slate-400">Cancelar</button>
                  <button type="submit" disabled={isFetchingSlots} className="flex-2 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg disabled:opacity-50 transition-all">
                    {editingId ? 'Salvar Alterações' : 'Confirmar Agendamento'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarPage;