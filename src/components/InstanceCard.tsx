import React from 'react';
import { Instance } from '../types';

const InstanceCard: React.FC<InstanceCardProps> = ({ instance, onConnect, onRestart, onDelete, onLogout }) => {
  const isConnected = instance.status === 'open';

  // Componente de Badge de Status (mesmo de antes)
  const StatusBadge = ({ status }: { status: string }) => {
    const config: Record<string, any> = {
      'open': { label: 'Conectado', color: 'bg-emerald-100 text-emerald-700', icon: 'bg-emerald-500' },
      'close': { label: 'Desconectado', color: 'bg-rose-100 text-rose-700', icon: 'bg-rose-500' },
    };
    const style = config[status] || config['close'];
    return (
      <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${style.color}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${style.icon} ${isConnected ? 'animate-pulse' : ''}`}></span>
        {style.label}
      </span>
    );
  };

  return (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all group">
      <div className="flex justify-between items-start mb-4">
        {/* Espaço da Foto de Perfil ou Ícone */}
        <div className={`w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center transition-all ${isConnected ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500'}`}>
          {instance.profilePicUrl ? (
            <img 
              src={instance.profilePicUrl} 
              alt={instance.name} 
              className="w-full h-full object-cover"
              onError={(e) => {
                // Se a imagem falhar (link expirado da API), volta para o ícone
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          )}
        </div>
        <StatusBadge status={instance.status} />
      </div>

      <h3 className="text-xl font-bold text-slate-900 mb-1">{instance.name}</h3>
      <p className="text-slate-400 text-sm mb-6 font-medium">
        {instance.phoneNumber || 'Número não vinculado'}
      </p>

      {/* Botões de Ação (mesmos de antes) */}
      <div className="flex flex-col gap-2 mt-4">
        {!isConnected ? (
          <button onClick={() => onConnect(instance)} className="w-full bg-indigo-600 text-white hover:bg-indigo-700 py-3.5 rounded-2xl font-bold text-xs shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2">
            Conectar WhatsApp
          </button>
        ) : (
          <button onClick={() => onLogout(instance.name)} className="w-full bg-rose-50 text-rose-600 hover:bg-rose-100 py-3.5 rounded-2xl font-bold text-xs flex items-center justify-center gap-2">
            Desconectar Instância
          </button>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => onRestart(instance.name)} className="bg-slate-50 text-slate-600 py-3 rounded-2xl font-bold text-[10px] uppercase">Reiniciar</button>
          <button onClick={() => onDelete(instance.name)} className="bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-rose-50 py-3 rounded-2xl font-bold text-[10px] uppercase">Excluir</button>
        </div>
      </div>
    </div>
  );
};

export default InstanceCard;