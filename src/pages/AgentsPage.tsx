import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { ToastType } from '@/components/Toast';

interface AgentsPageProps {
    showToast: (msg: string, type: ToastType) => void;
}

const AgentsPage: React.FC<AgentsPageProps> = ({ showToast }) => {
    const { user } = useAuth();
    const [agents, setAgents] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAgent, setEditingAgent] = useState<any>(null);

    const loadAgents = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const data = await api.agents.list(user);
            setAgents(data);
        } catch (error: any) {
            showToast('Erro ao carregar agentes', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadAgents();
    }, [user]);

    const handleOpenCreate = () => {
        setEditingAgent({
            name: '',
            prompt: '',
            knowledge_base: '',
            temperature: 0.7,
            presence_penalty: 0.6,
            enable_audio: false,
            enable_image: false,
            is_multi_agent: false,
            parent_agent_id: null
        });
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        try {
            await api.agents.upsert(editingAgent, user);
            showToast('Agente salvo com sucesso', 'success');
            setIsModalOpen(false);
            loadAgents();
        } catch (error: any) {
            showToast(error.message || 'Erro ao salvar agente', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Deseja realmente excluir este agente?')) return;
        try {
            await api.agents.delete(id);
            showToast('Agente excluído com sucesso', 'success');
            loadAgents();
        } catch (error: any) {
            showToast('Erro ao excluir agente', 'error');
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto w-full h-full overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-10">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Meus Agentes</h1>
                    <p className="text-slate-500 mt-1">Gerencie a personalidade e o conhecimento da sua IA</p>
                </div>
                <button
                    onClick={handleOpenCreate}
                    className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Novo Agente
                </button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20">
                    <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {agents.length === 0 && (
                        <div className="col-span-full py-20 text-center bg-white rounded-[2.5rem] border border-dashed border-slate-200">
                            <p className="text-slate-400 font-medium">Nenhum agente encontrado.</p>
                        </div>
                    )}
                    {agents.map((agent) => (
                        <div key={agent.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col">
                            <div className="flex justify-between mb-4">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => { setEditingAgent(agent); setIsModalOpen(true); }}
                                        className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => handleDelete(agent.id)}
                                        className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            <h3 className="font-bold text-slate-900 text-lg mb-1">{agent.name}</h3>
                            <p className="text-sm text-slate-400 line-clamp-3 mb-4">{agent.prompt}</p>
                            <div className="mt-auto flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                <span className="flex items-center gap-1">
                                    <div className={`w-2 h-2 rounded-full ${agent.enable_audio ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                    Áudio
                                </span>
                                <span className="flex items-center gap-1">
                                    <div className={`w-2 h-2 rounded-full ${agent.enable_image ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                    Imagem
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar animate-in zoom-in duration-200">
                        <form onSubmit={handleSave} className="p-10">
                            <h3 className="text-2xl font-bold text-slate-900 mb-8">{editingAgent?.id ? 'Editar' : 'Novo'} Agente</h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-widest">Nome do Agente</label>
                                        <input
                                            required
                                            value={editingAgent.name}
                                            onChange={e => setEditingAgent({ ...editingAgent, name: e.target.value })}
                                            className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 font-medium"
                                            placeholder="Ex: Assistente de Vendas"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-widest">Prompt (Personalidade)</label>
                                        <textarea
                                            required
                                            rows={6}
                                            value={editingAgent.prompt}
                                            onChange={e => setEditingAgent({ ...editingAgent, prompt: e.target.value })}
                                            className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 font-medium resize-none"
                                            placeholder="Descreva como o agente deve se comportar..."
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-widest">Base de Conhecimento</label>
                                        <textarea
                                            rows={6}
                                            value={editingAgent.knowledge_base}
                                            onChange={e => setEditingAgent({ ...editingAgent, knowledge_base: e.target.value })}
                                            className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 font-medium resize-none"
                                            placeholder="Insira informações extras sobre sua empresa, produtos ou serviços..."
                                        />
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-widest">Temperatura ({editingAgent.temperature})</label>
                                            <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.1"
                                                value={editingAgent.temperature}
                                                onChange={e => setEditingAgent({ ...editingAgent, temperature: parseFloat(e.target.value) })}
                                                className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-widest">Presence Penalty ({editingAgent.presence_penalty})</label>
                                            <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.1"
                                                value={editingAgent.presence_penalty}
                                                onChange={e => setEditingAgent({ ...editingAgent, presence_penalty: parseFloat(e.target.value) })}
                                                className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                            />
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-widest">Recursos e Habilidades</label>

                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-slate-700">Habilitar Voz (Áudio)</span>
                                            <button
                                                type="button"
                                                onClick={() => setEditingAgent({ ...editingAgent, enable_audio: !editingAgent.enable_audio })}
                                                className={`w-12 h-6 rounded-full transition-colors relative ${editingAgent.enable_audio ? 'bg-indigo-600' : 'bg-slate-300'}`}
                                            >
                                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${editingAgent.enable_audio ? 'left-7' : 'left-1'}`}></div>
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-slate-700">Análise de Imagens/PDF</span>
                                            <button
                                                type="button"
                                                onClick={() => setEditingAgent({ ...editingAgent, enable_image: !editingAgent.enable_image })}
                                                className={`w-12 h-6 rounded-full transition-colors relative ${editingAgent.enable_image ? 'bg-indigo-600' : 'bg-slate-300'}`}
                                            >
                                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${editingAgent.enable_image ? 'left-7' : 'left-1'}`}></div>
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-between border-t border-slate-200 pt-4 mt-4">
                                            <span className="text-sm font-medium text-slate-700">Multi-Agente (Hierarquia)</span>
                                            <button
                                                type="button"
                                                onClick={() => setEditingAgent({ ...editingAgent, is_multi_agent: !editingAgent.is_multi_agent })}
                                                className={`w-12 h-6 rounded-full transition-colors relative ${editingAgent.is_multi_agent ? 'bg-indigo-600' : 'bg-slate-300'}`}
                                            >
                                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${editingAgent.is_multi_agent ? 'left-7' : 'left-1'}`}></div>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100">
                                        <div className="flex gap-3">
                                            <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <p className="text-xs text-amber-700 leading-relaxed">
                                                <strong>Dica:</strong> Para melhores resultados, seja específico no prompt sobre o tom de voz e as limitações do agente. A base de conhecimento é ideal para FAQs e manuais.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4 mt-10">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-4 font-bold text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-[2] bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg active:scale-95 transition-all"
                                >
                                    Salvar Agente
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AgentsPage;
