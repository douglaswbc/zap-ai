import React from 'react';
import { User } from '../types';

interface TopbarProps {
  user: User;
  title: string;
  onOpenMenu?: () => void; // Propriedade para abrir o menu no mobile
}

const Topbar: React.FC<TopbarProps> = ({ user, title, onOpenMenu }) => {
  return (
    // Adicionado w-full e altura/padding responsivos (h-16 no mobile, h-20 no desktop)
    <header className="w-full h-16 sm:h-20 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between shrink-0 z-10">
      
      <div className="flex items-center gap-4">
        {/* Botão Hambúrguer integrado ao Topbar para melhor alinhamento responsivo */}
        {onOpenMenu && (
          <button 
            onClick={onOpenMenu}
            className="p-2 lg:hidden text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}

        {/* Título com tamanho de fonte responsivo */}
        <h2 key={title} className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight animate-in slide-in-from-left-2 duration-300 truncate max-w-[150px] sm:max-w-none">
          {title}
        </h2>
      </div>
      
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Botão de Notificações (escondido em telas muito pequenas para evitar quebra) */}
        <button className="hidden xs:flex p-2 sm:p-2.5 text-slate-400 hover:bg-slate-50 hover:text-indigo-600 rounded-xl transition-all relative group">
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="absolute top-2 sm:top-2.5 right-2 sm:right-2.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white ring-1 ring-rose-500/20"></span>
        </button>
        
        <div className="h-8 w-[1px] bg-slate-200 mx-1 hidden sm:block"></div>
        
        <div className="flex items-center gap-2 sm:gap-4 pl-0 sm:pl-2">
          <div className="text-right hidden md:block">
            <p className="text-sm font-bold text-slate-900 leading-tight">{user.name}</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{user.role}</p>
          </div>
          
          <div className="relative">
            <div className="w-9 h-9 sm:w-11 sm:h-11 bg-indigo-600 rounded-xl sm:rounded-2xl flex items-center justify-center text-white font-black text-xs sm:text-sm shadow-lg shadow-indigo-600/20 border-2 border-white overflow-hidden uppercase">
              {user.name.charAt(0)}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 sm:w-3.5 sm:h-3.5 bg-emerald-500 border-2 border-white rounded-full shadow-sm"></div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Topbar;