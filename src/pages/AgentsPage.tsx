import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Agent, Instance } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { ToastType } from '@/components/Toast';
import { supabase } from '@/services/supabase';

interface AgentsPageProps {
  showToast: (msg: string, type: ToastType) => void;
}

interface EditingAgent extends Partial<Agent> {
  targetInstance?: string;
  is_multi_agent?: boolean;
  parent_agent_id?: string | null;
}

const AgentsPage: React.FC<AgentsPageProps> = ({ showToast }) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingAgent, setEditingAgent] = useState<EditingAgent | null>(null);
  const [activeTab, setActiveTab] = useState<'geral' | 'personality' | 'knowledge'>('geral');
  const { user } = useAuth();

  const loadData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [agentsData, instancesData, templatesData] = await Promise.all([
        api.agents.list(user),
        api.instances.list(user),
        api.templates.listAll(user)
      ]);
      setAgents(agentsData);
      setInstances(instancesData);
      setTemplates(templatesData);
    } catch (error) {
      showToast('Erro ao carregar dados', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAgent || !user) return;

    try {
      const agentToSave = {
        id: editingAgent.id,
        name: editingAgent.name,
        prompt: editingAgent.prompt || '',
        knowledge_base: (editingAgent as any).knowledge_base || '',
        temperature: editingAgent.temperature,
        presence_penalty: editingAgent.presence_penalty,
        enable_audio: editingAgent.enable_audio || (editingAgent as any).enableAudio || false,
        enable_image: editingAgent.enable_image || (editingAgent as any).enableImage || false,
        is_multi_agent: editingAgent.is_multi_agent || false,
        parent_agent_id: editingAgent.is_multi_agent ? null : (editingAgent.parent_agent_id || (editingAgent as any).parentAgentId)
      };

      const savedAgent = await api.agents.upsert(agentToSave, user);
      const agentId = editingAgent.id || savedAgent.id;

      if (agentToSave.is_multi_agent && editingAgent.targetInstance) {
        await supabase.from('instances')
          .update({ agent_id: agentId })
          .eq('name', editingAgent.targetInstance);
      }

      showToast('Inteligência atualizada!', 'success');
      setEditingAgent(null);
      loadData();
    } catch (error: any) {
      showToast(`Erro ao salvar: ${error.message}`, 'error');
    }
  };

  const openEditModal = (agent: Partial<Agent>, instanceName = '') => {
    setEditingAgent({
      ...agent,
      targetInstance: instanceName || '',
      is_multi_agent: (agent as any).is_multi_agent ?? (agent as any).isMultiAgent ?? false,
      parent_agent_id: (agent as any).parent_agent_id ?? (agent as any).parentAgentId ?? null,
      enable_audio: (agent as any).enable_audio ?? (agent as any).enableAudio ?? false,
      enable_image: (agent as any).enable_image ?? (agent as any).enableImage ?? false,
      knowledge_base: (agent as any).knowledge_base || '',
      prompt: agent.prompt || ''
    });
    setActiveTab('geral');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este agente?')) return;
    try {
      await api.agents.delete(id);
      showToast('Agente removido', 'success');
      loadData();
    } catch (error) {
      showToast('Erro ao excluir', 'error');
    }
  };

  const handleApplyTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template && editingAgent) {
      setEditingAgent({
        ...editingAgent,
        prompt: template.prompt || ''
      });
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto w-full overflow-y-auto h-full custom-scrollbar bg-slate-50/30">
      <header className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Agentes IA</h1>
          <p className="text-slate-500 mt-1">Gerencie as personalidades e o conhecimento da sua operação.</p>
        </div>
        <button
          onClick={() => openEditModal({ name: '', prompt: '', temperature: 0.7 })}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="2" strokeLinecap="round" /></svg>
          Novo Agente
        </button>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-slate-400 font-bold uppercase tracking-widest text-xs">Carregando agentes...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {agents.map((agent) => {
            const isMulti = (agent as any).is_multi_agent || (agent as any).isMultiAgent;
            const isChild = !!((agent as any).parent_agent_id || (agent as any).parentAgentId);
            const linkedInstance = instances.find(i => i.agent_id === agent.id);

            return (
              <div key={agent.id} className={`bg-white border ${isMulti ? 'border-indigo-200 ring-4 ring-indigo-50' : 'border-slate-200'} rounded-[2.5rem] p-8 shadow-sm hover:shadow-xl transition-all flex flex-col group relative overflow-hidden`}>
                <div className="flex justify-between items-start mb-6">
                  <div className={`p-4 ${isMulti ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"} rounded-2xl`}>
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {isMulti ? <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" strokeWidth="2" /> : <path d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18" strokeWidth="2" />}
                    </svg>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {linkedInstance && <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-wider">● Conectado: {linkedInstance.name}</span>}
                    {isMulti && <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-black uppercase tracking-wider">Router Principal</span>}
                    {isChild && <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold uppercase tracking-wider">Sub-Agente</span>}
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">{agent.name}</h3>
                <p className="text-slate-500 text-sm mb-6 line-clamp-2 italic">{agent.prompt?.substring(0, 150)}...</p>

                <div className="mt-auto flex gap-3 pt-6 border-t border-slate-50">
                  <button onClick={() => openEditModal(agent, linkedInstance?.name)} className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-slate-800 transition-colors shadow-md text-sm">Configurar</button>
                  <button onClick={() => handleDelete(agent.id)} className="p-4 bg-rose-50 text-rose-500 rounded-2xl hover:bg-rose-100 transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth="2" /></svg></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editingAgent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-5xl max-h-[95vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in duration-200">

            {/* Header Modal */}
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" strokeWidth="2" /></svg>
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none">{editingAgent.id ? 'Editar Agente' : 'Novo Agente'}</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Configuração de Inteligência</p>
                </div>
              </div>
              <button onClick={() => setEditingAgent(null)} className="p-2 hover:bg-slate-50 rounded-xl transition-all border border-slate-200">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2" /></svg>
              </button>
            </div>

            {/* Abas de Navegação */}
            <div className="flex px-8 bg-slate-50/50 border-b border-slate-100">
              <button type="button" onClick={() => setActiveTab('geral')} className={`px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'geral' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Geral</button>
              <button type="button" onClick={() => setActiveTab('personality')} className={`px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'personality' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Personalidade</button>
              <button type="button" onClick={() => setActiveTab('knowledge')} className={`px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'knowledge' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Base de Conhecimento</button>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
              <div className="p-8 sm:p-10 flex-1">

                {/* ABA GERAL */}
                {activeTab === 'geral' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Identificação do Agente</label>
                        <input required value={editingAgent.name} onChange={e => setEditingAgent({ ...editingAgent, name: e.target.value })} placeholder="Ex: Atendente de Vendas" className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:border-indigo-500 focus:bg-white font-bold text-lg transition-all" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Criatividade ({editingAgent.temperature})</label>
                        <div className="px-4 py-4 bg-slate-50 rounded-2xl border border-slate-200">
                          <input type="range" min="0" max="1" step="0.1" value={editingAgent.temperature || 0.7} onChange={e => setEditingAgent({ ...editingAgent, temperature: parseFloat(e.target.value) })} className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                          <div className="flex justify-between text-[8px] font-bold text-slate-400 mt-2 uppercase">
                            <span>Focado</span>
                            <span>Criativo</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-8 bg-indigo-50/50 rounded-[2.5rem] border border-indigo-100">
                      <h4 className="text-xs font-black text-indigo-900 uppercase tracking-widest mb-6">Conexão e Fluxo</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <label className="flex items-center gap-4 cursor-pointer p-4 bg-white rounded-2xl border border-indigo-200 shadow-sm">
                            <div className="relative inline-flex items-center cursor-pointer">
                              <input type="checkbox" checked={!!editingAgent.is_multi_agent} onChange={e => setEditingAgent({ ...editingAgent, is_multi_agent: e.target.checked })} className="sr-only peer" />
                              <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                            </div>
                            <span className="text-[10px] font-black text-indigo-800 uppercase tracking-wider">Router Principal (WhatsApp)</span>
                          </label>

                          {editingAgent.is_multi_agent ? (
                            <div className="space-y-2">
                              <label className="block text-[9px] font-black text-slate-400 uppercase ml-1 tracking-widest">Vincular Instância</label>
                              <select value={editingAgent.targetInstance} onChange={e => setEditingAgent({ ...editingAgent, targetInstance: e.target.value })} className="w-full px-4 py-3.5 rounded-xl bg-white border border-indigo-200 outline-none text-xs font-bold shadow-sm">
                                <option value="">Vincular a uma instância...</option>
                                {instances.map(inst => <option key={inst.id} value={inst.name}>{inst.name}</option>)}
                              </select>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <label className="block text-[9px] font-black text-slate-400 uppercase ml-1 tracking-widest">Agente Pai (Opcional)</label>
                              <select value={editingAgent.parent_agent_id || ''} onChange={e => setEditingAgent({ ...editingAgent, parent_agent_id: e.target.value || null })} className="w-full px-4 py-3.5 rounded-xl bg-white border border-slate-200 outline-none text-xs font-medium shadow-sm">
                                <option value="">Sem Agente Pai (Independente)</option>
                                {agents.filter(a => ((a as any).is_multi_agent || (a as any).isMultiAgent) && a.id !== editingAgent.id).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                              </select>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <label className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-indigo-100 cursor-pointer hover:border-indigo-400 transition-all shadow-sm">
                            <input type="checkbox" checked={editingAgent.enable_audio || (editingAgent as any).enableAudio} onChange={e => setEditingAgent({ ...editingAgent, enable_audio: e.target.checked })} className="w-5 h-5 rounded border-slate-300 text-indigo-600 mb-2" />
                            <span className="text-[10px] font-black text-slate-600 uppercase">Habilitar Áudio</span>
                          </label>
                          <label className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-indigo-100 cursor-pointer hover:border-indigo-400 transition-all shadow-sm">
                            <input type="checkbox" checked={editingAgent.enable_image || (editingAgent as any).enableImage} onChange={e => setEditingAgent({ ...editingAgent, enable_image: e.target.checked })} className="w-5 h-5 rounded border-slate-300 text-indigo-600 mb-2" />
                            <span className="text-[10px] font-black text-slate-600 uppercase">Habilitar Visão</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ABA PERSONALIDADE (PROMPT) */}
                {activeTab === 'personality' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2">Prompt da Personalidade</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Defina como o agente deve agir, falar e quais regras seguir.</p>
                      </div>
                      <select onChange={(e) => handleApplyTemplate(e.target.value)} className="px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-200 outline-none text-[10px] font-black uppercase tracking-widest text-slate-600" defaultValue="">
                        <option value="" disabled>Carregar do Template...</option>
                        {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>

                    <div className="p-8 bg-indigo-900 rounded-[3rem] shadow-2xl border border-indigo-700">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-2xl border border-indigo-500/30">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeWidth="2" /></svg>
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-white uppercase tracking-widest">Prompt do Sistema</h4>
                          <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Instruções comportamentais para a IA.</p>
                        </div>
                      </div>

                      <textarea
                        value={editingAgent.prompt}
                        onChange={e => setEditingAgent({ ...editingAgent, prompt: e.target.value })}
                        rows={16}
                        placeholder="Ex: Seu nome é João. Você é um atendente amigável e focado em vendas..."
                        className="w-full bg-indigo-800/40 text-indigo-50 p-8 rounded-[2rem] border border-indigo-700 outline-none focus:border-indigo-400 transition-all font-medium text-sm leading-relaxed custom-scrollbar shadow-inner"
                      />
                    </div>
                  </div>
                )}

                {/* ABA CONHECIMENTO */}
                {activeTab === 'knowledge' && (
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="p-8 bg-slate-900 rounded-[3rem] shadow-2xl border border-slate-700">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30" >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" strokeWidth="2" /></svg>
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-white uppercase tracking-widest">Base de Conhecimento</h4>
                          <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Forneça as informações fundamentais que a IA deve saber.</p>
                        </div>
                      </div>

                      <textarea
                        value={(editingAgent as any).knowledge_base}
                        onChange={e => setEditingAgent({ ...editingAgent, knowledge_base: e.target.value } as any)}
                        rows={16}
                        placeholder="Descreva aqui informações sobre produtos, serviços, preços, política de cancelamento..."
                        className="w-full bg-slate-800/50 text-slate-200 p-8 rounded-[2rem] border border-slate-700 outline-none focus:border-indigo-500 transition-all font-medium text-sm leading-relaxed custom-scrollbar shadow-inner"
                      />

                      <div className="mt-4 flex items-start gap-3 px-4 py-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                        <svg className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2" /></svg>
                        <p className="text-[9px] text-indigo-300 font-bold uppercase leading-relaxed tracking-wider">Dica: Seja específico e detalhado. Essas informações serão usadas pela IA para responder perguntas técnicas e rotineiras sem sua intervenção.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Modal */}
              <div className="p-8 bg-white border-t border-slate-100 flex gap-4 sticky bottom-0 z-20">
                <button type="button" onClick={() => setEditingAgent(null)} className="flex-1 py-4 font-black text-slate-400 uppercase tracking-widest text-[10px] hover:text-slate-600 transition-colors">Descartar</button>
                <button type="submit" className="flex-[2] bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all">Salvar Agente</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentsPage;