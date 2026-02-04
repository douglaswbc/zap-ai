import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { supabase } from '@/services/supabase';
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
    is24h: false,
    instagramConnected: false,
    instagramAccessToken: '',
    instagramBusinessId: '',
    metaAppId: '',
    metaAppSecret: '',
    metaVerifyToken: ''
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
            is24h: data.is_24h || false,
            instagramConnected: data.instagram_connected || false,
            instagramAccessToken: data.instagram_access_token || '',
            instagramBusinessId: data.instagram_business_id || '',
            metaAppId: data.meta_app_id || '',
            metaAppSecret: data.meta_app_secret || '',
            metaVerifyToken: data.meta_webhook_verify_token || ''
          }));
        }

        // 3. Captura código de autorização da Meta se presente na URL
        const code = new URLSearchParams(window.location.search).get('code');
        if (code && !isLoading) {
          handleConnectInstagram(code);
        }

        setIsLoading(false);
      });
    }
  }, [user]);

  const handleConnectInstagram = async (code: string) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/instagram-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(supabase as any).auth?.session?.()?.access_token || ''}`
        },
        body: JSON.stringify({ code, company_id: user.company_id || user.id })
      });

      const result = await response.json();
      if (result.error) throw new Error(result.error);

      showToast('Instagram conectado com sucesso!', 'success');
      window.history.replaceState({}, document.title, window.location.pathname);
      window.location.reload();
    } catch (error: any) {
      showToast('Erro ao conectar Instagram: ' + error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnectInstagram = async () => {
    if (!confirm('Deseja realmente remover a integração com o Instagram?')) return;
    setIsLoading(true);
    try {
      await api.settings.save(user!, {
        instagram_connected: false,
        instagram_access_token: null,
        instagram_business_id: null,
        instagram_page_id: null
      });
      showToast('Integração com Instagram removida!', 'success');
      window.location.reload();
    } catch (error: any) {
      showToast('Erro ao desconectar Instagram.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

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
        is24h: formData.is24h,
        metaAppId: formData.metaAppId,
        metaAppSecret: formData.metaAppSecret,
        metaVerifyToken: formData.metaVerifyToken,
        // Só envia se não for vazio
        ...(formData.instagramAccessToken.trim() ? { instagramAccessToken: formData.instagramAccessToken.trim() } : {}),
        ...(formData.instagramBusinessId.trim() ? { instagramBusinessId: formData.instagramBusinessId.trim() } : {})
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

  const handleStartMetaAuth = () => {
    const appId = formData.metaAppId || import.meta.env.VITE_META_APP_ID;
    if (!appId) {
      showToast('Configure o Meta App ID primeiro.', 'error');
      return;
    }
    const redirectUri = encodeURIComponent(import.meta.env.VITE_META_REDIRECT_URI);
    const scope = encodeURIComponent('instagram_basic,instagram_manage_messages,instagram_manage_comments,pages_show_list');

    const url = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code`;

    window.location.href = url;
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

          {/* 7. INSTAGRAM integration */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl ${formData.instagramConnected ? 'bg-pink-50' : 'bg-slate-50'}`}>
                  <svg className={`w-8 h-8 ${formData.instagramConnected ? 'text-pink-600' : 'grayscale opacity-50'}`} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.136.053 1.761.213 2.163.369.533.204.914.448 1.314.848.4.4.644.78.848 1.314.156.402.316 1.027.369 2.163.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.053 1.136-.213 1.761-.369 2.163-.204.533-.448.914-.848 1.314-.4.4-.78.644-1.314.848-.402.156-1.027.316-2.163.369-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.136-.053-1.761-.213-2.163-.369-.533-.204-.914-.448-1.314-.848-.4-.4-.644-.78-.848-1.314-.156-.402-.316-1.027-.369-2.163C2.175 15.584 2.163 15.204 2.163 12s.012-3.584.07-4.85c.053-1.136.213-1.761.369-2.163.204-.533.448-.914.848-1.314.4-.4.78-.644 1.314-.848.402-.156 1.027-.316 2.163-.369 1.266-.058 1.646-.07 4.85-.07zm0-2.163c-3.259 0-3.667.014-4.947.072-1.277.057-2.148.258-2.911.554-.789.306-1.459.715-2.126 1.383-.668.667-1.077 1.337-1.383 2.126-.296.763-.497 1.634-.554 2.911-.058 1.28-.072 1.688-.072 4.947s.014 3.667.072 4.947c.057 1.277.258 2.148.554 2.911.306.789.715 1.459 1.383 2.126.667.668 1.337 1.077 2.126 1.383.763.296 1.634.497 2.911.554 1.28.058 1.688.072 4.947.072s3.667-.014 4.947-.072c1.277-.057 2.148-.258 2.911-.554.789-.306 1.459-.715 2.126-1.383.668-.667 1.077-1.337 1.383-2.126.296-.763.497-1.634.554-2.911.058-1.28.072-1.688.072-4.947s-.014-3.667-.072-4.947c-.057-1.277-.258-2.148-.554-2.911-.306-.789-.715-1.459-1.383-2.126-.667-.668-1.337-1.077-2.126-1.383-.763-.296-1.634-.497-2.911-.554-1.28-.058-1.688-.072-4.947-.072z" /><path d="M12 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.162 6.162 6.162 6.162-2.759 6.162-6.162-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.791-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.209-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 tracking-tight">Instagram Business {formData.instagramConnected && <span className="text-[10px] bg-pink-100 text-pink-600 px-2 py-0.5 rounded-md font-black uppercase">Ativo</span>}</h3>
                  <p className="text-xs text-slate-400">Automação de DMs e comentários.</p>
                </div>
              </div>
              <button type="button" onClick={formData.instagramConnected ? handleDisconnectInstagram : handleStartMetaAuth} className={`px-8 py-3 rounded-2xl font-bold transition-all ${formData.instagramConnected ? 'bg-pink-50 text-pink-600 hover:bg-pink-100' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg'}`}>
                {formData.instagramConnected ? 'Desvincular' : 'Conectar'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-100">
              <div className="col-span-full">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Credenciais do Meta App (Opcional)</p>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Meta App ID</label>
                <input type="text" value={formData.metaAppId} onChange={e => setFormData({ ...formData, metaAppId: e.target.value })} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-pink-500 font-medium text-sm" placeholder="ID do App na Meta" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Meta App Secret</label>
                <input type="password" value={formData.metaAppSecret} onChange={e => setFormData({ ...formData, metaAppSecret: e.target.value })} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-pink-500 font-medium text-sm" placeholder="••••••••••••" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Instagram Access Token (Manual)</label>
                <textarea rows={2} value={formData.instagramAccessToken} onChange={e => setFormData({ ...formData, instagramAccessToken: e.target.value })} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-pink-500 font-medium text-xs resize-none" placeholder="Token de acesso (EAAB...)" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Instagram Business ID (Manual)</label>
                <input type="text" value={formData.instagramBusinessId} onChange={e => setFormData({ ...formData, instagramBusinessId: e.target.value })} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-pink-500 font-medium text-sm" placeholder="ID da conta profissional (123...)" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Webhook Verify Token</label>
                <input type="text" value={formData.metaVerifyToken} onChange={e => setFormData({ ...formData, metaVerifyToken: e.target.value })} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-pink-500 font-medium text-sm" placeholder="Token inventado para o Webhook" />
              </div>
            </div>
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