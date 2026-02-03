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
  
  // Define o comportamento baseado na Role
  const isCompany = currentUser?.role === 'company';
  const isAdmin = currentUser?.role === 'admin';
  
  // Aba padrão é sempre 'users' (Minha Equipe / Contas)
  const [activeTab, setActiveTab] = useState<'users' | 'templates'>('users');
  
  const [usersList, setUsersList] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  // Define quais roles podem ser criadas pelo usuário logado
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
      if (activeTab === 'users') {
        const data = await api.users.listProfiles(currentUser);
        setUsersList(data);
      } else if (isAdmin) {
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

  // No componente Management.tsx
const handleOpenCreate = () => {
  if (activeTab === 'users') {
    const defaultRole = availableRoles[0] || 'operador';

    setEditingItem({ 
      name: '', 
      email: '', 
      password: '', 
      role: defaultRole, 
      is_active: true,
      // VÍNCULO AUTOMÁTICO:
      // Se for uma 'company' a criar, o company_id do novo membro será o ID desta empresa.
      company_id: isCompany ? currentUser?.id : null
    });
  } else {
    // Lógica de templates...
    setEditingItem({ 
      name: '', papel: '', contexto: '', acao: '', intencao: '', formato: '', 
      is_global: isAdmin, is_active: true, 
      company_id: currentUser?.id 
    });
  }
  setIsModalOpen(true);
};

  const handleSave = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!currentUser) return;

  try {
    if (activeTab === 'users') {
      const payload = {
        ...editingItem,
        // Garantia final de vínculo: 
        // Se o criador for 'company', forçamos o company_id como sendo o ID do criador.
        company_id: isCompany ? currentUser.id : editingItem.company_id
      };
      
      if (editingItem.id) {
        // Atualiza apenas os dados do perfil (nome, status, etc) usando o ID do utilizador
        await api.users.upsert(payload);
      } else {
        // Regista novo utilizador no Auth e cria o perfil vinculado à empresa
        await api.users.register(payload);
      }
    } else {
      // Lógica para templates PACRIF
      const templateData = {
        ...editingItem,
        company_id: editingItem.company_id || currentUser.id
      };
      await api.templates.save(templateData);
    }

    showToast('Salvo com sucesso', 'success');
    setIsModalOpen(false);
    loadData(); // Atualiza a lista instantaneamente
  } catch (error: any) {
    showToast(error.message || 'Erro ao guardar dados', 'error');
  }
};

  const handleToggleStatus = async (item: any) => {
    const updatedItem = { ...item, is_active: !item.is_active };
    try {
      if (activeTab === 'users') {
        await api.users.upsert(updatedItem);
      } else {
        await api.templates.save(updatedItem);
      }
      showToast('Status atualizado com sucesso', 'info');
      loadData();
    } catch (error) { showToast('Erro ao alterar status', 'error'); }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto w-full h-full overflow-y-auto custom-scrollbar">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {isCompany ? 'Minha Equipe' : 'Gestão Administrativa'}
          </h1>
          <p className="text-slate-500 mt-1">
            {isCompany ? 'Gerencie os profissionais e operadores da sua empresa' : 'Gerencie contas e modelos PACRIF'}
          </p>
        </div>
      </div>

      {/* Somente mostra o alternador se for Admin */}
      {isAdmin && (
        <div className="flex gap-4 mb-8 bg-slate-100 p-1.5 rounded-2xl w-fit">
          <button 
            onClick={() => setActiveTab('users')} 
            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'users' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
          >
            Empresas / Contas
          </button>
          <button 
            onClick={() => setActiveTab('templates')} 
            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'templates' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
          >
            Templates
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeTab === 'users' ? (
            <>
              {usersList.length === 0 && (
                <div className="col-span-full py-20 text-center bg-white rounded-[2.5rem] border border-dashed border-slate-200">
                  <p className="text-slate-400 font-medium">Nenhum utilizador encontrado.</p>
                </div>
              )}
              {usersList.map(u => (
                <div key={u.id} className={`bg-white p-6 rounded-[2.5rem] border ${u.is_active ? 'border-slate-200' : 'border-rose-100 bg-rose-50/20'} shadow-sm hover:shadow-md transition-all`}>
                  <div className="flex justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-xs uppercase">
                      {u.role?.substring(0, 3)}
                    </div>
                    <button 
                      onClick={() => handleToggleStatus(u)}
                      className={`text-[10px] font-bold px-3 py-1 rounded-full ${u.is_active ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}
                    >
                      {u.is_active ? 'Ativo' : 'Inativo'}
                    </button>
                  </div>
                  {/* Tratamento para nome nulo */}
                  <h3 className="font-bold text-slate-900">{u.name || 'Utilizador sem Nome'}</h3>
                  <p className="text-xs text-slate-400 mb-1">{u.email}</p>
                  <p className="text-[10px] font-bold text-indigo-500 uppercase mb-6 tracking-widest">{u.role}</p>
                  <button 
                    onClick={() => { setEditingItem(u); setIsModalOpen(true); }} 
                    className="w-full py-3 rounded-xl border border-slate-100 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Editar Perfil
                  </button>
                </div>
              ))}
            </>
          ) : (
            templates.map(t => (
               <div key={t.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col group">
                 <div className="flex justify-between items-start mb-4">                
                   <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                   </div>
                   <button onClick={() => handleToggleStatus(t)} className={`text-[8px] font-bold px-2 py-0.5 rounded-full ${t.is_active ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                     {t.is_active ? 'Ativo' : 'Inativo'}
                   </button>
                 </div>
                 <h3 className="font-bold text-slate-900 mb-2">{t.name}</h3>
                 {t.is_global && <span className="text-[9px] font-bold text-indigo-500 uppercase bg-indigo-50 px-2 py-0.5 rounded mb-4 w-fit">Global</span>}
                 <div className="mt-auto flex gap-2">
                   <button onClick={() => { setEditingItem(t); setIsModalOpen(true); }} className="flex-1 py-2 text-xs font-bold text-indigo-500 bg-indigo-50 rounded-xl">Editar</button>
                 </div>
               </div>
            ))
          )}

          {/* Botão de Novo Item (sempre visível no final) */}
          <button onClick={handleOpenCreate} className="border-2 border-dashed border-slate-200 rounded-[2.5rem] p-8 flex flex-col items-center justify-center text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-all gap-2 group min-h-[200px]">
            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            </div>
            <span className="font-bold text-sm">Novo {activeTab === 'users' ? (isCompany ? 'Membro' : 'Empresa') : 'Template'}</span>
          </button>
        </div>
      )}

      {/* Modal de Criação/Edição */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className={`bg-white w-full ${activeTab === 'templates' ? 'max-w-3xl' : 'max-w-lg'} rounded-[2.5rem] shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar animate-in zoom-in duration-200`}>
            <form onSubmit={handleSave} className="p-10">
              <h3 className="text-2xl font-bold text-slate-900 mb-8">{editingItem?.id ? 'Editar' : 'Novo'} {activeTab === 'users' ? 'Usuário' : 'Template'}</h3>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-widest">Nome</label>
                  <input required value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 font-medium" placeholder="Nome completo" />
                </div>

                {activeTab === 'users' ? (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-widest">Nível de Acesso (Role)</label>
                      <select 
                        required 
                        value={editingItem.role} 
                        onChange={e => setEditingItem({...editingItem, role: e.target.value})}
                        className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 font-medium appearance-none"
                      >
                        {availableRoles.map(r => (
                          <option key={r} value={r}>{r.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-widest">Email</label>
                      <input type="email" required disabled={!!editingItem.id} value={editingItem.email} onChange={e => setEditingItem({...editingItem, email: e.target.value})} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 font-medium disabled:opacity-50" />
                    </div>
                    {!editingItem.id && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-widest">Senha Provisória</label>
                        <input type="password" required value={editingItem.password} onChange={e => setEditingItem({...editingItem, password: e.target.value})} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 font-medium" />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-indigo-500 uppercase mb-1 ml-1 tracking-widest">P — Papel (Persona)</label>
                        <textarea rows={3} required value={editingItem.papel} onChange={e => setEditingItem({...editingItem, papel: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-indigo-50/30 border border-indigo-100 outline-none focus:border-indigo-500 text-sm" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-emerald-500 uppercase mb-1 ml-1 tracking-widest">C — Contexto</label>
                        <textarea rows={3} required value={editingItem.contexto} onChange={e => setEditingItem({...editingItem, contexto: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-emerald-50/30 border border-emerald-100 outline-none focus:border-emerald-500 text-sm" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-amber-500 uppercase mb-1 ml-1 tracking-widest">I — Intenção</label>
                        <textarea rows={3} required value={editingItem.intencao} onChange={e => setEditingItem({...editingItem, intencao: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-amber-50/30 border border-amber-100 outline-none focus:border-amber-500 text-sm" />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-sky-500 uppercase mb-1 ml-1 tracking-widest">A — Ação</label>
                        <textarea rows={7} required value={editingItem.acao} onChange={e => setEditingItem({...editingItem, acao: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-sky-50/30 border border-sky-100 outline-none focus:border-indigo-500 text-sm" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-rose-500 uppercase mb-1 ml-1 tracking-widest">F — Formato</label>
                        <textarea rows={3} required value={editingItem.formato} onChange={e => setEditingItem({...editingItem, formato: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-rose-50/30 border border-rose-100 outline-none focus:border-rose-500 text-sm" />
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="md:col-span-2 mt-2 flex items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <input type="checkbox" id="is_global" checked={editingItem.is_global} onChange={e => setEditingItem({...editingItem, is_global: e.target.checked})} className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600" />
                        <label htmlFor="is_global" className="text-sm font-bold text-slate-600 cursor-pointer">Template Global (Todas as empresas)</label>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-4 mt-10">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 font-bold text-slate-400 hover:text-slate-600 transition-colors">Cancelar</button>
                <button type="submit" className="flex-[2] bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg active:scale-95 transition-all">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Management;