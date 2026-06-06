import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { ToastType } from '@/components/Toast';
import { Professional, Room } from '@/types';

interface ManagementPageProps {
  showToast: (msg: string, type: ToastType) => void;
}

const Management: React.FC<ManagementPageProps> = ({ showToast }) => {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'professionals' | 'rooms'>('professionals');
  
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'professionals') {
        const data = await api.professionals.list();
        setProfessionals(data);
      } else {
        const data = await api.rooms.list();
        setRooms(data);
      }
    } catch (error) {
      showToast('Erro ao carregar dados', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [activeTab]);

  const defaultJornada = {
    seg: { inicio: '08:00', fim: '18:00', ativo: true },
    ter: { inicio: '08:00', fim: '18:00', ativo: true },
    qua: { inicio: '08:00', fim: '18:00', ativo: true },
    qui: { inicio: '08:00', fim: '18:00', ativo: true },
    sex: { inicio: '08:00', fim: '18:00', ativo: true },
    sab: { inicio: '08:00', fim: '12:00', ativo: false },
    dom: { inicio: '08:00', fim: '12:00', ativo: false },
  };

  const handleOpenCreate = () => {
    if (activeTab === 'professionals') {
      setEditingItem({
        nome: '', especialidade: '', is_active: true, google_calendar_id: '',
        jornada_trabalho: defaultJornada
      });
    } else {
      setEditingItem({
        nome: '', is_available: true
      });
    }
    setIsModalOpen(true);
  };

  const updateJornada = (dia: string, field: string, value: any) => {
    const newJornada = { ...editingItem.jornada_trabalho };
    newJornada[dia] = { ...newJornada[dia], [field]: value };
    setEditingItem({ ...editingItem, jornada_trabalho: newJornada });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (activeTab === 'professionals') {
        await api.professionals.upsert(editingItem);
      } else {
        await api.rooms.upsert(editingItem);
      }

      showToast('Salvo com sucesso', 'success');
      setIsModalOpen(false);
      loadData();
    } catch (error: any) {
      showToast(error.message || 'Erro ao salvar', 'error');
    }
  };

  const handleToggleStatus = async (item: any) => {
    try {
      let updatedItem;
      if (activeTab === 'professionals') {
        updatedItem = { ...item, is_active: !item.is_active };
        await api.professionals.upsert(updatedItem);
      } else {
        updatedItem = { ...item, is_available: !item.is_available };
        await api.rooms.upsert(updatedItem);
      }
      showToast('Status atualizado', 'info');
      loadData();
    } catch (error) {
      showToast('Erro ao atualizar status', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este item?')) return;
    try {
      if (activeTab === 'professionals') {
        await api.professionals.delete(id);
      } else {
        // No novo schema 'salas' não tinha delete na API mas podemos adicionar ou ignorar
        showToast('Exclusão não implementada para salas no novo schema', 'info');
      }
      showToast('Excluído com sucesso', 'success');
      loadData();
    } catch (error) {
      showToast('Erro ao excluir', 'error');
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto w-full h-full overflow-y-auto custom-scrollbar bg-slate-50/30">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Gestão da Clínica</h1>
          <p className="text-slate-500 mt-1">Gerencie seus terapeutas e salas de atendimento.</p>
        </div>

        <button onClick={handleOpenCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-indigo-100 transition-all flex items-center gap-2 active:scale-95">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
          Novo {activeTab === 'professionals' ? 'Profissional' : 'Sala'}
        </button>
      </div>

      <div className="flex bg-white border border-slate-200 p-1 rounded-2xl shadow-sm mb-8 w-fit">
        <button 
          onClick={() => setActiveTab('professionals')} 
          className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'professionals' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500'}`}
        >
          Profissionais
        </button>
        <button 
          onClick={() => setActiveTab('rooms')} 
          className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'rooms' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500'}`}
        >
          Salas
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeTab === 'professionals' ? (
            professionals.map(p => (
              <div key={p.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-14 h-14 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-sm shadow-inner">
                    {(p.nome || 'P').substring(0, 2).toUpperCase()}
                  </div>
                  <button 
                    onClick={() => handleToggleStatus(p)} 
                    className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-xl ${p.is_active ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}
                  >
                    {p.is_active ? 'Ativo' : 'Inativo'}
                  </button>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-1">{p.nome}</h3>
                <p className="text-xs text-indigo-500 font-bold uppercase mb-4">{p.especialidade}</p>
                <div className="space-y-2 mb-8">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    Google Calendar ID
                  </div>
                  <p className="text-xs text-slate-600 font-medium truncate bg-slate-50 p-2 rounded-lg border border-slate-100">
                    {p.google_calendar_id || 'Não configurado'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditingItem(p); setIsModalOpen(true); }}
                    className="flex-1 py-3 rounded-2xl border border-slate-100 text-xs font-black text-slate-900 hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="p-3 rounded-2xl border border-rose-100 text-rose-600 hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            ))
          ) : (
            rooms.map(r => (
              <div key={r.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-14 h-14 rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center font-black text-sm shadow-inner">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                  </div>
                  <button 
                    onClick={() => handleToggleStatus(r)} 
                    className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-xl ${r.is_available ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}
                  >
                    {r.is_available ? 'Disponível' : 'Manutenção'}
                  </button>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-8">{r.nome}</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditingItem(r); setIsModalOpen(true); }}
                    className="flex-1 py-3 rounded-2xl border border-slate-100 text-xs font-black text-slate-900 hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                  >
                    Editar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal de Criação/Edição */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar animate-in fade-in zoom-in duration-300">
            <form onSubmit={handleSave} className="p-12">
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">{editingItem?.id ? 'Editar' : 'Novo'} {activeTab === 'professionals' ? 'Profissional' : 'Sala'}</h3>
                <button type="button" onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                  <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-8">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1 tracking-widest">Nome</label>
                  <input required value={editingItem.nome} onChange={e => setEditingItem({ ...editingItem, nome: e.target.value })} className="w-full px-6 py-5 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 font-bold transition-all" placeholder={activeTab === 'professionals' ? "Nome do Terapeuta" : "Ex: Sala 01"} />
                </div>

                {activeTab === 'professionals' && (
                  <>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1 tracking-widest">Especialidade</label>
                      <input required value={editingItem.especialidade} onChange={e => setEditingItem({ ...editingItem, especialidade: e.target.value })} className="w-full px-6 py-5 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 font-bold transition-all" placeholder="Ex: Massagem Relaxante" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1 tracking-widest">Google Calendar ID</label>
                      <input value={editingItem.google_calendar_id} onChange={e => setEditingItem({ ...editingItem, google_calendar_id: e.target.value })} className="w-full px-6 py-5 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 font-bold transition-all" placeholder="email@group.calendar.google.com" />
                    </div>
                  </>
                )}

                {activeTab === 'professionals' && (
                  <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-6 ml-1 tracking-widest">Jornada de Trabalho</label>
                    <div className="space-y-4">
                      {['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'].map(dia => {
                        const config = (editingItem.jornada_trabalho || defaultJornada)[dia];
                        return (
                          <div key={dia} className="flex items-center gap-4 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
                            <div className="w-10 font-black text-[10px] uppercase text-slate-400 text-center">{dia}</div>
                            <input 
                              type="checkbox" 
                              checked={config.ativo} 
                              onChange={e => updateJornada(dia, 'ativo', e.target.checked)}
                              className="w-5 h-5 rounded-lg border-slate-200 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer" 
                            />
                            <div className="flex-1 flex items-center gap-2">
                              <input 
                                type="time" 
                                value={config.inicio} 
                                disabled={!config.ativo}
                                onChange={e => updateJornada(dia, 'inicio', e.target.value)}
                                className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-[10px] font-bold outline-none focus:border-indigo-500 disabled:opacity-50" 
                              />
                              <span className="text-slate-300 font-bold">às</span>
                              <input 
                                type="time" 
                                value={config.fim} 
                                disabled={!config.ativo}
                                onChange={e => updateJornada(dia, 'fim', e.target.value)}
                                className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-[10px] font-bold outline-none focus:border-indigo-500 disabled:opacity-50" 
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1 tracking-widest">Status Inicial</label>
                  <select
                    value={activeTab === 'professionals' ? (editingItem.is_active ? 'active' : 'inactive') : (editingItem.is_available ? 'available' : 'maintenance')}
                    onChange={e => {
                      if (activeTab === 'professionals') {
                        setEditingItem({ ...editingItem, is_active: e.target.value === 'active' });
                      } else {
                        setEditingItem({ ...editingItem, is_available: e.target.value === 'available' });
                      }
                    }}
                    className="w-full px-6 py-5 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 font-bold appearance-none"
                  >
                    {activeTab === 'professionals' ? (
                      <>
                        <option value="active">ATIVO</option>
                        <option value="inactive">INATIVO</option>
                      </>
                    ) : (
                      <>
                        <option value="available">DISPONÍVEL</option>
                        <option value="maintenance">MANUTENÇÃO</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4 mt-12 pt-10 border-t border-slate-50">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-5 font-black uppercase text-[10px] tracking-[0.2em] text-slate-400 hover:text-slate-900 transition-colors">Cancelar</button>
                <button type="submit" className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white py-5 rounded-[2rem] font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl shadow-indigo-200 active:scale-95 transition-all">Salvar Alterações</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Management;
