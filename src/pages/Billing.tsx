import React, { useState, useEffect, useMemo } from 'react';
import { api } from '@/services/api';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Invoice, PixCharge } from '@/types';
import { QRCodeCanvas } from 'qrcode.react';
import { ToastType } from '@/components/Toast';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface BillingPageProps {
  showToast: (msg: string, type: ToastType) => void;
}

const STATUS_OPTIONS = ['Aberta', 'Paga', 'Vencida', 'Cancelada'];

const BillingPage: React.FC<BillingPageProps> = ({ showToast }) => {
  const { user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'invoices' | 'pending_billing'>('invoices');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [pixCharge, setPixCharge] = useState<any | null>(null);
  const [surchargeModal, setSurchargeModal] = useState<{id: string, valor: number} | null>(null);
  const [surchargeValue, setSurchargeValue] = useState<string>("");
  const [deleteModal, setDeleteModal] = useState<{invoiceId: string, appointmentId: string | null} | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isPaid, setIsPaid] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [invPage, setInvPage] = useState(1);
  const itemsPerPage = 6;

  const loadData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [invData, aptData] = await Promise.all([
        api.billing.listInvoices(user),
        api.appointments.list(user)
      ]);
      setInvoices(invData || []);
      setAppointments(aptData || []);
    } catch (error) {
      showToast('Erro ao carregar dados', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { if (user) loadData(); }, [user]);

  const chartData = useMemo(() => {
    const dailyData: Record<string, number> = {};
    invoices.filter(i => i.status_fatura === 'Paga').forEach(inv => {
      const date = new Date(inv.data_emissao).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      dailyData[date] = (dailyData[date] || 0) + Number(inv.valor);
    });
    return Object.entries(dailyData).map(([name, total]) => ({ name, total })).slice(-7);
  }, [invoices]);

  // 1. EFEITO DE POLLING: Verifica o status do pagamento no Sicredi
useEffect(() => {
  let interval: NodeJS.Timeout;

  // Só inicia o polling se o modal estiver aberto, houver um pixCharge e não estiver pago
  if (selectedInvoice && pixCharge && !isPaid) {
    interval = setInterval(async () => {
      try {
        const status = await api.billing.checkPaymentStatus(pixCharge.txid);
        
        // Se o status for positivo, interrompe o polling e atualiza a UI
        if (['CONCLUIDA', 'PAGO', 'CONCLUIDO'].includes(status?.toUpperCase())) {
          setIsPaid(true);
          showToast('Pagamento confirmado com sucesso!', 'success');
          loadData(); // Atualiza a tabela e os gráficos ao fundo
          clearInterval(interval);
        }
      } catch (error) {
        console.error("Erro no polling do PIX:", error);
      }
    }, 7000); // Verifica a cada 7 segundos
  }

  return () => {
    if (interval) clearInterval(interval);
  };
}, [selectedInvoice, pixCharge, isPaid]);

// 2. EFEITO DE COUNTDOWN: Atualiza o tempo restante do QR Code
useEffect(() => {
  let timer: NodeJS.Timeout;

  if (selectedInvoice && pixCharge && !isPaid) {
    timer = setInterval(() => {
      const now = new Date().getTime();
      const expiration = new Date(pixCharge.data_expiracao).getTime();
      const diff = expiration - now;

      if (diff <= 0) {
        setTimeLeft('EXPIRADO');
        clearInterval(timer);
      } else {
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${minutes}:${seconds < 10 ? '0' : ''}${seconds}`);
      }
    }, 1000);
  }

  return () => {
    if (timer) clearInterval(timer);
  };
}, [selectedInvoice, pixCharge, isPaid]);

  const handleAddSurcharge = async () => {
    if (!surchargeModal) return;
    try {
      const novoValor = surchargeModal.valor + parseFloat(surchargeValue);
      await supabase.from('invoices').update({ valor: novoValor }).eq('id', surchargeModal.id);
      showToast(`Valor atualizado!`, 'success');
      setSurchargeModal(null); setSurchargeValue(""); loadData();
    } catch (e) { showToast('Erro ao aplicar valor', 'error'); }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    await supabase.from('invoices').update({ status_fatura: newStatus }).eq('id', id);
    showToast('Status alterado!', 'success');
    loadData();
  };

  const handleViewPix = async (invoice: Invoice) => {
    try {
      const charge = await api.billing.getPixCharge(invoice.id);
      if (charge) {
        setPixCharge({ txid: charge.txid, qrcode_copia_cola: charge.qrcode_copia_cola, valor_original: Number(charge.valor_original), data_expiracao: charge.data_expiracao });
        setSelectedInvoice(invoice);
        setIsPaid(['CONCLUIDA', 'PAGO', 'CONCLUIDO'].includes(charge.status_sicredi?.toUpperCase()));
      }
    } catch (e) { showToast('Erro ao carregar PIX', 'error'); }
  };

  const handleGenerateInvoice = async (apt: any) => {
    try {
      setIsPaid(false);
      const res = await api.billing.createInvoiceWithPix(apt);
      setPixCharge({ txid: res.txid, qrcode_copia_cola: res.pixCopiaECola, valor_original: Number(res.valor), data_expiracao: res.dataExpiracao });
      setSelectedInvoice({ id: res.txid, valor: res.valor });
      loadData();
    } catch (e) { showToast('Erro ao gerar fatura', 'error'); }
  };

  const handleDeleteAction = async (deleteBoth: boolean) => {
    if (!deleteModal) return;
    try {
      await supabase.from('invoices').delete().eq('id', deleteModal.invoiceId);
      if (deleteBoth && deleteModal.appointmentId) await supabase.from('appointments').delete().eq('id', deleteModal.appointmentId);
      showToast('Registro excluído!', 'success');
      setDeleteModal(null); loadData();
    } catch (e) { showToast('Erro ao excluir', 'error'); }
  };

  // --- LÓGICA DE FILTROS E CONTAGEM ---
  const appointmentsToBill = useMemo(() => appointments.filter(apt => !invoices.some(inv => inv.appointment_id === apt.id) && apt.status !== 'CANCELLED'), [appointments, invoices]);
  const filteredInvoices = useMemo(() => invoices.filter(inv => (inv.contacts?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) && (statusFilter === 'ALL' || inv.status_fatura === statusFilter)), [invoices, searchTerm, statusFilter]);
  const currentInvoices = filteredInvoices.slice((invPage - 1) * itemsPerPage, invPage * itemsPerPage);
  const totalInvPages = Math.ceil(filteredInvoices.length / itemsPerPage);

  const stats = useMemo(() => ({
    aFaturar: appointmentsToBill.reduce((acc, curr) => acc + (curr.price || 0), 0),
    recebido: invoices.filter(i => i.status_fatura === 'Paga').reduce((acc, curr) => acc + Number(curr.valor), 0),
    pendentes: appointments.filter(a => a.status === 'PENDING').reduce((acc, curr) => acc + (curr.price || 0), 0)
  }), [appointmentsToBill, invoices, appointments]);

  if (isLoading) return <div className="p-4 md:p-8 animate-pulse text-slate-400 font-bold">Carregando...</div>;

  return (
    <div className="p-4 md:p-8 h-full overflow-y-auto custom-scrollbar bg-slate-50/50">
      <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight mb-6 md:mb-8">Painel Financeiro</h1>

      {/* 1. CARDS DE RESUMO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-8">
        <div className="bg-indigo-600 p-5 md:p-6 rounded-[2rem] shadow-lg text-white">
          <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest mb-1">A Faturar (Agenda)</p>
          <p className="text-xl md:text-2xl font-black font-mono">R$ {stats.aFaturar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-emerald-600 p-5 md:p-6 rounded-[2rem] shadow-lg text-white">
          <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest mb-1">Total Recebido</p>
          <p className="text-xl md:text-2xl font-black font-mono">R$ {stats.recebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white p-5 md:p-6 rounded-[2rem] border border-slate-200 shadow-sm sm:col-span-2 lg:col-span-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Potencial (Agendamentos)</p>
          <p className="text-xl md:text-2xl font-black text-slate-900 font-mono">R$ {stats.pendentes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      {/* 2. GRÁFICO */}
      <div className="bg-white border border-slate-200 rounded-[2rem] md:rounded-[2.5rem] p-4 md:p-8 shadow-sm mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-2">
          <div>
            <h3 className="text-base md:text-lg font-bold text-slate-900">Evolução de Receita</h3>
            <p className="text-[10px] md:text-xs text-slate-400">Total recebido por dia</p>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-full">
            <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
            <span className="text-[9px] font-bold text-slate-500 uppercase">Receita Real</span>
          </div>
        </div>
        <div className="h-[200px] md:h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 'bold', fill: '#94a3b8'}} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 'bold', fill: '#94a3b8'}} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '12px' }}
                formatter={(value: any) => [`R$ ${Number(value).toFixed(2)}`, 'Receita']}
              />
              <Area type="monotone" dataKey="total" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. FILTROS E SUB-TABS COM QUANTITATIVOS */}
      <div className="bg-white p-4 md:p-5 rounded-[2rem] border border-slate-200 shadow-sm mb-6 flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
        <div className="flex bg-slate-100 p-1 rounded-2xl w-full lg:w-fit">
          <button 
            onClick={() => setActiveSubTab('invoices')} 
            className={`flex-1 lg:flex-none px-4 md:px-6 py-2 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeSubTab === 'invoices' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            Faturas
            <span className={`px-2 py-0.5 rounded-md text-[10px] ${activeSubTab === 'invoices' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
              {invoices.length}
            </span>
          </button>
          <button 
            onClick={() => setActiveSubTab('pending_billing')} 
            className={`flex-1 lg:flex-none px-4 md:px-6 py-2 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeSubTab === 'pending_billing' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            Aguardando
            <span className={`px-2 py-0.5 rounded-md text-[10px] ${activeSubTab === 'pending_billing' ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-500'}`}>
              {appointmentsToBill.length}
            </span>
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 flex-1 lg:max-w-xl">
          <input type="text" placeholder="Nome do cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1 px-5 py-2.5 bg-slate-50 border-none rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full sm:w-44 px-4 py-2.5 bg-slate-50 border-none rounded-2xl text-sm outline-none">
            <option value="ALL">Status: Todos</option>
            {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
      </div>

      {/* 4. TABELA */}
      <div className="bg-white border border-slate-200 rounded-[2rem] md:rounded-[2.5rem] shadow-sm overflow-hidden mb-10">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left min-w-[700px]">
            <thead className="bg-slate-50/50">
              <tr className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 tracking-widest">
                <th className="px-6 md:px-8 py-4 md:py-5">Cliente</th>
                <th className="px-6 md:px-8 py-4 md:py-5">Valor</th>
                <th className="px-6 md:px-8 py-4 md:py-5">Status</th>
                <th className="px-6 md:px-8 py-4 md:py-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {activeSubTab === 'invoices' ? (
                currentInvoices.length > 0 ? (
                  currentInvoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-6 md:px-8 py-4 md:py-6 font-bold text-slate-900">{inv.contacts?.name || 'Cliente'}</td>
                      <td className="px-6 md:px-8 py-4 md:py-6 font-black text-slate-900">R$ {Number(inv.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 md:px-8 py-4 md:py-6">
                        <select value={inv.status_fatura} onChange={(e) => handleStatusChange(inv.id, e.target.value)} className={`text-[9px] md:text-[10px] font-black uppercase px-2 md:px-3 py-1.5 rounded-xl border-none ring-1 ring-inset ${inv.status_fatura === 'Paga' ? 'bg-emerald-50 text-emerald-600 ring-emerald-100' : 'bg-amber-50 text-amber-600 ring-amber-100'}`}>
                          {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      </td>
                      <td className="px-6 md:px-8 py-4 md:py-6 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setSurchargeModal({id: inv.id, valor: Number(inv.valor)})} className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 6v6m0 0v6m0-6h6m-6 0H6" strokeWidth="2" /></svg></button>
                          <button onClick={() => setDeleteModal({invoiceId: inv.id, appointmentId: (inv as any).appointment_id})} className="p-2 bg-rose-50 text-rose-500 rounded-lg hover:bg-rose-600 hover:text-white transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6" strokeWidth="2" /></svg></button>
                          <button onClick={() => handleViewPix(inv)} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3" strokeWidth="2" /></svg></button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={4} className="p-10 text-center text-slate-400">Nenhuma fatura encontrada.</td></tr>
                )
              ) : (
                appointmentsToBill.length > 0 ? (
                  appointmentsToBill.map(apt => (
                    <tr key={apt.id} className="hover:bg-amber-50/10 transition-colors">
                      <td className="px-6 md:px-8 py-4 md:py-6 font-bold">{apt.contactName}</td>
                      <td className="px-6 md:px-8 py-4 md:py-6 font-black text-slate-900 font-mono">R$ {(apt.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 md:px-8 py-4 md:py-6 text-xs text-slate-500">{new Date(apt.date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                      <td className="px-6 md:px-8 py-4 md:py-6 text-right"><button onClick={() => handleGenerateInvoice(apt)} className="bg-emerald-500 text-white px-4 md:px-5 py-2 rounded-xl text-[9px] md:text-[10px] font-black uppercase shadow-md transition-all active:scale-95 whitespace-nowrap">Gerar Fatura</button></td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={4} className="p-10 text-center text-slate-400">Nenhum agendamento pendente de fatura.</td></tr>
                )
              )}
            </tbody>
          </table>
        </div>
        
        {/* PAGINAÇÃO */}
        {activeSubTab === 'invoices' && (
          <div className="p-4 md:p-6 bg-slate-50/50 border-t flex justify-between items-center">
            <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Página {invPage} de {totalInvPages || 1}</p>
            <div className="flex gap-2">
              <button disabled={invPage === 1} onClick={() => setInvPage(p => p - 1)} className="p-2 bg-white border rounded-xl disabled:opacity-30 shadow-sm"><svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth="2"/></svg></button>
              <button disabled={invPage === totalInvPages} onClick={() => setInvPage(p => p + 1)} className="p-2 bg-white border rounded-xl disabled:opacity-30 shadow-sm"><svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth="2"/></svg></button>
            </div>
          </div>
        )}
      </div>

      {/* ... (Modais permanecem os mesmos) ... */}
      {/* MODAL EXCLUSÃO */}
      {deleteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 text-center shadow-2xl">
            <div className="w-16 h-16 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeWidth="2" /></svg></div>
            <h3 className="text-2xl font-bold mb-2">Excluir Registro</h3>
            <p className="text-slate-500 mb-8 text-sm">Como deseja proceder com a exclusão?</p>
            <div className="flex flex-col gap-3">
              <button onClick={() => handleDeleteAction(false)} className="w-full py-4 bg-slate-100 rounded-2xl font-bold hover:bg-slate-200 transition-all">Excluir APENAS Fatura</button>
              <button onClick={() => handleDeleteAction(true)} className="w-full py-4 bg-rose-600 text-white rounded-2xl font-bold hover:bg-rose-700 transition-all">Excluir Fatura + Agendamento</button>
              <button onClick={() => setDeleteModal(null)} className="w-full py-4 text-slate-400 font-bold">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ACRÉSCIMO */}
      {surchargeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl">
            <h3 className="text-xl font-bold mb-2 text-slate-900">Adicionar Valor</h3>
            <p className="text-sm text-slate-500 mb-6">Total atual: R$ {surchargeModal.valor.toFixed(2)}</p>
            <input type="number" step="0.01" autoFocus value={surchargeValue} onChange={e => setSurchargeValue(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl mb-6 text-lg font-black focus:ring-2 focus:ring-indigo-500" placeholder="R$ 0,00" />
            <div className="flex gap-3">
              <button onClick={() => setSurchargeModal(null)} className="flex-1 py-3 text-slate-400 font-bold">Cancelar</button>
              <button onClick={handleAddSurcharge} className="flex-2 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg hover:bg-indigo-700 transition-all">Aplicar Acréscimo</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PIX */}
      {selectedInvoice && pixCharge && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-10 flex flex-col items-center">
            {isPaid ? (
              <div className="text-center animate-in zoom-in duration-300">
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 mx-auto"><svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth="3" /></svg></div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Pago com Sucesso!</h3>
                <p className="text-slate-500 mb-8">O financeiro já foi atualizado.</p>
                <button onClick={() => setSelectedInvoice(null)} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold">Fechar</button>
              </div>
            ) : (
              <>
                <div className={`mb-6 px-4 py-1 rounded-full text-[10px] font-black uppercase ${timeLeft === 'EXPIRADO' ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'}`}>{timeLeft === 'EXPIRADO' ? '🔴 QR Code Expirado' : `⏱ Expira em: ${timeLeft}`}</div>
                <div className={`bg-white p-6 rounded-[2rem] border-4 ${timeLeft === 'EXPIRADO' ? 'border-rose-100 grayscale' : 'border-indigo-50'} mb-8 shadow-inner relative`}>
                  <QRCodeCanvas value={pixCharge.qrcode_copia_cola} size={200} />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10"><p className="font-black text-4xl rotate-12 text-slate-900">SICREDI</p></div>
                </div>
                <p className="text-3xl font-black text-slate-900 mb-2">R$ {pixCharge.valor_original.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                <p className="text-[10px] text-slate-400 font-bold mb-8 uppercase tracking-widest">TXID: {pixCharge.txid.substring(0, 15)}...</p>
                <button disabled={timeLeft === 'EXPIRADO'} onClick={() => { navigator.clipboard.writeText(pixCharge.qrcode_copia_cola); showToast('Copiado!', 'success'); }} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg mb-4 transition-all active:scale-95">Copiar Código PIX</button>
                <button onClick={() => setSelectedInvoice(null)} className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-bold">Fechar</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingPage;