import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/hooks/useAuth'; // 1. Importar useAuth
import { ToastType } from '@/components/Toast';

interface BusinessPageProps {
  showToast: (msg: string, type: ToastType) => void;
}

const WEEK_DAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

const BusinessPage: React.FC<BusinessPageProps> = ({ showToast }) => {
  const { user } = useAuth(); // 2. Obter o utilizador
  const [activeSubTab, setActiveSubTab] = useState<'services' | 'products' | 'staff'>('services');
  const [items, setItems] = useState<any[]>([]);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [itemForm, setItemForm] = useState({
    name: '', description: '', price: 0, category: 'SERVICE', duration_minutes: 30
  });

  const [staffForm, setStaffForm] = useState({
    name: '', role: '', specialty: '',
    work_days: ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"],
    start_time: '08:00', end_time: '18:00'
  });

  const loadData = async () => {
    if (!user) return; // 3. Proteção
    setIsLoading(true);
    try {
      if (activeSubTab === 'staff') {
        // 4. Passar user para a listagem
        const result = await api.business.professionals.list(user);
        setProfessionals(result || []);
      } else {
        // 4. Passar user para a listagem
        const result = await api.business.services.list(user);
        const filtered = result?.filter((i: any) =>
          activeSubTab === 'services' ? i.category === 'SERVICE' : i.category === 'PRODUCT'
        );
        setItems(filtered || []);
      }
    } catch (error) {
      showToast('Erro ao carregar dados', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadData();
  }, [activeSubTab, user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      // 5. Injetar o ID da empresa no payload antes de salvar
      const companyId = user.company_id || user.id;
      const payload = activeSubTab === 'staff'
        ? { ...staffForm, company_id: companyId }
        : { ...itemForm, company_id: companyId };

      await api.business[activeSubTab === 'staff' ? 'professionals' : 'services'].upsert({
        ...payload,
        ...(editingId ? { id: editingId } : {})
      });

      showToast('Salvo com sucesso!', 'success');
      setIsModalOpen(false);
      loadData();
    } catch (error) { showToast('Erro ao salvar', 'error'); }
  };

  const openModal = (data?: any) => {
    if (data) {
      setEditingId(data.id);
      activeSubTab === 'staff' ? setStaffForm(data) : setItemForm(data);
    } else {
      setEditingId(null);
      if (activeSubTab === 'staff') {
        setStaffForm({ name: '', role: '', specialty: '', work_days: ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"], start_time: '08:00', end_time: '18:00' });
      } else {
        setItemForm({
          name: '', description: '', price: 0,
          category: activeSubTab === 'services' ? 'SERVICE' : 'PRODUCT',
          duration_minutes: 30
        });
      }
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza?')) return;
    try {
      await api.business[activeSubTab === 'staff' ? 'professionals' : 'services'].delete(id);
      showToast('Excluído com sucesso', 'success');
      loadData();
    } catch (error) { showToast('Erro ao excluir', 'error'); }
  };

  const toggleDay = (day: string) => {
    const current = staffForm.work_days;
    setStaffForm({
      ...staffForm,
      work_days: current.includes(day) ? current.filter(d => d !== day) : [...current, day]
    });
  };

  return (
    <div className="p-8 h-full overflow-y-auto custom-scrollbar bg-slate-50/50">
      {/* Header e Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
        <div className="flex bg-white border border-slate-200 rounded-2xl p-1 shadow-sm w-full sm:w-auto overflow-x-auto">
          <button onClick={() => setActiveSubTab('services')} className={`px-6 py-3 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${activeSubTab === 'services' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500'}`}>Serviços</button>
          <button onClick={() => setActiveSubTab('products')} className={`px-6 py-3 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${activeSubTab === 'products' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500'}`}>Produtos</button>
          <button onClick={() => setActiveSubTab('staff')} className={`px-6 py-3 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${activeSubTab === 'staff' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500'}`}>Equipe</button>
        </div>
        <button onClick={() => openModal()} className="w-full sm:w-auto bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-indigo-700 shadow-lg transition-all">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
          Adicionar {activeSubTab === 'staff' ? 'Profissional' : activeSubTab === 'services' ? 'Serviço' : 'Produto'}
        </button>
      </div>

      {/* Grid de Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {activeSubTab !== 'staff' ? (
          items.map(s => (
            <div key={s.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all group relative">
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openModal(s)} className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeWidth="2" /></svg></button>
                <button onClick={() => handleDelete(s.id)} className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-rose-600 hover:text-white transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth="2" /></svg></button>
              </div>
              <h4 className="font-bold text-slate-900 text-lg mb-1">{s.name}</h4>
              <p className="text-slate-400 text-sm mb-6 h-10 line-clamp-2">{s.description}</p>
              <div className="flex justify-between items-center border-t border-slate-50 pt-4">
                {s.category === 'SERVICE' && (
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-xs"><svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2" /></svg> {s.duration_minutes}m</div>
                )}
                <div className="text-indigo-600 font-extrabold text-xl">R$ {s.price}</div>
              </div>
            </div>
          ))
        ) : (
          professionals.map(p => (
            <div key={p.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all group relative">
              {/* Botões de Ação Staff */}
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openModal(p)} className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeWidth="2" /></svg></button>
                <button onClick={() => handleDelete(p.id)} className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-rose-600 hover:text-white transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth="2" /></svg></button>
              </div>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-bold text-xl">{p.name.charAt(0)}</div>
                <div><h4 className="font-bold text-slate-900 text-lg">{p.name}</h4><p className="text-indigo-600 text-xs font-bold uppercase tracking-widest">{p.role}</p></div>
              </div>
              <div className="space-y-4 border-t border-slate-50 pt-5 text-xs font-bold">
                <div className="flex justify-between items-center"><span className="text-slate-400">HORÁRIO</span><span>{p.start_time} - {p.end_time}</span></div>
                <div className="flex flex-wrap gap-1">
                  {WEEK_DAYS.map(day => (
                    <span key={day} className={`px-2 py-1 rounded-md text-[9px] ${p.work_days.includes(day) ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-300'}`}>{day.substring(0, 3)}</span>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal CRUD */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl p-10 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h3 className="text-2xl font-bold text-slate-900 mb-8">{editingId ? 'Editar' : 'Cadastrar'} {activeSubTab === 'staff' ? 'Profissional' : activeSubTab === 'services' ? 'Serviço' : 'Produto'}</h3>
            <form onSubmit={handleSave} className="space-y-6">
              {activeSubTab !== 'staff' ? (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Nome</label>
                    <input required value={itemForm.name} className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-indigo-500 font-medium" onChange={e => setItemForm({ ...itemForm, name: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase">Preço (R$)</label>
                      <input type="number" required value={itemForm.price || ''} className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-indigo-500" onChange={e => setItemForm({ ...itemForm, price: e.target.value === '' ? 0 : parseFloat(e.target.value) })} />
                    </div>
                    {/* Só mostra duração se for serviço */}
                    {activeSubTab === 'services' && (
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Duração Estimada</label>
                        <select
                          value={itemForm.duration_minutes}
                          className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                          onChange={e => setItemForm({ ...itemForm, duration_minutes: parseInt(e.target.value) })}
                        >
                          <option value="15">15 minutos</option>
                          <option value="30">30 minutos</option>
                          <option value="45">45 minutos</option>
                          <option value="60">1 hora</option>
                          <option value="90">1h 30min</option>
                          <option value="120">2 horas</option>
                        </select>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Descrição</label>
                    <textarea rows={3} value={itemForm.description} className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-indigo-500 resize-none" onChange={e => setItemForm({ ...itemForm, description: e.target.value })} />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase">Nome</label>
                      <input required value={staffForm.name} className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-indigo-500" onChange={e => setStaffForm({ ...staffForm, name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase">Cargo</label>
                      <input required value={staffForm.role} className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-indigo-500" onChange={e => setStaffForm({ ...staffForm, role: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-400 uppercase">Dias de Trabalho</label>
                    <div className="flex flex-wrap gap-2">{WEEK_DAYS.map(day => (
                      <button key={day} type="button" onClick={() => toggleDay(day)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${staffForm.work_days.includes(day) ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-100'}`}>{day}</button>
                    ))}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <input type="time" value={staffForm.start_time} className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-indigo-500" onChange={e => setStaffForm({ ...staffForm, start_time: e.target.value })} />
                    <input type="time" value={staffForm.end_time} className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-indigo-500" onChange={e => setStaffForm({ ...staffForm, end_time: e.target.value })} />
                  </div>
                </>
              )}
              <div className="flex gap-4 pt-6"><button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 font-bold text-slate-400">Cancelar</button><button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200">Confirmar</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BusinessPage;