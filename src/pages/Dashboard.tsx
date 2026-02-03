import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Instance } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { ToastType } from '@/components/Toast';

interface DashboardProps {
  showToast: (msg: string, type: ToastType) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ showToast }) => {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [qrModal, setQrModal] = useState<Instance | null>(null);
  const { user } = useAuth();

  // Função para carregar dados reais da API
  const loadInstances = async () => {
    setIsLoading(true);
    try {
      const data = await api.instances.list();
      setInstances(data);
    } catch (error) {
      showToast('Erro ao carregar instâncias reais', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInstances();
  }, []);

  const handleDelete = async (name: string) => {
    if (confirm(`Deseja deletar a instância ${name}?`)) {
      try {
        await api.instances.delete(name);
        setInstances(prev => prev.filter(i => i.name !== name));
        showToast('Instância removida.', 'success');
      } catch (error) {
        showToast('Erro ao deletar', 'error');
      }
    }
  };

  const handleRestart = async (name: string) => {
    showToast('Reiniciando...', 'info');
    try {
      await api.instances.restart(name);
      setTimeout(loadInstances, 3000);
    } catch (error) {
      showToast('Erro ao reiniciar', 'error');
    }
  };

  // StatusBadge agora usa as strings da Evolution API
  const StatusBadge = ({ status }: { status: string }) => {
    const config: Record<string, any> = {
      'open': { label: 'Conectado', color: 'bg-emerald-100 text-emerald-700', icon: 'bg-emerald-500' },
      'connecting': { label: 'Aguardando QR', color: 'bg-amber-100 text-amber-700', icon: 'bg-amber-500' },
      'close': { label: 'Desconectado', color: 'bg-rose-100 text-rose-700', icon: 'bg-rose-500' },
    };

    const style = config[status] || config['close'];

    return (
      <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${style.color}`}>
        <span className={`w-2 h-2 rounded-full ${style.icon} ${status === 'open' ? 'animate-pulse' : ''}`}></span>
        {style.label}
      </span>
    );
  };

  if (isLoading && instances.length === 0) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto w-full overflow-y-auto h-full custom-scrollbar">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Dashboard de Instâncias</h1>
          <p className="text-slate-500 mt-1">Status em tempo real das suas conexões</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {instances.map((instance) => (
          <div key={instance.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl transition-all group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-indigo-50 transition-colors">
                <svg className="w-8 h-8 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
              </div>
              <StatusBadge status={instance.status} />
            </div>

            <h3 className="text-xl font-bold text-slate-900 mb-1">{instance.name}</h3>
            <p className="text-slate-400 text-sm mb-6 flex items-center gap-1">
              {instance.phoneNumber || 'Número não vinculado'}
            </p>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <button 
                onClick={() => handleRestart(instance.name)}
                className="bg-slate-100 text-slate-600 hover:bg-slate-200 py-3 rounded-xl font-bold text-sm transition-colors"
              >
                Reiniciar
              </button>
              <button 
                onClick={() => handleDelete(instance.name)}
                className="bg-rose-50 text-rose-600 hover:bg-rose-100 py-3 rounded-xl font-bold text-sm transition-colors"
              >
                Deletar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;