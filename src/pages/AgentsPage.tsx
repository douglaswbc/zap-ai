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
    const [templates, setTemplates] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAgent, setEditingAgent] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Estado das Abas PACRIF dentro do modal
    const [pacrifTab, setPacrifTab] = useState<'P' | 'A' | 'C' | 'R' | 'I' | 'F' | 'K'>('P');

    const loadData = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const [agentsData, templatesData] = await Promise.all([
                api.agents.list(user),
                api.templates.listAll(user)
            ]);
            setAgents(agentsData);
            setTemplates(templatesData);
        } catch (error: any) {
            showToast('Erro ao carregar dados', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [user]);

    const handleOpenCreate = () => {
        setEditingAgent({
            name: '',
            prompt: '',
            papel: '',
            acao: '',
            contexto: '',
            regras: '',
            intencao: '',
            formato: '',
            knowledge_base: '',
            temperature: 0.7,
            presence_penalty: 0.6,
            enable_audio: false,
            enable_image: false,
            is_multi_agent: false,
            parent_agent_id: null
        });
        setPacrifTab('P');
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        // Constrói o prompt final a partir do PACRIF se algum campo estiver preenchido
        let finalPrompt = editingAgent.prompt;
        if (editingAgent.papel || editingAgent.acao || editingAgent.contexto || editingAgent.knowledge_base) {
            finalPrompt = `
PAPEL:
${editingAgent.papel || ''}

AÇÃO:
${editingAgent.acao || ''}

CONTEXTO:
${editingAgent.contexto || ''}

REGRAS:
${editingAgent.regras || ''}

INTENÇÃO:
${editingAgent.intencao || ''}

FORMATO:
${editingAgent.formato || ''}

BASE DE CONHECIMENTO:
${editingAgent.knowledge_base || ''}
`.trim();
        }

        const agentToSave = {
            ...editingAgent,
            prompt: finalPrompt || editingAgent.prompt
        };

        try {
            await api.agents.upsert(agentToSave, user);
            showToast('Agente salvo com sucesso', 'success');
            setIsModalOpen(false);
            loadData();
        } catch (error: any) {
            showToast(error.message || 'Erro ao salvar agente', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Deseja realmente excluir este agente?')) return;
        try {
            await api.agents.delete(id);
            showToast('Agente excluído com sucesso', 'success');
            loadData();
        } catch (error: any) {
            showToast('Erro ao excluir agente', 'error');
        }
    };

    const handleApplyTemplate = (template: any) => {
        if (!confirm(`Deseja aplicar o template "${template.name}"? Isso substituirá os campos PACRIF atuais.`)) return;

        setEditingAgent({
            ...editingAgent,
            papel: template.papel || '',
            acao: template.acao || '',
            contexto: template.contexto || '',
            regras: template.regras || '',
            intencao: template.intencao || '',
            formato: template.formato || ''
        });
        showToast('Template aplicado com sucesso!', 'success');
    };

    const filteredAgents = agents.filter(a =>
        (a.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.prompt || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-8 max-w-7xl mx-auto w-full h-full overflow-y-auto custom-scrollbar bg-slate-50/30">
            {/* Header seguindo Padrão Premium */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Meus Agentes</h1>
                    <p className="text-slate-500 mt-1">Gerencie a personalidade e o conhecimento da sua IA usando PACRIF.</p>
                </div>

                <div className="flex gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <svg className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Pesquisar agentes..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500 transition-all font-medium"
                        />
                    </div>
                    <button
                        onClick={handleOpenCreate}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-indigo-100 transition-all flex items-center gap-2 active:scale-95 shrink-0"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Novo Agente
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20">
                    <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredAgents.length === 0 && (
                        <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100 flex flex-col items-center">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <p className="text-slate-400 font-bold text-lg">Nenhum agente encontrado.</p>
                            <p className="text-slate-400 text-sm">Clique em "Novo Agente" para começar.</p>
                        </div>
                    )}
                    {filteredAgents.map((agent) => (
                        <div key={agent.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col group relative overflow-hidden">
                            <div className="flex justify-between items-start mb-6">
                                <div className="w-14 h-14 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black shadow-inner">
                                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => {
                                            setEditingAgent(agent);
                                            setPacrifTab('P');
                                            setIsModalOpen(true);
                                        }}
                                        className="p-3 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-2xl transition-all hover:bg-white hover:shadow-sm"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => handleDelete(agent.id)}
                                        className="p-3 bg-slate-50 text-slate-400 hover:text-rose-600 rounded-2xl transition-all hover:bg-white hover:shadow-sm"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <h3 className="text-xl font-bold text-slate-900 mb-2">{agent.name}</h3>
                            <p className="text-xs text-slate-400 line-clamp-2 mb-6 h-8">{agent.prompt}</p>

                            <div className="flex flex-wrap gap-2 mb-8">
                                <span className="text-[9px] font-black text-indigo-500 uppercase bg-indigo-50 px-3 py-1 rounded-lg tracking-widest">
                                    {agent.enable_audio ? '🔊 Áudio' : '🔇 Silencioso'}
                                </span>
                                <span className="text-[9px] font-black text-emerald-500 uppercase bg-emerald-50 px-3 py-1 rounded-lg tracking-widest">
                                    {agent.enable_image ? '🖼️ Visão' : '📄 Apenas Texto'}
                                </span>
                                {agent.is_multi_agent && (
                                    <span className="text-[9px] font-black text-amber-500 uppercase bg-amber-50 px-3 py-1 rounded-lg tracking-widest">
                                        👥 Multi-Agente
                                    </span>
                                )}
                            </div>

                            <button
                                onClick={() => {
                                    setEditingAgent(agent);
                                    setPacrifTab('P');
                                    setIsModalOpen(true);
                                }}
                                className="w-full py-4 rounded-2xl bg-slate-50 text-xs font-black text-slate-600 hover:bg-slate-900 hover:text-white transition-all shadow-sm flex items-center justify-center gap-2"
                            >
                                Configurar Agente
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-6">
                    <div className="bg-white w-full max-w-5xl rounded-[3rem] shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar animate-in fade-in zoom-in duration-300">
                        <form onSubmit={handleSave} className="p-12">
                            <div className="flex justify-between items-center mb-10">
                                <h3 className="text-3xl font-black text-slate-900 tracking-tight">{editingAgent?.id ? 'Editar' : 'Novo'} Agente</h3>
                                <button type="button" onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                                    <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                                <div className="lg:col-span-2 space-y-8">
                                    {/* Nome do Agente */}
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1 tracking-widest">Nome Identificador</label>
                                        <input
                                            required
                                            value={editingAgent.name}
                                            onChange={e => setEditingAgent({ ...editingAgent, name: e.target.value })}
                                            className="w-full px-6 py-5 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 font-bold transition-all"
                                            placeholder="Ex: Consultor de Vendas VIP"
                                        />
                                    </div>

                                    {/* Configuração de PACRIF */}
                                    <div className="space-y-6">
                                        <div className="flex flex-col gap-6">
                                            {/* Dropdown de Templates - Agora acima das abas */}
                                            <div className="relative group w-fit">
                                                <button type="button" className="px-6 py-4 bg-emerald-50 text-emerald-600 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-100 transition-all border border-emerald-100 shadow-sm">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                                    Aplicar Template de Escrita
                                                </button>
                                                <div className="absolute left-0 top-full mt-2 w-72 bg-white rounded-3xl shadow-2xl border border-slate-100 p-2 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                                                    <div className="max-h-64 overflow-y-auto custom-scrollbar">
                                                        {templates.length === 0 ? (
                                                            <div className="p-4 text-center text-xs text-slate-400">Nenhum template disponível</div>
                                                        ) : (
                                                            templates.map(t => (
                                                                <button
                                                                    key={t.id}
                                                                    type="button"
                                                                    onClick={() => handleApplyTemplate(t)}
                                                                    className="w-full text-left px-4 py-3 rounded-2xl hover:bg-slate-50 transition-all group/item"
                                                                >
                                                                    <div className="font-bold text-slate-700 text-xs">{t.name}</div>
                                                                    <div className="text-[10px] text-slate-400 truncate">{t.papel?.substring(0, 40)}...</div>
                                                                </button>
                                                            ))
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Barra de Abas PACRIF - Ajustada para não ter scroll */}
                                            <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full gap-1.5">
                                                {[
                                                    { id: 'P', label: 'P', full: 'Papel', color: 'text-indigo-600', bg: 'bg-indigo-50' },
                                                    { id: 'A', label: 'A', full: 'Ação', color: 'text-sky-600', bg: 'bg-sky-50' },
                                                    { id: 'C', label: 'C', full: 'Contexto', color: 'text-emerald-600', bg: 'bg-emerald-50' },
                                                    { id: 'R', label: 'R', full: 'Regras', color: 'text-rose-600', bg: 'bg-rose-50' },
                                                    { id: 'I', label: 'I', full: 'Intenção', color: 'text-amber-600', bg: 'bg-amber-50' },
                                                    { id: 'F', label: 'F', full: 'Formato', color: 'text-slate-600', bg: 'bg-slate-50' },
                                                    { id: 'K', label: 'K', full: 'Conhecimento', color: 'text-violet-600', bg: 'bg-violet-50' }
                                                ].map(tab => (
                                                    <button
                                                        key={tab.id}
                                                        type="button"
                                                        onClick={() => setPacrifTab(tab.id as any)}
                                                        className={`flex-1 py-3 px-1 rounded-xl font-black uppercase text-[10px] tracking-tight md:tracking-widest transition-all ${pacrifTab === tab.id ? `bg-white ${tab.color} shadow-sm border border-slate-200` : 'text-slate-400 hover:text-slate-600'}`}
                                                    >
                                                        {tab.id}<span className="hidden xl:inline"> — {tab.full}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="min-h-[350px] animate-in fade-in duration-300">
                                            {pacrifTab === 'P' && (
                                                <div className="space-y-4">
                                                    <label className="block text-[11px] font-black text-indigo-600 uppercase bg-indigo-50 px-4 py-2 rounded-xl w-fit tracking-widest">P — Papel (Persona)</label>
                                                    <textarea rows={12} required value={editingAgent.papel || ''} onChange={e => setEditingAgent({ ...editingAgent, papel: e.target.value })} className="w-full px-6 py-5 rounded-3xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 text-base font-medium resize-none shadow-inner" placeholder="Quem a IA deve ser? Ex: Você é um atendente especializado..." />
                                                </div>
                                            )}
                                            {/* ... repete para as outras abas PACRIF */}
                                            {pacrifTab === 'A' && (
                                                <div className="space-y-4">
                                                    <label className="block text-[11px] font-black text-sky-600 uppercase bg-sky-50 px-4 py-2 rounded-xl w-fit tracking-widest">A — Ação (Workflow)</label>
                                                    <textarea rows={12} required value={editingAgent.acao || ''} onChange={e => setEditingAgent({ ...editingAgent, acao: e.target.value })} className="w-full px-6 py-5 rounded-3xl bg-slate-50 border border-slate-100 outline-none focus:border-sky-500 text-base font-medium resize-none shadow-inner" placeholder="O que a IA deve fazer passo a passo..." />
                                                </div>
                                            )}
                                            {pacrifTab === 'C' && (
                                                <div className="space-y-4">
                                                    <label className="block text-[11px] font-black text-emerald-600 uppercase bg-emerald-50 px-4 py-2 rounded-xl w-fit tracking-widest">C — Contexto</label>
                                                    <textarea rows={12} required value={editingAgent.contexto || ''} onChange={e => setEditingAgent({ ...editingAgent, contexto: e.target.value })} className="w-full px-6 py-5 rounded-3xl bg-slate-50 border border-slate-100 outline-none focus:border-emerald-500 text-base font-medium resize-none shadow-inner" placeholder="Informações chave sobre a empresa e cenário..." />
                                                </div>
                                            )}
                                            {pacrifTab === 'R' && (
                                                <div className="space-y-4">
                                                    <label className="block text-[11px] font-black text-rose-600 uppercase bg-rose-50 px-4 py-2 rounded-xl w-fit tracking-widest">R — Regras (Limites)</label>
                                                    <textarea rows={12} required value={editingAgent.regras || ''} onChange={e => setEditingAgent({ ...editingAgent, regras: e.target.value })} className="w-full px-6 py-5 rounded-3xl bg-slate-50 border border-slate-100 outline-none focus:border-rose-500 text-base font-medium resize-none shadow-inner" placeholder="O que a IA NÃO pode fazer ou dizer..." />
                                                </div>
                                            )}
                                            {pacrifTab === 'I' && (
                                                <div className="space-y-4">
                                                    <label className="block text-[11px] font-black text-amber-600 uppercase bg-amber-50 px-4 py-2 rounded-xl w-fit tracking-widest">I — Intenção</label>
                                                    <textarea rows={12} required value={editingAgent.intencao || ''} onChange={e => setEditingAgent({ ...editingAgent, intencao: e.target.value })} className="w-full px-6 py-5 rounded-3xl bg-slate-50 border border-slate-100 outline-none focus:border-amber-500 text-base font-medium resize-none shadow-inner" placeholder="Qual o objetivo principal desta IA?..." />
                                                </div>
                                            )}
                                            {pacrifTab === 'F' && (
                                                <div className="space-y-4">
                                                    <label className="block text-[11px] font-black text-slate-600 uppercase bg-slate-100 px-4 py-2 rounded-xl w-fit tracking-widest">F — Formato (Saída)</label>
                                                    <textarea rows={12} required value={editingAgent.formato || ''} onChange={e => setEditingAgent({ ...editingAgent, formato: e.target.value })} className="w-full px-6 py-5 rounded-3xl bg-slate-50 border border-slate-100 outline-none focus:border-slate-500 text-base font-medium resize-none shadow-inner" placeholder="Tom de voz, uso de emojis, JSON, listas..." />
                                                </div>
                                            )}
                                            {pacrifTab === 'K' && (
                                                <div className="space-y-4">
                                                    <label className="block text-[11px] font-black text-violet-600 uppercase bg-violet-50 px-4 py-2 rounded-xl w-fit tracking-widest">K — Base de Conhecimento (RAG)</label>
                                                    <textarea rows={12} value={editingAgent.knowledge_base || ''} onChange={e => setEditingAgent({ ...editingAgent, knowledge_base: e.target.value })} className="w-full px-6 py-5 rounded-3xl bg-slate-50 border border-slate-100 outline-none focus:border-violet-500 text-base font-medium resize-none shadow-inner" placeholder="Links, PDFs ou informações cruciais para consulta da IA..." />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-8">
                                    {/* Configurações Avançadas */}
                                    <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 space-y-6">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Configurações Técnicas</h4>

                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                                <span className="text-xs font-bold text-slate-700">🔊 Comandos de Voz</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingAgent({ ...editingAgent, enable_audio: !editingAgent.enable_audio })}
                                                    className={`w-12 h-6 rounded-full transition-colors relative ${editingAgent.enable_audio ? 'bg-indigo-600' : 'bg-slate-300'}`}
                                                >
                                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${editingAgent.enable_audio ? 'left-7' : 'left-1'}`}></div>
                                                </button>
                                            </div>

                                            <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                                <span className="text-xs font-bold text-slate-700">🖼️ Análise de Imagens</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingAgent({ ...editingAgent, enable_image: !editingAgent.enable_image })}
                                                    className={`w-12 h-6 rounded-full transition-colors relative ${editingAgent.enable_image ? 'bg-indigo-600' : 'bg-slate-300'}`}
                                                >
                                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${editingAgent.enable_image ? 'left-7' : 'left-1'}`}></div>
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-4 pt-4">
                                            <div>
                                                <div className="flex justify-between mb-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Criatividade (Temp.)</label>
                                                    <span className="text-xs font-bold text-indigo-600">{editingAgent.temperature}</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="1"
                                                    step="0.1"
                                                    value={editingAgent.temperature}
                                                    onChange={e => setEditingAgent({ ...editingAgent, temperature: parseFloat(e.target.value) })}
                                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                                />
                                            </div>
                                            <div>
                                                <div className="flex justify-between mb-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Variedade de Vocab.</label>
                                                    <span className="text-xs font-bold text-indigo-600">{editingAgent.presence_penalty}</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="1"
                                                    step="0.1"
                                                    value={editingAgent.presence_penalty}
                                                    onChange={e => setEditingAgent({ ...editingAgent, presence_penalty: parseFloat(e.target.value) })}
                                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Hierarquia de Agentes */}
                                    <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 space-y-6">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Hierarquia e Função</h4>
                                        <div className="space-y-4">
                                            <div className="flex p-1 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingAgent({ ...editingAgent, is_multi_agent: false, parent_agent_id: null })}
                                                    className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${!editingAgent.is_multi_agent ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                                                >
                                                    Agente Principal
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingAgent({ ...editingAgent, is_multi_agent: true })}
                                                    className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${editingAgent.is_multi_agent ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                                                >
                                                    Agente Secundário
                                                </button>
                                            </div>

                                            {editingAgent.is_multi_agent && (
                                                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Vincular ao Agente Principal</label>
                                                    <select
                                                        value={editingAgent.parent_agent_id || ''}
                                                        onChange={e => setEditingAgent({ ...editingAgent, parent_agent_id: e.target.value || null })}
                                                        className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-sm font-bold outline-none focus:border-indigo-500 transition-all"
                                                    >
                                                        <option value="">Selecionar Agente...</option>
                                                        {agents
                                                            .filter(a => !a.is_multi_agent && a.id !== editingAgent.id)
                                                            .map(a => (
                                                                <option key={a.id} value={a.id}>{a.name}</option>
                                                            ))
                                                        }
                                                    </select>
                                                    <p className="text-[9px] text-slate-400 px-1 leading-relaxed">Agentes secundários são chamados pelo agente principal para tarefas específicas.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-amber-50 p-6 rounded-[2.5rem] border border-amber-100">
                                        <div className="flex gap-4">
                                            <div className="w-10 h-10 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 shrink-0">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-xs text-amber-900 font-bold uppercase tracking-wider">Dica Master</p>
                                                <p className="text-[11px] text-amber-800 leading-relaxed font-medium">Use o PACRIF para estruturar comportamentos complexos. A base de conhecimento (RAG) serve para dados técnicos e fatos do seu negócio.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col md:flex-row gap-4 mt-12 pt-10 border-t border-slate-50">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-5 font-black uppercase text-[10px] tracking-[0.2em] text-slate-400 hover:text-slate-900 transition-colors">Voltar sem Salvar</button>
                                <button type="submit" className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white py-5 rounded-[2rem] font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl shadow-indigo-200 active:scale-95 transition-all">Finalizar e Salvar Agente</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AgentsPage;
