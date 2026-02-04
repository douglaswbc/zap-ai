import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { ToastType } from '@/components/Toast';

interface InstagramManagementProps {
    showToast: (msg: string, type: ToastType) => void;
}

interface KeywordRule {
    id: string;
    keyword: string;
    reply_text: string;
    public_reply_text?: string;
    active: boolean;
    post_id?: string;
    quick_replies?: Array<{ title: string; payload: string }>;
}

const InstagramManagement: React.FC<InstagramManagementProps> = ({ showToast }) => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'feed' | 'automations' | 'leads'>('automations');
    const [isLoading, setIsLoading] = useState(true);

    // States for Automations
    const [rules, setRules] = useState<KeywordRule[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<Partial<KeywordRule>>({
        keyword: '',
        reply_text: '',
        public_reply_text: 'Acabei de te enviar uma mensagem privada! 🚀',
        active: true,
        post_id: '',
        quick_replies: []
    });

    // States for Feed
    const [posts, setPosts] = useState<any[]>([]);

    // States for Leads
    const [leads, setLeads] = useState<any[]>([]);

    useEffect(() => {
        if (user) {
            loadRules();
            loadFeed();
            loadInstagramLeads();
        }
    }, [user]);

    const loadRules = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const data = await api.automations.getRules(user.company_id || user.id);
            setRules(data || []);
        } catch (error: any) {
            showToast('Erro ao carregar regras: ' + error.message, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const loadFeed = async () => {
        if (!user) return;
        try {
            const feed = await api.instagram.getFeed(user);
            setPosts(feed);
        } catch (error: any) {
            console.error('Erro ao carregar feed:', error);
        }
    };

    const loadInstagramLeads = async () => {
        if (!user) return;
        try {
            const data = await api.instagramLeads.list(user.company_id || user.id);
            setLeads(data || []);
        } catch (error: any) {
            console.error('Erro ao carregar leads:', error);
        }
    };

    const handleSaveRule = async () => {
        if (!user || !editingRule.keyword || !editingRule.reply_text) {
            showToast('Preencha todos os campos obrigatórios.', 'error');
            return;
        }

        setIsLoading(true);
        try {
            await api.automations.saveRule({
                ...editingRule,
                company_id: user.company_id || user.id
            });

            showToast('Regra salva com sucesso!', 'success');
            setIsModalOpen(false);
            setEditingRule({
                keyword: '',
                reply_text: '',
                public_reply_text: 'Acabei de te enviar uma mensagem privada! 🚀',
                active: true,
                post_id: '',
                quick_replies: []
            });
            loadRules();
        } catch (error: any) {
            showToast('Erro ao salvar regra: ' + error.message, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteRule = async (id: string) => {
        if (!confirm('Deseja excluir esta regra?')) return;
        try {
            await api.automations.deleteRule(id);
            showToast('Regra excluída!', 'success');
            loadRules();
        } catch (error: any) {
            showToast('Erro ao excluir: ' + error.message, 'error');
        }
    };

    const handleDeletePost = async (postId: string) => {
        if (!confirm('Deseja excluir este post do Instagram?')) return;
        try {
            await api.instagram.deletePost(user!, postId);
            showToast('Post excluído!', 'success');
            loadFeed();
        } catch (error: any) {
            showToast('Erro ao excluir post.', 'error');
        }
    };

    return (
        <div className="p-8 h-full overflow-y-auto custom-scrollbar bg-slate-50/30">
            <div className="max-w-6xl mx-auto pb-20">
                <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Gestão Instagram</h1>
                        <p className="text-slate-500 mt-1 font-medium">Capture leads e automatize interações com IA e Gatilhos.</p>
                    </div>

                    <div className="flex bg-slate-200/50 p-1.5 rounded-2xl shadow-inner">
                        <button
                            onClick={() => setActiveTab('feed')}
                            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'feed' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Feed
                        </button>
                        <button
                            onClick={() => setActiveTab('automations')}
                            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'automations' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Automações
                        </button>
                        <button
                            onClick={() => setActiveTab('leads')}
                            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'leads' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Leads
                        </button>
                    </div>
                </header>

                {activeTab === 'automations' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex justify-between items-center text-sm">
                            <p className="text-slate-400 font-medium bg-white/50 border border-slate-100 px-5 py-3 rounded-2xl hidden md:block italic">
                                ✨ Dica: Regras vinculadas a posts específicos têm prioridade sobre regras gerais.
                            </p>
                            <button
                                onClick={() => {
                                    setEditingRule({
                                        keyword: '',
                                        reply_text: '',
                                        public_reply_text: 'Acabei de te enviar uma mensagem privada! 🚀',
                                        active: true,
                                        post_id: '',
                                        quick_replies: []
                                    });
                                    setIsModalOpen(true);
                                }}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-[1.5rem] font-black text-sm shadow-xl shadow-indigo-100 transition-all flex items-center gap-3 uppercase tracking-widest"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                                Nova Regra
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {rules.map(rule => (
                                <div key={rule.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="flex flex-col gap-1">
                                            <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-black uppercase tracking-widest leading-none w-fit">Gatilho AI</span>
                                            {rule.post_id && <span className="text-[8px] text-slate-400 font-black uppercase tracking-widest ml-1">Post Específico</span>}
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => { setEditingRule(rule); setIsModalOpen(true); }} className="p-3 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-indigo-600 transition-colors">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                            </button>
                                            <button onClick={() => handleDeleteRule(rule.id)} className="p-3 hover:bg-rose-50 rounded-xl text-slate-400 hover:text-rose-600 transition-colors">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-900 mb-4 tracking-tighter">"{rule.keyword}"</h3>
                                    <div className="p-5 bg-slate-50/50 rounded-2xl border border-slate-100 mb-6">
                                        <p className="text-sm text-slate-500 uppercase font-black text-[9px] mb-2 tracking-widest">Resposta DM:</p>
                                        <p className="text-sm text-slate-700 leading-relaxed font-medium italic">"{rule.reply_text}"</p>
                                    </div>
                                    <div className="flex items-center gap-3 mt-auto pt-6 border-t border-slate-50">
                                        <div className={`w-3 h-3 rounded-full ${rule.active ? 'bg-emerald-500 shadow-lg shadow-emerald-100' : 'bg-slate-300'}`} />
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{rule.active ? 'Monitorando' : 'Pausada'}</span>
                                        {rule.quick_replies && rule.quick_replies.length > 0 && (
                                            <div className="ml-auto flex -space-x-2">
                                                {rule.quick_replies.map((_, i) => (
                                                    <div key={i} className="w-5 h-5 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center">
                                                        <div className="w-1 h-1 rounded-full bg-slate-400" />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {rules.length === 0 && !isLoading && (
                                <div className="col-span-full py-24 text-center bg-white rounded-[3rem] border border-slate-100 shadow-sm">
                                    <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6 text-indigo-200">
                                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 mb-2">Sem Gatilhos Configurados</h3>
                                    <p className="text-slate-400 font-medium max-w-sm mx-auto">Crie sua primeira regra de automação para começar a capturar leads via comentários.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'feed' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {posts.map(post => (
                                <div key={post.id} className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden group relative shadow-sm hover:shadow-xl transition-all">
                                    <div className="aspect-square relative overflow-hidden">
                                        <img src={post.media_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                                        <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/60 to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                                            <button onClick={() => handleDeletePost(post.id)} className="w-full py-3 bg-white/20 hover:bg-white/40 backdrop-blur-md rounded-xl text-white font-bold text-xs uppercase tracking-widest transition-all">
                                                Excluir Post
                                            </button>
                                        </div>
                                    </div>
                                    <div className="p-6">
                                        <p className="text-sm text-slate-600 line-clamp-2 mb-4 font-medium italic">"{post.caption}"</p>
                                        <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            <span>{new Date(post.timestamp).toLocaleDateString()}</span>
                                            <span className="text-indigo-400">Instagram Feed</span>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {posts.length === 0 && (
                                <div className="col-span-full py-32 bg-white rounded-[3rem] border border-dashed border-slate-200 text-center">
                                    <p className="text-slate-400 font-bold uppercase tracking-widest px-6">Ligue o Instagram nas Configurações</p>
                                    <p className="text-sm text-slate-300 mt-2">Seu feed aparecerá aqui assim que a integração estiver ativa.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'leads' && (
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="p-10 border-b border-slate-50 flex flex-col md:flex-row justify-between items-center gap-6">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Leads Instagram</h3>
                                <p className="text-sm text-slate-400 font-medium">Usuários capturados via interações automatizadas.</p>
                            </div>
                            <button onClick={loadInstagramLeads} className="p-3 hover:bg-slate-50 rounded-2xl text-slate-400 hover:text-indigo-600 transition-all">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50/50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Usuário</th>
                                        <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Identificador</th>
                                        <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Última Interação</th>
                                        <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Registrado em</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {leads.map(lead => (
                                        <tr key={lead.id} className="hover:bg-indigo-50/10 transition-colors">
                                            <td className="px-10 py-7">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-sm uppercase shadow-lg shadow-indigo-100">
                                                        {lead.username?.substring(0, 2)}
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-slate-900 text-lg">@{lead.username}</p>
                                                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[9px] font-black uppercase tracking-widest">Instagram Lead</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-10 py-7">
                                                <span className="text-xs font-mono font-bold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg">{lead.instagram_id}</span>
                                            </td>
                                            <td className="px-10 py-7">
                                                <p className="text-sm text-slate-600 italic font-medium max-w-xs line-clamp-1">"{lead.last_comment}"</p>
                                                <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-widest">{new Date(lead.last_comment_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                            </td>
                                            <td className="px-10 py-7">
                                                <p className="text-xs font-black text-slate-900 uppercase tracking-tighter">{new Date(lead.created_at).toLocaleDateString()}</p>
                                            </td>
                                        </tr>
                                    ))}
                                    {leads.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="px-10 py-32 text-center text-slate-400 font-medium italic">
                                                Nenhum lead capturado ainda. Teste comentando em um post!
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal for Rule CRUD */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-start justify-center p-4 overflow-y-auto pt-20">
                    <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 my-auto border border-white/20">
                        <div className="p-10 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Configurar Automação</h3>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Gatilho de palavras-chave e botões</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-4 hover:bg-white rounded-2xl transition-all shadow-sm border border-slate-100 text-slate-400 hover:text-slate-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="p-10 space-y-10 max-h-[70vh] overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="col-span-full">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1 tracking-widest">Palavra-Chave Gatilho</label>
                                    <input
                                        type="text"
                                        value={editingRule.keyword}
                                        onChange={e => setEditingRule({ ...editingRule, keyword: e.target.value })}
                                        className="w-full px-8 py-6 rounded-[2rem] bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 font-black text-xl shadow-inner placeholder:font-bold placeholder:text-slate-300"
                                        placeholder="Ex: QUERO"
                                    />
                                    <p className="text-[9px] text-slate-400 mt-3 ml-2 font-medium">✨ Dica: Use palavras simples. O sistema ignora maiúsculas/minúsculas automaticamente.</p>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1 tracking-widest">Resposta Pública (Comentário)</label>
                                    <input
                                        type="text"
                                        value={editingRule.public_reply_text}
                                        onChange={e => setEditingRule({ ...editingRule, public_reply_text: e.target.value })}
                                        className="w-full px-6 py-5 rounded-[1.5rem] bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 font-bold text-sm shadow-inner"
                                        placeholder="Olha seu direct! 🚀"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1 tracking-widest">Vincular a Post (Opcional)</label>
                                    <select
                                        value={editingRule.post_id || ''}
                                        onChange={e => setEditingRule({ ...editingRule, post_id: e.target.value || undefined })}
                                        className="w-full px-6 py-5 rounded-[1.5rem] bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 font-black text-sm appearance-none cursor-pointer shadow-inner"
                                    >
                                        <option value="">🌎 Global (Todos os Posts)</option>
                                        {posts.map(post => (
                                            <option key={post.id} value={post.id}>
                                                Post: {post.caption?.substring(0, 30)}...
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1 tracking-widest">Resposta Privada (Direct Message)</label>
                                <textarea
                                    rows={4}
                                    value={editingRule.reply_text}
                                    onChange={e => setEditingRule({ ...editingRule, reply_text: e.target.value })}
                                    className="w-full px-8 py-6 rounded-[2rem] bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 font-bold text-sm shadow-inner leading-relaxed"
                                    placeholder="Escreva a mensagem que o cliente receberá no privado..."
                                />
                            </div>

                            <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                                <div className="flex justify-between items-center mb-6">
                                    <div>
                                        <h4 className="font-black text-slate-900 text-sm uppercase tracking-tight">Botões Inteligentes (DMs)</h4>
                                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mt-0.5">Até 3 botões por mensagem</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            const current = editingRule.quick_replies || [];
                                            if (current.length >= 3) {
                                                showToast('Máximo de 3 botões permitidos.', 'error');
                                                return;
                                            }
                                            setEditingRule({
                                                ...editingRule,
                                                quick_replies: [...current, { title: '', payload: '' }]
                                            });
                                        }}
                                        className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-indigo-600 hover:text-indigo-700 hover:border-indigo-200 transition-all uppercase tracking-widest shadow-sm"
                                    >
                                        + Novo Botão
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {(editingRule.quick_replies || []).map((reply, idx) => (
                                        <div key={idx} className="flex gap-2 animate-in fade-in slide-in-from-right-4 duration-300">
                                            <input
                                                type="text"
                                                placeholder="Nome no Botão"
                                                value={reply.title}
                                                onChange={e => {
                                                    const newReplies = [...(editingRule.quick_replies || [])];
                                                    newReplies[idx].title = e.target.value;
                                                    setEditingRule({ ...editingRule, quick_replies: newReplies });
                                                }}
                                                className="flex-1 px-5 py-4 rounded-2xl bg-white border border-slate-100 outline-none focus:border-indigo-500 text-sm font-black shadow-sm"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Ação (Gatilho)"
                                                value={reply.payload}
                                                onChange={e => {
                                                    const newReplies = [...(editingRule.quick_replies || [])];
                                                    newReplies[idx].payload = e.target.value;
                                                    setEditingRule({ ...editingRule, quick_replies: newReplies });
                                                }}
                                                className="flex-1 px-5 py-4 rounded-2xl bg-white border border-slate-100 outline-none focus:border-indigo-500 text-[10px] font-black uppercase tracking-widest shadow-sm"
                                            />
                                            <button
                                                onClick={() => {
                                                    const newReplies = (editingRule.quick_replies || []).filter((_, i) => i !== idx);
                                                    setEditingRule({ ...editingRule, quick_replies: newReplies });
                                                }}
                                                className="p-4 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                    ))}
                                    {(editingRule.quick_replies || []).length === 0 && (
                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest text-center py-4 border-2 border-dashed border-slate-100 rounded-[1.5rem]">Sem botões configurados</p>
                                    )}
                                </div>
                                <p className="text-[8px] text-slate-400 mt-4 text-center font-bold px-4 leading-relaxed">⚠️ NOTA: Botões só aparecem em conversas de direct já iniciadas ou em respostas secundárias.</p>
                            </div>

                            <div className="flex items-center justify-between p-8 bg-slate-900 rounded-[2.5rem] text-white shadow-2xl">
                                <div>
                                    <p className="font-black text-white text-lg tracking-tight uppercase">Automação Ativa</p>
                                    <p className="text-xs text-indigo-200 mt-1 uppercase font-bold tracking-widest">O sistema responderá instantaneamente</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer scale-110">
                                    <input
                                        type="checkbox"
                                        checked={editingRule.active}
                                        onChange={e => setEditingRule({ ...editingRule, active: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-16 h-8 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[6px] after:left-[6px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 shadow-inner"></div>
                                </label>
                            </div>
                        </div>

                        <div className="p-10 bg-slate-50 border-t border-slate-100 flex justify-end gap-6 items-center">
                            <button onClick={() => setIsModalOpen(false)} className="px-8 py-4 text-slate-400 font-extrabold hover:text-slate-600 transition-colors uppercase text-xs tracking-widest">Fechar</button>
                            <button
                                onClick={handleSaveRule}
                                disabled={isLoading}
                                className="bg-slate-900 hover:bg-slate-800 text-white px-16 py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] shadow-2xl transition-all disabled:opacity-50 text-sm"
                            >
                                {isLoading ? 'SALVANDO...' : 'SALVAR REGRA'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InstagramManagement;
