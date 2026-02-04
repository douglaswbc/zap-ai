import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { ToastType } from '@/components/Toast';

interface SettingsPageProps {
  showToast: (msg: string, type: ToastType) => void;
}

const WEEK_DAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

const SettingsPage: React.FC<SettingsPageProps> = ({ showToast }) => {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    businessHoursStart: '09:00',
    businessHoursEnd: '18:00',
    workingDays: ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"],
    offlineMessage: '',
    address: '',
    website: '',
    instagram: '',
    is24h: false
  });

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.name || '',
        email: user.email || ''
      }));

      api.settings.get(user).then(data => {
        if (data) {
          setFormData(prev => ({
            ...prev,
            businessHoursStart: data.business_hours_start?.slice(0, 5) || '09:00',
            businessHoursEnd: data.business_hours_end?.slice(0, 5) || '18:00',
            workingDays: data.working_days || ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"],
            offlineMessage: data.offline_message || '',
            address: data.address || '',
            website: data.website || '',
            instagram: data.instagram || '',
            is24h: data.is_24h || false
          }));
        }
        setIsLoading(false);
      });
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    try {
      // 1. Atualiza Perfil do Usuário
      await api.users.upsert({
        id: user.id,
        name: formData.name,
        email: formData.email
      });

      // 2. Atualiza Configurações da Empresa
      const settingsToSave = {
        businessHoursStart: formData.businessHoursStart,
        businessHoursEnd: formData.businessHoursEnd,
        workingDays: formData.workingDays,
        offlineMessage: formData.offlineMessage,
        address: formData.address,
        website: formData.website,
        instagram: formData.instagram,
        is24h: formData.is24h
      };

      await api.settings.save(user, settingsToSave);
      showToast('Configurações salvas com sucesso!', 'success');

      // Opcional: Recarregar a página para atualizar o estado global do useAuth se necessário
      // window.location.reload(); 
    } catch (error: any) {
      showToast(`Erro ao salvar: ${error.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleDay = (day: string) => {
    const current = formData.workingDays;
    setFormData({
      ...formData,
      workingDays: current.includes(day)
        ? current.filter(d => d !== day)
        : [...current, day]
    });
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

  const handleDisconnectGoogle = async () => {
    if (!confirm('Deseja realmente remover a integração com o Google Calendar?')) return;
    try {
      await api.settings.disconnectGoogle(user!);
      showToast('Integração removida!', 'success');
      window.location.reload();
    } catch (error) { showToast('Erro ao desconectar.', 'error'); }
  };

  if (isLoading) return (
    <div className="h-full flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="p-8 h-full overflow-y-auto custom-scrollbar bg-slate-50/30">
      <div className="max-w-4xl mx-auto">
        <header className="mb-10">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Configurações</h1>
          <p className="text-slate-500 mt-1">Gerencie seu perfil, horários de atendimento e integrações.</p>
        </header>

        <form onSubmit={handleSave} className="space-y-8 pb-20">

          {/* 1. PERFIL DO USUÁRIO */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2 uppercase tracking-tighter">
              <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              </div>
              Meu Perfil
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Nome Completo</label>
                <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 font-medium" placeholder="Ex: João Silva" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">E-mail de Acesso</label>
                <input type="email" value={formData.email} readOnly className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none font-medium opacity-60 cursor-not-allowed" placeholder="nome@exemplo.com" />
              </div>
            </div>
          </div>

          {/* 2. DISPONIBILIDADE DA IA */}
          <div className="bg-white p-8 rounded-[2.5rem] border-2 border-indigo-100 shadow-sm ring-4 ring-indigo-50/50">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="flex-1">
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 uppercase tracking-tighter">
                  <div className="p-2 bg-indigo-600 rounded-lg text-white">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </div>
                  Disponibilidade da IA
                </h3>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                  Defina se o seu Agente responderá 24h ou apenas no horário comercial.
                </p>
              </div>

              <div className="flex flex-col items-end gap-2 bg-indigo-50/50 p-4 rounded-3xl border border-indigo-100">
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-black uppercase ${!formData.is24h ? 'text-indigo-600' : 'text-slate-400'}`}>Comercial</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={formData.is24h} onChange={e => setFormData({ ...formData, is24h: e.target.checked })} className="sr-only peer" />
                    <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                  <span className={`text-[10px] font-black uppercase ${formData.is24h ? 'text-indigo-600' : 'text-slate-400'}`}>24 Horas</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. FUNCIONAMENTO DA EMPRESA */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Horário de Funcionamento
            </h3>

            <div className="space-y-8">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-4 ml-1 tracking-widest">Dias Ativos</label>
                <div className="flex flex-wrap gap-2">
                  {WEEK_DAYS.map(day => (
                    <button key={day} type="button" onClick={() => toggleDay(day)} className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all border ${formData.workingDays.includes(day) ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-400 border-slate-100 hover:border-indigo-200'}`}>{day}</button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Abertura</label>
                  <input type="time" value={formData.businessHoursStart} onChange={e => setFormData({ ...formData, businessHoursStart: e.target.value })} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 font-medium" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Fechamento</label>
                  <input type="time" value={formData.businessHoursEnd} onChange={e => setFormData({ ...formData, businessHoursEnd: e.target.value })} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 font-medium" />
                </div>
              </div>
            </div>
          </div>

          {/* 4. PERFIL INSTITUCIONAL */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              Institucional
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Endereço</label>
                <input type="text" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="Rua, Número, Bairro - Cidade/UF" className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 font-medium" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Site / Link</label>
                  <input type="url" value={formData.website} onChange={e => setFormData({ ...formData, website: e.target.value })} placeholder="https://www.site.com.br" className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 font-medium" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Instagram</label>
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-black">@</span>
                    <input type="text" value={formData.instagram} onChange={e => setFormData({ ...formData, instagram: e.target.value })} placeholder="seu_perfil" className="w-full pl-10 pr-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 font-medium" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 5. RESPOSTA OFF-HOURS */}
          <div className={`bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm transition-all duration-500 ${formData.is24h ? 'opacity-30 pointer-events-none' : ''}`}>
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              Mensagem Offline
            </h3>
            <textarea
              rows={3}
              value={formData.offlineMessage}
              onChange={e => setFormData({ ...formData, offlineMessage: e.target.value })}
              placeholder="Ex: Olá! No momento estamos fechados. Nosso horário é das 09h às 18h..."
              className="w-full px-6 py-5 rounded-[2rem] bg-slate-50 border border-slate-100 outline-none focus:border-rose-500 font-medium resize-none text-sm"
            />
          </div>

          {/* 6. GOOGLE CALENDAR */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl ${user?.google_connected ? 'bg-emerald-50' : 'bg-slate-50'}`}>
                <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg" className={`w-8 h-8 ${user?.google_connected ? '' : 'grayscale opacity-50'}`} alt="Google" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 tracking-tight">Sincronização Google {user?.google_connected && <span className="text-[10px] bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-md font-black uppercase">Ativo</span>}</h3>
                <p className="text-xs text-slate-400">Espelhar agendamentos confirmados.</p>
              </div>
            </div>
            <button type="button" onClick={user?.google_connected ? handleDisconnectGoogle : handleConnectGoogle} className={`px-8 py-3 rounded-2xl font-bold transition-all ${user?.google_connected ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg'}`}>
              {user?.google_connected ? 'Desvincular' : 'Conectar'}
            </button>
          </div>

          {/* RODAPÉ FIXO */}
          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={isSaving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-16 py-5 rounded-[2rem] font-black uppercase tracking-widest shadow-2xl shadow-indigo-200 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50"
            >
              {isSaving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SettingsPage;