import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Instance } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { ToastType } from '@/components/Toast';
import InstanceCard from '@/components/InstanceCard';

interface InstancesPageProps {
  showToast: (msg: string, type: ToastType) => void;
}

const InstancesPage: React.FC<InstancesPageProps> = ({ showToast }) => {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [qrModal, setQrModal] = useState<Instance | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // 1. Função utilitária para gerar o sufixo (coloque fora ou dentro do componente)
  const generateRandomHash = () => Math.random().toString(36).substring(2, 10);

  // Novo estado agrupado para o formulário de criação
  const [formData, setFormData] = useState({
    name: '',
    proxyHost: '',
    proxyPort: '',
    proxyProtocol: 'http',
    proxyUsername: '',
    proxyPassword: ''
  });

  const { user } = useAuth();

  const loadData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [instancesData, agentsData] = await Promise.all([
        api.instances.list(user),
        api.agents.list(user)
      ]);
      setInstances(instancesData);
      setAgents(agentsData);
    } catch (error) {
      showToast('Erro ao carregar dados', 'error');
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  // Polling para verificar conexão do QR Code
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (qrModal) {
      interval = setInterval(async () => {
        try {
          const isConnected = await api.instances.checkStatus(qrModal.name);
          if (isConnected === 'open') {
            showToast('WhatsApp conectado com sucesso!', 'success');
            setQrModal(null);
            await loadData(true);
            clearInterval(interval);
          }
        } catch (err) {
          console.error("Erro no polling:", err);
        }
      }, 5000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [qrModal]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !user) return;

    // Gerar o nome final com o hash de 8 caracteres
    const finalName = `${formData.name.trim().replace(/\s+/g, '_')}_${generateRandomHash()}`;

    showToast('Criando instância...', 'info');
    try {
      // Enviamos o finalName (com hash) para a API
      await api.instances.create(finalName, user);

      showToast('Instância criada com sucesso!', 'success');
      setIsAdding(false);
      setFormData({ name: '', proxyHost: '', proxyPort: '', proxyProtocol: 'http', proxyUsername: '', proxyPassword: '' });
      await loadData();
    } catch (error) {
      showToast('Erro ao criar instância', 'error');
    }
  };

  // Funções handleConnect, handleDelete, handleLogout e handleRestart permanecem as mesmas...
  const handleConnect = async (instance: Instance) => {
    showToast('Gerando QR Code...', 'info');
    try {
      const qr = await api.instances.connect(instance.name);
      if (!qr) {
        showToast('A instância já pode estar conectada.', 'warning');
        return;
      }
      setQrModal({ ...instance, qrCode: qr });
    } catch (error: any) {
      showToast(`Erro: ${error.message || 'Falha ao gerar QR'}`, 'error');
    }
  };

  const handleDelete = async (name: string) => {
    if (confirm(`Deseja deletar permanentemente a instância ${name}?`)) {
      try {
        await api.instances.delete(name);
        setInstances(prev => prev.filter(i => i.name !== name));
        showToast('Instância removida.', 'success');
      } catch (error) { showToast('Erro ao deletar', 'error'); }
    }
  };

  const handleLogout = async (name: string) => {
    if (confirm('Deseja desconectar o WhatsApp?')) {
      try {
        await api.instances.logout(name);
        // Atualização otimista
        setInstances(prev => prev.map(inst => inst.name === name ? { ...inst, status: 'close' } : inst));
        showToast('Desconectado', 'success');
        // Refresh silencioso após delay
        setTimeout(() => loadData(true), 2000);
      } catch (error) { showToast('Erro ao desconectar', 'error'); }
    }
  };

  const handleRestart = async (name: string) => {
    showToast('Reiniciando...', 'info');
    try {
      await api.instances.restart(name);
      setTimeout(loadData, 3000);
    } catch (error) { showToast('Erro ao reiniciar', 'error'); }
  };

  const handleUpdateAgent = async (name: string, agentId: string | null) => {
    try {
      await api.instances.updateAgent(name, agentId);
      setInstances(prev => prev.map(i => i.name === name ? { ...i, agent_id: agentId || undefined } : i));
      showToast('Agente atualizado na instância.', 'success');
    } catch (error) {
      showToast('Erro ao vincular agente', 'error');
    }
  };

  if (isLoading && instances.length === 0) {
    return (
      <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-64 bg-slate-200 animate-pulse rounded-[2rem]"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-8 h-full overflow-y-auto custom-scrollbar">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {instances.map(inst => (
          <InstanceCard
            key={inst.id}
            instance={inst}
            agents={agents}
            onDelete={handleDelete}
            onRestart={handleRestart}
            onConnect={handleConnect}
            onLogout={handleLogout}
            onUpdateAgent={handleUpdateAgent}
          />
        ))}

        <button
          onClick={() => setIsAdding(true)}
          className="h-full min-h-[16rem] bg-indigo-50/50 border-2 border-dashed border-indigo-200 rounded-[2rem] flex flex-col items-center justify-center gap-4 text-indigo-400 hover:bg-indigo-50 hover:border-indigo-300 transition-all group"
        >
          <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
          </div>
          <span className="font-bold">Nova Instância</span>
        </button>
      </div>

      {/* Modal de Criação com Proxy */}
      {isAdding && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-6">
          <div className="bg-white w-full max-w-xl rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">

            {/* Header Fixo */}
            <div className="p-6 sm:p-10 pb-0">
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">Configurar Instância</h3>
              <p className="text-sm text-slate-500">O sistema gerará um ID único para evitar duplicidade.</p>
            </div>

            {/* Área com Scroll Responsiva */}
            <form onSubmit={handleCreate} className="p-6 sm:p-10 pt-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">

              <div>
                <label className="block text-[10px] sm:text-xs font-bold text-slate-400 uppercase mb-2 ml-1 tracking-widest">Identificação Principal</label>
                <input
                  autoFocus
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 transition-all font-medium text-slate-700"
                  placeholder="Ex: Comercial"
                />
              </div>

              <div className="pt-2">
                <label className="block text-[10px] sm:text-xs font-bold text-slate-400 uppercase mb-4 ml-1 tracking-widest">Configurações de Proxy (Opcional)</label>

                {/* Grid Responsiva: 1 coluna no mobile, 2 no desktop */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2 lg:col-span-1">
                    <input
                      type="text"
                      value={formData.proxyHost}
                      onChange={(e) => setFormData({ ...formData, proxyHost: e.target.value })}
                      className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 text-sm"
                      placeholder="Host (Ex: 127.0.0.1)"
                    />
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formData.proxyPort}
                      onChange={(e) => setFormData({ ...formData, proxyPort: e.target.value })}
                      className="w-2/3 px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 text-sm"
                      placeholder="Porta"
                    />
                    <select
                      value={formData.proxyProtocol}
                      onChange={(e) => setFormData({ ...formData, proxyProtocol: e.target.value })}
                      className="w-1/3 px-3 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 text-xs font-bold text-slate-500"
                    >
                      <option value="http">HTTP</option>
                      <option value="https">HTTPS</option>
                    </select>
                  </div>

                  <input
                    type="text"
                    value={formData.proxyUsername}
                    onChange={(e) => setFormData({ ...formData, proxyUsername: e.target.value })}
                    className="px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 text-sm"
                    placeholder="Usuário Proxy"
                  />
                  <input
                    type="password"
                    value={formData.proxyPassword}
                    onChange={(e) => setFormData({ ...formData, proxyPassword: e.target.value })}
                    className="px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 text-sm"
                    placeholder="Senha Proxy"
                  />
                </div>
              </div>
            </form>

            {/* Footer Fixo com Botões */}
            <div className="p-6 sm:p-10 pt-4 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="order-2 sm:order-1 flex-1 py-4 font-bold text-slate-400 hover:text-slate-600 transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                onClick={handleCreate}
                className="order-1 sm:order-2 flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 active:scale-95 transition-all text-sm"
              >
                Criar Instância
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal QR Code permanece o mesmo... */}
      {qrModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-10 flex flex-col items-center">
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Pareamento</h3>
            <p className="text-slate-500 text-sm mb-8 text-center">Escaneie o código com seu WhatsApp.</p>
            <div className="w-64 h-64 bg-slate-50 p-4 rounded-3xl border border-slate-100 mb-8 flex items-center justify-center">
              {qrModal.qrCode ? (
                <img
                  src={qrModal.qrCode.startsWith('data:') ? qrModal.qrCode : `data:image/png;base64,${qrModal.qrCode}`}
                  className="w-full h-full object-contain"
                  alt="QR Code"
                />
              ) : (
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              )}
            </div>
            <button onClick={() => setQrModal(null)} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold">Fechar Janela</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InstancesPage;