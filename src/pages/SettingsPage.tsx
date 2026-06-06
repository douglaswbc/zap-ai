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
    nome: '',
    email: '',
    horario_abertura: '08:00',
    horario_fechamento: '20:00',
    working_days: "Segunda, Terça, Quarta, Quinta, Sexta, Sábado",
    duracao_sessao_minutos: '60',
    mensagem_ausencia: '',
    endereco: '',
    informacoes_clinica: '',
    google_refresh_token: '',
    wascript_token: '',
    ai_prompt: ''
  });

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const data = await api.config.get();
      if (data) {
        setFormData(prev => ({
          ...prev,
          ...data,
          nome: user?.nome || user?.name || prev.nome,
          email: user?.email || prev.email
        }));
      }
    } catch (error) {
      showToast('Erro ao carregar configurações', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const promises = Object.entries(formData).map(([chave, valor]) => {
         if (chave === 'nome' || chave === 'email') return Promise.resolve();
         return api.config.save(chave, (valor as string) || '');
      });
      
      await Promise.all(promises);
      showToast('Configurações salvas com sucesso!', 'success');
    } catch (error: any) {
      showToast(`Erro ao salvar: ${error.message}`, 'error');
    } finally {
      setIsSaving(false);
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

  const toggleDay = (day: string) => {
    const current = formData.working_days.split(',').map(d => d.trim()).filter(Boolean);
    const updated = current.includes(day)
        ? current.filter(d => d !== day)
        : [...current, day];
    setFormData({ ...formData, working_days: updated.join(', ') });
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
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Configurações da Clínica</h1>
          <p className="text-slate-500 mt-1">Gerencie horários, regras da IA e integrações.</p>
        </header>

        <form onSubmit={handleSave} className="space-y-8 pb-20">

          {/* 1. HORÁRIO E FUNCIONAMENTO */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2 uppercase tracking-tighter">
              Horário de Funcionamento
            </h3>
            
            <div className="space-y-8">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-4 ml-1 tracking-widest">Dias de Trabalho</label>
                <div className="flex flex-wrap gap-2">
                  {WEEK_DAYS.map(day => (
                    <button key={day} type="button" onClick={() => toggleDay(day)} className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all border ${formData.working_days.includes(day) ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-400 border-slate-100 hover:border-indigo-200'}`}>{day}</button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Abertura</label>
                  <input type="time" value={formData.horario_abertura} onChange={e => setFormData({ ...formData, horario_abertura: e.target.value })} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 font-medium" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Fechamento</label>
                  <input type="time" value={formData.horario_fechamento} onChange={e => setFormData({ ...formData, horario_fechamento: e.target.value })} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 font-medium" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Duração Sessão (Min)</label>
                  <input type="number" value={formData.duracao_sessao_minutos} onChange={e => setFormData({ ...formData, duracao_sessao_minutos: e.target.value })} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 font-medium" />
                </div>
              </div>
            </div>
          </div>

          {/* 2. CONFIGURAÇÃO IA */}
          <div className="bg-white p-8 rounded-[2.5rem] border-2 border-indigo-100 shadow-sm">
            <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2 uppercase tracking-tighter">
              Inteligência Artificial (Prompt)
            </h3>
            <textarea
              rows={6}
              value={formData.ai_prompt}
              onChange={e => setFormData({ ...formData, ai_prompt: e.target.value })}
              placeholder="Instruções de como a IA deve se comportar..."
              className="w-full px-6 py-5 rounded-[2rem] bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 font-medium text-sm"
            />
          </div>

          {/* 3. INTEGRAÇÕES */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-8">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 tracking-tight">Integrações Técnicas</h3>
            
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">WAScript Token (WhatsApp)</label>
                <input type="text" value={formData.wascript_token} onChange={e => setFormData({ ...formData, wascript_token: e.target.value })} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 font-medium text-sm" placeholder="Token da API WAScript" />
              </div>
              
              <div className="relative">
                <div className="flex justify-between items-center mb-2 ml-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Google Refresh Token</label>
                  <button 
                    type="button" 
                    onClick={handleConnectGoogle}
                    className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-md transition-colors"
                  >
                    <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg" className="w-3 h-3" alt="Google" />
                    {formData.google_refresh_token ? 'Reconectar Google' : 'Conectar Google'}
                  </button>
                </div>
                <textarea 
                  rows={2} 
                  value={formData.google_refresh_token} 
                  onChange={e => setFormData({ ...formData, google_refresh_token: e.target.value })} 
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 font-medium text-xs resize-none" 
                  placeholder="O token aparecerá aqui após a conexão ou pode ser colado manualmente" 
                />
                {formData.google_refresh_token && (
                   <div className="absolute right-4 bottom-4">
                      <div className="flex items-center gap-1.5 bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg text-[9px] font-black uppercase">
                         <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                         Conectado
                      </div>
                   </div>
                )}
              </div>
            </div>
          </div>

          {/* 4. INSTITUCIONAL */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-4">
             <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2 tracking-tight">Informações da Clínica</h3>
             <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Endereço</label>
                <input type="text" value={formData.endereco} onChange={e => setFormData({ ...formData, endereco: e.target.value })} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 font-medium" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Informações Gerais / FAQ</label>
                <textarea rows={3} value={formData.informacoes_clinica} onChange={e => setFormData({ ...formData, informacoes_clinica: e.target.value })} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 font-medium text-sm" />
              </div>
          </div>

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