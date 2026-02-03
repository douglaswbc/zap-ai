import React, { useState, useEffect, useCallback } from 'react';

// 1. Tipos de Notificação
export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
}

// 2. Hook para gerenciar a lógica do Toast
export const useToast = () => {
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    setToast({ message, type });
  }, []);

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  return { toast, showToast, hideToast };
};

// 3. Componente Visual do Toast
const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000); // Fecha automaticamente após 4 segundos

    return () => clearTimeout(timer);
  }, [onClose]);

  const styles = {
    success: 'bg-emerald-500 text-white',
    error: 'bg-rose-500 text-white',
    info: 'bg-indigo-600 text-white',
    warning: 'bg-amber-500 text-white',
  };

  return (
    <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-300 ${styles[type]}`}>
      <span className="text-sm font-bold tracking-wide">{message}</span>
      <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l18 18" />
        </svg>
      </button>
    </div>
  );
};

export default Toast;