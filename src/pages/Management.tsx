// src/pages/Management.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { ToastType } from '@/components/Toast';

interface ManagementPageProps {
  showToast: (msg: string, type: ToastType) => void;
}

const Management: React.FC<ManagementPageProps> = ({ showToast }) => {
  const { user: currentUser } = useAuth();

  const isCompany = currentUser?.role === 'company';
  const isAdmin = currentUser?.role === 'admin';

  const [activeTab, setActiveTab] = useState<'companies' | 'team' | 'templates'>(
    isAdmin ? 'companies' : 'team'
  );

  const [usersList, setUsersList] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  // Estados de Filtro e Busca
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Estado das Abas PACRIF dentro do modal
  const [pacrifTab, setPacrifTab] = useState<'P' | 'A' | 'C' | 'R' | 'I' | 'F'>('P');

  const availableRoles = useMemo(() => {
    if (!currentUser) return [];
    if (isAdmin) return ['company', 'profissional', 'operador'];
    if (isCompany) return ['profissional', 'operador'];
    return [];
  }, [currentUser, isAdmin, isCompany]);

  const loadData = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      if (activeTab === 'companies' || activeTab === 'team') {
        const data = await api.users.listProfiles(currentUser);
        setUsersList(data);
      } else {
        const data = await api.templates.listAll(currentUser);
        setTemplates(data);
      }
    } catch (error) {
      showToast('Erro ao carregar dados', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [activeTab, currentUser]);

  const handleOpenCreate = () => {
    if (activeTab === 'templates') {
      setEditingItem({
        name: '', papel: '', contexto: '', regras: '', acao: '', intencao: '', formato: '',
        is_global: isAdmin, is_active: true,
        company_id: currentUser?.id
      });
      setPacrifTab('P');
    } else {
      const defaultRole = activeTab === 'companies' ? 'company' : (availableRoles.find(r => r !== 'company') || 'operador');
      setEditingItem({
        name: '', email: '', password: '', role: defaultRole, is_active: true,
        company_id: isCompany ? currentUser?.id : null
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    try {
      if (activeTab === 'templates') {
        const templateData = {
          ...editingItem,
          company_id: editingItem.company_id || (editingItem.is_global ? null : currentUser.id)
        };
        await api.templates.save(templateData);
      } else {
        const payload = {
          ...editingItem,
          company_id: isCompany ? currentUser.id : editingItem.company_id
        };

        if (editingItem.id) {
          await api.users.upsert(payload);
        } else {
          await api.users.register(payload);
        }
      }

      showToast('Salvo com sucesso', 'success');
      setIsModalOpen(false);
      loadData();
    } catch (error: any) {
      showToast(error.message || 'Erro ao salvar', 'error');
    }
  };

  const handleToggleStatus = async (item: any) => {
    const updatedItem = { ...item, is_active: !item.is_active };
    try {
      if (activeTab === 'templates') {
        await api.templates.save(updatedItem);
      } else {
        await api.users.upsert(updatedItem);
      }
      showToast('Status atualizado', 'info');
      loadData();
    } catch (error) { showToast('Erro ao alterar status', 'error'); }
  };

  // Lógica de Filtro em Memória
  const filteredUsers = useMemo(() => {
    return usersList.filter(u => {
      if (activeTab === 'companies' && u.role !== 'company') return false;
      if (activeTab === 'team' && u.role === 'company') return false;
      const matchesSearch = (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [usersList, activeTab, searchTerm, roleFilter]);

  const filteredTemplates = useMemo(() => {
    return templates.filter(t => (t.name || '').toLowerCase().includes(searchTerm.toLowerCase()));
  }, [templates, searchTerm]);

  return (
    <div className="p-8 max-w-7xl mx-auto w-full h-full overflow-y-auto custom-scrollbar bg-slate-50/30">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Gestão</h1>
          <p className="text-slate-500 mt-1">Controle de acessos, empresas e modelos PACRIF.</p>
        </div>

        <button onClick={handleOpenCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-indigo-100 transition-all flex items-center gap-2 active:scale-95">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
          Novo {activeTab === 'templates' ? 'Template' : (activeTab === 'companies' ? 'Empresa' : 'Membro')}
        </button>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8">
        <div className="flex bg-white border border-slate-200 p-1 rounded-2xl shadow-sm">
          {isAdmin && (
            <button onClick={() => { setActiveTab('companies'); setRoleFilter('all'); }} className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'companies' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500'}`}>Empresas</button>
          )}
          <button onClick={() => { setActiveTab('team'); setRoleFilter('all'); }} className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'team' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500'}`}>{isAdmin ? 'Colaboradores' : 'Minha Equipe'}</button>
          {isAdmin && (
            <button onClick={() => setActiveTab('templates')} className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'templates' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500'}`}>Templates</button>
          )}
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <svg className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              type="text"
              placeholder="Pesquisar..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500 transition-all font-medium"
            />
          </div>
          {activeTab === 'team' && (
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="px-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold uppercase tracking-wider outline-none focus:border-indigo-500"
            >
              <option value="all">Filtro: Roles</option>
              {availableRoles.filter(r => r !== 'company').map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (activeTab === 'templates' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map(t => (
            <div key={t.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col group">
              <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <button onClick={() => handleToggleStatus(t)} className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-xl border-none ${t.is_active ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                  {t.is_active ? 'Ativo' : 'Inativo'}
                </button>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2 truncate">{t.name}</h3>
              <div className="flex gap-2 mb-6">
                {t.is_global && <span className="text-[10px] font-black text-indigo-500 uppercase bg-indigo-50 px-3 py-1 rounded-lg">Global</span>}
                <span className="text-[10px] font-black text-slate-400 uppercase bg-slate-50 px-3 py-1 rounded-lg">PACRIF</span>
              </div>
              <button
                onClick={() => {
                  setEditingItem(t);
                  setPacrifTab('P');
                  setIsModalOpen(true);
                }}
                className="w-full py-3.5 rounded-2xl bg-slate-50 text-xs font-bold text-slate-600 hover:bg-slate-900 hover:text-white transition-all"
              >
                Editar Modelo
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUsers.map(u => (
            <div key={u.id} className={`bg-white p-8 rounded-[2.5rem] border ${u.is_active ? 'border-slate-200' : 'border-rose-100 bg-rose-50/10'} shadow-sm hover:shadow-md transition-all relative overflow-hidden group`}>
              <div className="flex justify-between mb-6">
                <div className="w-14 h-14 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-sm uppercase shadow-inner">
                  {u.role?.substring(0, 3)}
                </div>
                <button
                  onClick={() => handleToggleStatus(u)}
                  className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-xl ${u.is_active ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}
                >
                  {u.is_active ? 'Ativo' : 'Off'}
                </button>
              </div>

              <h3 className="text-xl font-bold text-slate-900 mb-1">{u.name || 'Sem Nome'}</h3>
              <p className="text-xs text-slate-400 mb-4">{u.email}</p>

              <div className="flex flex-wrap gap-2 mb-8">
                <span className="text-[9px] font-black text-indigo-500 uppercase bg-indigo-50/50 px-3 py-1 rounded-lg tracking-widest">{u.role}</span>
                {u.company?.name && (
                  <span className="text-[9px] font-black text-slate-400 uppercase bg-slate-100 px-3 py-1 rounded-lg tracking-widest truncate max-w-[150px]">🏢 {u.company.name}</span>
                )}
              </div>

              <button
                onClick={() => { setEditingItem(u); setIsModalOpen(true); }}
                className="w-full py-4 rounded-2xl border border-slate-100 text-xs font-black text-slate-900 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-sm"
              >
                Configurar Acesso
              </button>
            </div>
          ))}
        </div>
      ))}

      {isLoading === false && (activeTab === 'templates' ? filteredTemplates.length === 0 : filteredUsers.length === 0) && (
        <div className="py-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100 max-w-2xl mx-auto flex flex-col items-center">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
          </div>
          <p className="text-slate-400 font-bold">Nenhum registro encontrado para esta busca ou filtro.</p>
        </div>
      )}

      {/* Modal de Criação/Edição */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className={`bg-white w-full ${activeTab === 'templates' ? 'max-w-4xl' : 'max-w-xl'} rounded-[3rem] shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar animate-in fade-in zoom-in duration-300`}>
            <form onSubmit={handleSave} className="p-12">
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">{editingItem?.id ? 'Editar' : 'Novo'} {activeTab === 'templates' ? 'Modelo PACRIF' : (activeTab === 'companies' ? 'Empresa' : 'Membro')}</h3>
                <button type="button" onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                  <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-8">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1 tracking-widest">Nome Identificador</label>
                  <input required value={editingItem.name} onChange={e => setEditingItem({ ...editingItem, name: e.target.value })} className="w-full px-6 py-5 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 font-bold transition-all" placeholder="Ex: Lucas Operador ou Template Atendimento Clínico" />
                </div>

                {activeTab !== 'templates' ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1 tracking-widest">Nível de Acesso (Role)</label>
                        <select
                          required
                          disabled={activeTab === 'companies'}
                          value={editingItem.role}
                          onChange={e => setEditingItem({ ...editingItem, role: e.target.value })}
                          className="w-full px-6 py-5 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 font-bold appearance-none disabled:opacity-50"
                        >
                          {availableRoles.map(r => (
                            <option key={r} value={r}>{r.toUpperCase()}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1 tracking-widest">E-mail</label>
                        <input type="email" required disabled={!!editingItem.id} value={editingItem.email} onChange={e => setEditingItem({ ...editingItem, email: e.target.value })} className="w-full px-6 py-5 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 font-bold disabled:opacity-50" />
                      </div>
                    </div>
                    {!editingItem.id && (
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1 tracking-widest">Senha Provisória</label>
                        <input type="password" required value={editingItem.password} onChange={e => setEditingItem({ ...editingItem, password: e.target.value })} className="w-full px-6 py-5 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 font-bold transition-all shadow-inner" placeholder="Pelo menos 6 caracteres" />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-8">
                    {/* Barra de Abas PACRIF */}
                    <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full overflow-x-auto gap-2">
                      {[
                        { id: 'P', label: 'P — Papel', color: 'text-indigo-600', bg: 'bg-indigo-50' },
                        { id: 'A', label: 'A — Ação', color: 'text-sky-600', bg: 'bg-sky-50' },
                        { id: 'C', label: 'C — Contexto', color: 'text-emerald-600', bg: 'bg-emerald-50' },
                        { id: 'R', label: 'R — Regras', color: 'text-rose-600', bg: 'bg-rose-50' },
                        { id: 'I', label: 'I — Intenção', color: 'text-amber-600', bg: 'bg-amber-50' },
                        { id: 'F', label: 'F — Formato', color: 'text-slate-600', bg: 'bg-slate-50' }
                      ].map(tab => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setPacrifTab(tab.id as any)}
                          className={`flex-1 min-w-[120px] px-4 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${pacrifTab === tab.id ? `bg-white ${tab.color} shadow-sm border border-slate-200` : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <div className="min-h-[300px] animate-in fade-in duration-300">
                      {pacrifTab === 'P' && (
                        <div className="space-y-4">
                          <label className="block text-[11px] font-black text-indigo-600 uppercase bg-indigo-50 px-4 py-2 rounded-xl w-fit tracking-widest">P — Papel (Persona)</label>
                          <textarea rows={10} required value={editingItem.papel} onChange={e => setEditingItem({ ...editingItem, papel: e.target.value })} className="w-full px-6 py-5 rounded-3xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 text-base font-medium resize-none shadow-inner" placeholder="Quem a IA deve ser? Ex: Você é um atendente especializado em suporte técnico..." />
                        </div>
                      )}
                      {pacrifTab === 'A' && (
                        <div className="space-y-4">
                          <label className="block text-[11px] font-black text-sky-600 uppercase bg-sky-50 px-4 py-2 rounded-xl w-fit tracking-widest">A — Ação (Workflow)</label>
                          <textarea rows={10} required value={editingItem.acao} onChange={e => setEditingItem({ ...editingItem, acao: e.target.value })} className="w-full px-6 py-5 rounded-3xl bg-slate-50 border border-slate-100 outline-none focus:border-sky-500 text-base font-medium resize-none shadow-inner" placeholder="Descreva o passo a passo que a IA deve seguir..." />
                        </div>
                      )}
                      {pacrifTab === 'C' && (
                        <div className="space-y-4">
                          <label className="block text-[11px] font-black text-emerald-600 uppercase bg-emerald-50 px-4 py-2 rounded-xl w-fit tracking-widest">C — Contexto</label>
                          <textarea rows={10} required value={editingItem.contexto} onChange={e => setEditingItem({ ...editingItem, contexto: e.target.value })} className="w-full px-6 py-5 rounded-3xl bg-slate-50 border border-slate-100 outline-none focus:border-emerald-500 text-base font-medium resize-none shadow-inner" placeholder="Forneça informações sobre a empresa, produtos ou serviços relevantes..." />
                        </div>
                      )}
                      {pacrifTab === 'R' && (
                        <div className="space-y-4">
                          <label className="block text-[11px] font-black text-rose-600 uppercase bg-rose-50 px-4 py-2 rounded-xl w-fit tracking-widest">R — Regras</label>
                          <textarea rows={10} required value={editingItem.regras} onChange={e => setEditingItem({ ...editingItem, regras: e.target.value })} className="w-full px-6 py-5 rounded-3xl bg-slate-50 border border-slate-100 outline-none focus:border-rose-500 text-base font-medium resize-none shadow-inner" placeholder="O que a IA NÃO pode fazer ou dizer? Limitações e bordas..." />
                        </div>
                      )}
                      {pacrifTab === 'I' && (
                        <div className="space-y-4">
                          <label className="block text-[11px] font-black text-amber-600 uppercase bg-amber-50 px-4 py-2 rounded-xl w-fit tracking-widest">I — Intenção</label>
                          <textarea rows={10} required value={editingItem.intencao} onChange={e => setEditingItem({ ...editingItem, intencao: e.target.value })} className="w-full px-6 py-5 rounded-3xl bg-slate-50 border border-slate-100 outline-none focus:border-amber-500 text-base font-medium resize-none shadow-inner" placeholder="Qual o objetivo final desta interação? (Venda, suporte, agendamento...)" />
                        </div>
                      )}
                      {pacrifTab === 'F' && (
                        <div className="space-y-4">
                          <label className="block text-[11px] font-black text-slate-600 uppercase bg-slate-100 px-4 py-2 rounded-xl w-fit tracking-widest">F — Formato</label>
                          <textarea rows={10} required value={editingItem.formato} onChange={e => setEditingItem({ ...editingItem, formato: e.target.value })} className="w-full px-6 py-5 rounded-3xl bg-slate-50 border border-slate-100 outline-none focus:border-slate-500 text-base font-medium resize-none shadow-inner" placeholder="Como a resposta deve ser entregue? Ex: JSON, lista, texto curto com emojis..." />
                        </div>
                      )}
                    </div>

                    {isAdmin && (
                      <div className="flex items-center gap-4 bg-indigo-600 p-6 rounded-3xl text-white shadow-xl shadow-indigo-100 transform hover:scale-[1.01] transition-all">
                        <input type="checkbox" id="is_global" checked={editingItem.is_global} onChange={e => setEditingItem({ ...editingItem, is_global: e.target.checked })} className="w-6 h-6 rounded-lg accent-white cursor-pointer" />
                        <label htmlFor="is_global" className="font-black uppercase text-sm tracking-widest cursor-pointer select-none">Disponibilizar como Modelo Global para Clientes</label>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col md:flex-row gap-4 mt-12 pt-10 border-t border-slate-50">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-5 font-black uppercase text-[10px] tracking-[0.2em] text-slate-400 hover:text-slate-900 transition-colors">Voltar sem Salvar</button>
                <button type="submit" className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white py-5 rounded-[2rem] font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl shadow-indigo-200 active:scale-95 transition-all">Finalizar e Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Management;