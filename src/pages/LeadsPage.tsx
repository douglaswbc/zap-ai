import React, { useState, useEffect, useMemo } from 'react';
import { api } from '@/services/api';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/hooks/useAuth';
import { ToastType } from '@/components/Toast';

interface LeadsPageProps {
  showToast: (msg: string, type: ToastType) => void;
  setActiveTab: (tab: string) => void; // Adicionado para navegação
}

const KANBAN_STAGES = ['Novo', 'Interesse', 'Agendado', 'Faturado', 'Perdido'];

const LeadsPage: React.FC<LeadsPageProps> = ({ showToast, setActiveTab }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTabLocal] = useState<'list' | 'kanban'>('list');
  const [leads, setLeads] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // 1. CÁLCULO DE ESTATÍSTICAS (Corrigido para objeto único)
  const stats = useMemo(() => {
    let ai = 0;
    let human = 0;
    leads.forEach(l => {
      const isHuman = l.conversations?.is_human_active ?? false;
      if (isHuman) human++; else ai++;
    });
    return { aiActive: ai, humanActive: human };
  }, [leads]);

  const loadLeads = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const cid = user.company_id || user.id;
      const { data: contacts, error } = await supabase
        .from('contacts')
        .select('*, conversations(id, is_human_active, instance_id)')
        .eq('company_id', cid)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads(contacts || []);
    } catch (error) {
      console.error("Erro:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadLeads(); }, [user]);

  // 2. ALTERNAR ATENDIMENTO (Corrigido para garantir persistência)
  const toggleAtendimento = async (isHuman: boolean) => {
    if (!selectedLead) return;
    setIsUpdating(true);

    try {
      // 1. Grava no banco via API
      const conversationId = await api.leads.toggleAtendimento(selectedLead, isHuman);

      // 2. Notificação se for humano
      if (isHuman) {
        const { data: convData } = await supabase
          .from('conversations')
          .select('instances(name, token)')
          .eq('id', conversationId)
          .single();

        const inst = (convData as any)?.instances;
        if (inst?.token) {
          const welcomeMsg = `Olá *${selectedLead.name}*! Sou um atendente humano e vou prosseguir com seu atendimento. Como posso ajudar?`;
          await fetch(`${import.meta.env.VITE_EVO_API_URL}/message/sendText/${inst.name}`, {
            method: 'POST',
            headers: { 'apikey': inst.token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ number: selectedLead.phone, text: welcomeMsg })
          });
          await supabase.from('messages').insert({ conversation_id: conversationId, sender: 'OPERATOR', content: welcomeMsg });
        }
      }

      showToast(isHuman ? 'Modo Humano Ativado' : 'IA Reativada', 'success');
      
      // 3. ATUALIZAÇÃO FORÇADA: Recarrega a lista e o modal
      await loadLeads();
      
      const { data: freshLead } = await supabase
        .from('contacts')
        .select('*, conversations(id, is_human_active, instance_id)')
        .eq('id', selectedLead.id)
        .single();
        
      setSelectedLead(freshLead);

    } catch (e: any) {
      showToast(e.message || 'Erro ao alterar modo', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveLeadEdits = async () => {
    if (!selectedLead) return;
    setIsUpdating(true);
    try {
      await supabase.from('contacts').update({
        name: selectedLead.name, email: selectedLead.email,
        cpf: selectedLead.cpf, summary: selectedLead.summary, status: selectedLead.status
      }).eq('id', selectedLead.id);
      showToast('Dados salvos!', 'success');
      loadLeads();
    } catch (e) { showToast('Erro ao salvar', 'error'); }
    finally { setIsUpdating(false); }
  };

  return (
    <div className="p-8 h-full overflow-y-auto custom-scrollbar bg-slate-50/30">
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Gestão de Leads</h1>
          <p className="text-slate-400 text-sm">IA vs Humano</p>
        </div>
        <button onClick={loadLeads} className="p-3 bg-white border rounded-2xl hover:bg-slate-50 transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeWidth="2" strokeLinecap="round" /></svg></button>
      </header>

      {/* CARDS STATS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white border-2 border-indigo-100 p-6 rounded-[2rem] flex items-center justify-between shadow-sm">
          <div><p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">IA Ativa</p><h4 className="text-2xl font-black">{stats.aiActive}</h4></div>
          <div className="text-4xl font-black text-indigo-600 bg-indigo-50 w-16 h-16 flex items-center justify-center rounded-2xl">{stats.aiActive}</div>
        </div>
        <div className="bg-white border-2 border-amber-100 p-6 rounded-[2rem] flex items-center justify-between shadow-sm">
          <div><p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Humano</p><h4 className="text-2xl font-black">{stats.humanActive}</h4></div>
          <div className="text-4xl font-black text-amber-600 bg-amber-50 w-16 h-16 flex items-center justify-center rounded-2xl">{stats.humanActive}</div>
        </div>
      </div>

      <div className="flex bg-slate-200/50 p-1.5 rounded-2xl w-fit mb-8 shadow-inner">
        <button onClick={() => setActiveTabLocal('list')} className={`px-8 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'list' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500'}`}>Lista</button>
        <button onClick={() => setActiveTabLocal('kanban')} className={`px-8 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'kanban' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500'}`}>Pipeline</button>
      </div>

      {activeTab === 'list' ? (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <tbody className="divide-y divide-slate-50">
              {leads.map(lead => (
                <tr key={lead.id} onClick={() => setSelectedLead(lead)} className="hover:bg-indigo-50/30 cursor-pointer group">
                  <td className="px-8 py-5"><p className="font-bold text-slate-900">{lead.name}</p><p className="text-xs text-slate-400">{lead.phone}</p></td>
                  <td className="px-8 py-5"><span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase">{lead.status}</span></td>
                  <td className="px-8 py-5">
                    {lead.conversations?.is_human_active ? 
                      <span className="flex items-center gap-2 text-amber-600 font-bold text-xs"><span className="w-2 h-2 bg-amber-500 rounded-full animate-ping"/> Humano</span> :
                      <span className="flex items-center gap-2 text-indigo-600 font-bold text-xs"><span className="w-2 h-2 bg-indigo-500 rounded-full"/> IA Zap</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex gap-6 overflow-x-auto pb-6 custom-scrollbar min-h-[500px]">
          {KANBAN_STAGES.map(stage => (
            <div key={stage} className="min-w-[300px] flex-1">
              <h3 className="text-xs font-black uppercase text-slate-400 mb-4 px-4">{stage}</h3>
              <div className="bg-slate-100/50 p-4 rounded-[2rem] min-h-[400px] border-2 border-dashed border-slate-200">
                {leads.filter(l => l.status === stage).map(lead => (
                  <div key={lead.id} onClick={() => setSelectedLead(lead)} className="bg-white p-5 rounded-2xl shadow-sm border mb-4 border-slate-200 hover:border-indigo-300 transition-all">
                    <p className="font-bold text-slate-900 mb-1">{lead.name}</p>
                    <span className={`text-[9px] px-2 py-0.5 rounded-md font-black uppercase ${lead.conversations?.is_human_active ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}`}>
                      {lead.conversations?.is_human_active ? 'Humano' : 'Agente IA'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL DE DETALHES DO LEAD */}
      {selectedLead && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedLead(null)} />
          <div className="relative w-full max-w-lg bg-white h-full shadow-2xl animate-in slide-in-from-right duration-500 overflow-y-auto">
            <div className="p-8">
              <header className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black text-slate-900">Gestão de Lead</h2>
                <button onClick={() => setSelectedLead(null)} className="p-2 hover:bg-slate-100 rounded-full">
                  <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2" strokeLinecap="round"/></svg>
                </button>
              </header>

              {/* BOTÃO IR PARA CONVERSA - NOVO */}
              {selectedLead.conversations?.id && (
                <button 
                  onClick={() => setActiveTab('conversations')}
                  className="w-full mb-6 flex items-center justify-center gap-2 py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-lg hover:bg-slate-800 transition-all active:scale-95"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                  Abrir Conversa no WhatsApp
                </button>
              )}

              <div className="bg-slate-50 p-6 rounded-3xl mb-8 border border-slate-100">
                <h4 className="text-[10px] font-black text-slate-400 uppercase mb-4">Controle de Atendimento</h4>
                <div className="flex gap-4">
                  <button 
                    disabled={isUpdating}
                    onClick={() => toggleAtendimento(true)}
                    className={`flex-1 py-4 rounded-2xl font-bold text-sm transition-all ${selectedLead.conversations?.is_human_active ? 'bg-amber-500 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-200'}`}
                  >
                    Assumir Humano
                  </button>
                  <button 
                    disabled={isUpdating}
                    onClick={() => toggleAtendimento(false)}
                    className={`flex-1 py-4 rounded-2xl font-bold text-sm transition-all ${selectedLead.conversations?.is_human_active === false ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-200'}`}
                  >
                    Ativar Agente IA
                  </button>
                </div>
              </div>

              {/* FORMULÁRIO */}
              <div className="space-y-6">
                <input type="text" placeholder="Nome" value={selectedLead.name} onChange={e => setSelectedLead({...selectedLead, name: e.target.value})} className="w-full px-5 py-3 rounded-2xl bg-slate-50 border-none font-medium"/>
                <div className="grid grid-cols-2 gap-4">
                  <input type="text" placeholder="CPF" value={selectedLead.cpf || ''} onChange={e => setSelectedLead({...selectedLead, cpf: e.target.value})} className="w-full px-5 py-3 rounded-2xl bg-slate-50 border-none font-medium"/>
                  <input type="text" readOnly value={selectedLead.phone} className="w-full px-5 py-3 rounded-2xl bg-slate-100 border-none font-medium text-slate-400"/>
                </div>
                <select value={selectedLead.status} onChange={e => setSelectedLead({...selectedLead, status: e.target.value})} className="w-full px-5 py-3 rounded-2xl bg-slate-50 border-none font-medium">
                  {KANBAN_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <div className="bg-indigo-50/50 p-6 rounded-[2rem] border border-indigo-100">
                  <h4 className="text-xs font-black text-indigo-600 uppercase mb-4">Resumo da IA</h4>
                  <textarea rows={4} value={selectedLead.summary || ''} onChange={e => setSelectedLead({...selectedLead, summary: e.target.value})} className="w-full bg-transparent border-none focus:ring-0 text-sm font-medium text-slate-600 resize-none" placeholder="Sem resumo ainda..."/>
                </div>
                <button disabled={isUpdating} onClick={handleSaveLeadEdits} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold shadow-xl disabled:opacity-50">
                  {isUpdating ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadsPage;