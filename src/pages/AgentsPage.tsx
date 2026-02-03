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
  pacif?: {
    papel: string;
    contexto: string;
    regras: string;
    acao: string;
    intencao: string;
    formato: string;
  };
}

const AgentsPage: React.FC<AgentsPageProps> = ({ showToast }) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingAgent, setEditingAgent] = useState<EditingAgent | null>(null);
  const { user } = useAuth();

  const [availableTools, setAvailableTools] = useState<any[]>([]);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);

  const parsePromptToPacif = (prompt: string) => {
    return {
      papel: prompt.match(/# PAPEL\n([\s\S]*?)(?=\n#|$)/)?.[1]?.trim() || '',
      contexto: prompt.match(/# CONTEXTO\n([\s\S]*?)(?=\n#|$)/)?.[1]?.trim() || '',
      regras: prompt.match(/# REGRAS\n([\s\S]*?)(?=\n#|$)/)?.[1]?.trim() || '',
      acao: prompt.match(/# AÇÃO\n([\s\S]*?)(?=\n#|$)/)?.[1]?.trim() || '',
      intencao: prompt.match(/# INTENÇÃO\n([\s\S]*?)(?=\n#|$)/)?.[1]?.trim() || '',
      formato: prompt.match(/# FORMATO\n([\s\S]*?)(?=\n#|$)/)?.[1]?.trim() || '',
    };
  };

  const loadData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [agentsData, instancesData, templatesData, toolsData] = await Promise.all([
        api.agents.list(user),
        api.instances.list(user),
        api.templates.listAll(user),
        supabase.from('tools').select('*')
      ]);
      setAgents(agentsData);
      setInstances(instancesData);
      setTemplates(templatesData);
      setAvailableTools(toolsData.data || []);
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
    if (!editingAgent || !user || !editingAgent.pacif) return;

    const fullPrompt = `
# PAPEL
${editingAgent.pacif.papel}

# CONTEXTO
${editingAgent.pacif.contexto}

# REGRAS
${editingAgent.pacif.regras}

# AÇÃO
${editingAgent.pacif.acao}

# INTENÇÃO
${editingAgent.pacif.intencao}

# FORMATO
${editingAgent.pacif.formato}
`.trim();

    try {
      const agentToSave = {
        id: editingAgent.id,
        name: editingAgent.name,
        prompt: fullPrompt,
        temperature: editingAgent.temperature,
        presence_penalty: editingAgent.presence_penalty,
        // Normalização para o Banco de Dados
        enable_audio: editingAgent.enable_audio || (editingAgent as any).enableAudio || false,
        enable_image: editingAgent.enable_image || (editingAgent as any).enableImage || false,
        is_multi_agent: editingAgent.is_multi_agent || false,
        parent_agent_id: editingAgent.is_multi_agent ? null : (editingAgent.parent_agent_id || (editingAgent as any).parentAgentId)
      };

      const savedAgent = await api.agents.upsert(agentToSave, user);
      const agentId = editingAgent.id || savedAgent.id;

      await supabase.from('agent_tools').delete().eq('agent_id', agentId);
      if (selectedTools.length > 0) {
        const toolLinks = selectedTools.map(tId => ({ agent_id: agentId, tool_id: tId }));
        await supabase.from('agent_tools').insert(toolLinks);
      }

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

  const openEditModal = async (agent: Partial<Agent>, instanceName = '') => {
    const pacifData = agent.prompt 
      ? parsePromptToPacif(agent.prompt) 
      : { papel: '', contexto: '', regras: '', acao: '', intencao: '', formato: '' };

    let currentTools: string[] = [];
    if (agent.id) {
      const { data } = await supabase.from('agent_tools').select('tool_id').eq('agent_id', agent.id);
      currentTools = data?.map(t => t.tool_id) || [];
    }

    setSelectedTools(currentTools);
    
    // CORREÇÃO AQUI: Mapear o que vem do banco (is_multi_agent) para o estado
    setEditingAgent({
      ...agent,
      targetInstance: instanceName || '',
      // Tenta ler das duas formas para garantir compatibilidade
      is_multi_agent: (agent as any).is_multi_agent ?? (agent as any).isMultiAgent ?? false,
      parent_agent_id: (agent as any).parent_agent_id ?? (agent as any).parentAgentId ?? null,
      enable_audio: (agent as any).enable_audio ?? (agent as any).enableAudio ?? false,
      enable_image: (agent as any).enable_image ?? (agent as any).enableImage ?? false,
      pacif: pacifData
    });
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
        pacif: {
          papel: template.papel || '',
          contexto: template.contexto || '',
          regras: template.regras || '',
          acao: template.acao || '',
          intencao: template.intencao || '',
          formato: template.formato || ''
        }
      });
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto w-full overflow-y-auto h-full custom-scrollbar bg-slate-50/30">
      <header className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Agent IA</h1>
          <p className="text-slate-500 mt-1">Gerencie as personalidades da sua operação.</p>
        </div>
        <button
          onClick={() => openEditModal({ name: '', prompt: '', temperature: 0.7 })}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="2" strokeLinecap="round" /></svg>
          Novo Agente
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {agents.map((agent) => {
          // CORREÇÃO AQUI: Ler o campo is_multi_agent do banco
          const isMulti = (agent as any).is_multi_agent || (agent as any).isMultiAgent;
          const isChild = !!((agent as any).parent_agent_id || (agent as any).parentAgentId);
          const linkedInstance = instances.find(i => i.agent_id === agent.id);
          
          return (
            <div key={agent.id} className={`bg-white border ${isMulti ? 'border-indigo-200 ring-4 ring-indigo-50' : 'border-slate-200'} rounded-[2.5rem] p-8 shadow-sm hover:shadow-xl transition-all flex flex-col group relative overflow-hidden`}>
              <div className="flex justify-between items-start mb-6">
                <div className={`p-4 ${isMulti ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"} rounded-2xl`}>
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {isMulti ? <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" strokeWidth="2"/> : <path d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18" strokeWidth="2"/>}
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
                <button onClick={() => openEditModal(agent, linkedInstance?.name)} className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-slate-800 transition-colors shadow-md">Configurar</button>
                <button onClick={() => handleDelete(agent.id)} className="p-4 bg-rose-50 text-rose-500 rounded-2xl hover:bg-rose-100 transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth="2"/></svg></button>
              </div>
            </div>
          );
        })}
      </div>

      {editingAgent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-6xl max-h-[95vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in duration-200">
            
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
               <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" strokeWidth="2" /></svg>
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{editingAgent.id ? 'Ajustar Inteligência' : 'Novo Agente'}</h2>
               </div>
               <button onClick={() => setEditingAgent(null)} className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm border border-slate-200">
                  <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2"/></svg>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 sm:p-10 custom-scrollbar">
              <div className="flex flex-col md:flex-row gap-6 mb-10">
                <div className="flex-1 p-6 bg-indigo-50/50 rounded-[2rem] border border-indigo-100">
                  <label className="flex items-center gap-4 cursor-pointer mb-4">
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={!!editingAgent.is_multi_agent} onChange={e => setEditingAgent({...editingAgent, is_multi_agent: e.target.checked})} className="sr-only peer" />
                      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </div>
                    <span className="text-xs font-black text-indigo-800 uppercase tracking-widest">Router Principal (Escuta WhatsApp)</span>
                  </label>
                  
                  {editingAgent.is_multi_agent ? (
                    <select value={editingAgent.targetInstance} onChange={e => setEditingAgent({...editingAgent, targetInstance: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-white border border-indigo-200 outline-none text-sm font-bold">
                      <option value="">Vincular a uma instância...</option>
                      {instances.map(inst => <option key={inst.id} value={inst.name}>{inst.name}</option>)}
                    </select>
                  ) : (
                    <select value={editingAgent.parent_agent_id || ''} onChange={e => setEditingAgent({...editingAgent, parent_agent_id: e.target.value || null})} className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 outline-none text-sm font-medium">
                      <option value="">Sem Agente Pai (Independente)</option>
                      {agents.filter(a => ((a as any).is_multi_agent || (a as any).isMultiAgent) && a.id !== editingAgent.id).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  )}
                </div>

                <div className="flex-1 p-6 bg-slate-50 rounded-[2rem] border border-slate-200">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 tracking-[0.2em]">Templates</label>
                  <select onChange={(e) => handleApplyTemplate(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 outline-none text-sm font-bold" defaultValue="">
                    <option value="" disabled>Carregar modelo...</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>

              <form onSubmit={handleSave} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1">Nome do Agente</label>
                    <input required value={editingAgent.name} onChange={e => setEditingAgent({...editingAgent, name: e.target.value})} className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 font-bold text-lg" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1">Criatividade ({editingAgent.temperature})</label>
                    <input type="range" min="0" max="1" step="0.1" value={editingAgent.temperature || 0} onChange={e => setEditingAgent({...editingAgent, temperature: parseFloat(e.target.value)})} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 mt-5" />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">PACRIF (Prompts)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-6">
                      <div className="p-6 bg-indigo-50/20 rounded-[2.5rem] border border-indigo-100/50">
                        <label className="block text-xs font-black text-indigo-600 uppercase mb-3">P — Papel</label>
                        <textarea required rows={3} value={editingAgent.pacif?.papel} onChange={e => setEditingAgent({...editingAgent, pacif: {...editingAgent.pacif!, papel: e.target.value}})} className="w-full bg-transparent text-sm outline-none resize-none" />
                      </div>
                      <div className="p-6 bg-emerald-50/20 rounded-[2.5rem] border border-emerald-100/50">
                        <label className="block text-xs font-black text-emerald-600 uppercase mb-3">C — Contexto</label>
                        <textarea required rows={4} value={editingAgent.pacif?.contexto} onChange={e => setEditingAgent({...editingAgent, pacif: {...editingAgent.pacif!, contexto: e.target.value}})} className="w-full bg-transparent text-sm outline-none resize-none" />
                      </div>
                      <div className="p-6 bg-violet-50/20 rounded-[2.5rem] border border-violet-100/50">
                        <label className="block text-xs font-black text-violet-600 uppercase mb-3">R — Regras</label>
                        <textarea required rows={4} value={editingAgent.pacif?.regras} onChange={e => setEditingAgent({...editingAgent, pacif: {...editingAgent.pacif!, regras: e.target.value}})} className="w-full bg-transparent text-sm outline-none resize-none" />
                      </div>
                    </div>
                    <div className="space-y-6">
                      <div className="p-6 bg-sky-50/20 rounded-[2.5rem] border border-sky-100/50">
                        <label className="block text-xs font-black text-sky-600 uppercase mb-3">A — Ação</label>
                        <textarea required rows={6} value={editingAgent.pacif?.acao} onChange={e => setEditingAgent({...editingAgent, pacif: {...editingAgent.pacif!, acao: e.target.value}})} className="w-full bg-transparent text-sm outline-none resize-none" />
                      </div>
                      <div className="p-6 bg-amber-50/20 rounded-[2.5rem] border border-amber-100/50">
                        <label className="block text-xs font-black text-amber-600 uppercase mb-3">I — Intenção</label>
                        <textarea required rows={3} value={editingAgent.pacif?.intencao} onChange={e => setEditingAgent({...editingAgent, pacif: {...editingAgent.pacif!, intencao: e.target.value}})} className="w-full bg-transparent text-sm outline-none resize-none" />
                      </div>
                      <div className="p-6 bg-rose-50/20 rounded-[2.5rem] border border-rose-100/50">
                        <label className="block text-xs font-black text-rose-600 uppercase mb-3">F — Formato</label>
                        <textarea required rows={3} value={editingAgent.pacif?.formato} onChange={e => setEditingAgent({...editingAgent, pacif: {...editingAgent.pacif!, formato: e.target.value}})} className="w-full bg-transparent text-sm outline-none resize-none" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-8 bg-slate-900 rounded-[3rem] shadow-xl">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400 border border-indigo-500/30">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" strokeWidth="3" /></svg>
                    </div>
                    <label className="block text-xs font-black text-white uppercase tracking-[0.3em]">Habilidades Ativas</label>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {availableTools.map(tool => (
                      <label key={tool.id} className={`flex items-start gap-4 p-5 rounded-[1.8rem] cursor-pointer border transition-all duration-300 ${selectedTools.includes(tool.id) ? 'bg-indigo-600 border-indigo-400 ring-4 ring-indigo-500/10' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}>
                        <input type="checkbox" checked={selectedTools.includes(tool.id)} onChange={(e) => {
                          if(e.target.checked) setSelectedTools([...selectedTools, tool.id]);
                          else setSelectedTools(selectedTools.filter(id => id !== tool.id));
                        }} className="w-6 h-6 text-indigo-500 rounded-lg bg-slate-700 border-none mt-1" />
                        <div>
                          <p className={`text-sm font-black uppercase tracking-tighter ${selectedTools.includes(tool.id) ? 'text-white' : 'text-slate-200'}`}>{tool.name.replace(/_/g, ' ')}</p>
                          <p className={`text-[10px] mt-1 leading-relaxed ${selectedTools.includes(tool.id) ? 'text-indigo-100' : 'text-slate-400'}`}>{tool.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {editingAgent.is_multi_agent && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-8 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
                    <label className="flex items-center gap-4 cursor-pointer group p-4 bg-white rounded-2xl shadow-sm border border-slate-100 hover:border-indigo-300 transition-all">
                      <input type="checkbox" checked={editingAgent.enable_audio || (editingAgent as any).enableAudio} onChange={e => setEditingAgent({...editingAgent, enable_audio: e.target.checked})} className="w-6 h-6 rounded-lg border-slate-300 text-indigo-600" />
                      <div><p className="text-sm font-black text-slate-700 uppercase">Áudio</p></div>
                    </label>
                    <label className="flex items-center gap-4 cursor-pointer group p-4 bg-white rounded-2xl shadow-sm border border-slate-100 hover:border-indigo-300 transition-all">
                      <input type="checkbox" checked={editingAgent.enable_image || (editingAgent as any).enableImage} onChange={e => setEditingAgent({...editingAgent, enable_image: e.target.checked})} className="w-6 h-6 rounded-lg border-slate-300 text-indigo-600" />
                      <div><p className="text-sm font-black text-slate-700 uppercase">Visão</p></div>
                    </label>
                  </div>
                )}

                <div className="flex gap-4 pt-6 sticky bottom-0 bg-white pb-2">
                  <button type="button" onClick={() => setEditingAgent(null)} className="flex-1 py-5 font-black text-slate-400 uppercase tracking-widest text-xs">Descartar</button>
                  <button type="submit" className="flex-[2] bg-indigo-600 text-white py-5 rounded-[1.8rem] font-black uppercase tracking-widest shadow-xl hover:bg-indigo-700 active:scale-95 transition-all">Salvar Agente</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentsPage;