import React, { useState } from 'react';
import { User } from '../types';
import { ToastType } from '../components/Toast';
import { supabase } from '../services/supabase';

interface LoginProps {
  onLogin: (user: User) => void;
  showToast: (msg: string, type: ToastType) => void;
}

// Componente separado para o formulário de login
const LoginForm: React.FC<{
  onLogin: (user: User) => void;
  showToast: (msg: string, type: ToastType) => void;
}> = ({ onLogin, showToast }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Manipula o envio do formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        showToast(error.message, 'error');
      } else if (data.user) {
        await onLogin({
          id: data.user.id,
          email: data.user.email || '',
          name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'Usuário',
        });
      }
    } catch (err) {
      showToast('Erro inesperado ao autenticar.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" autoComplete="on">
      <div className="space-y-2">
        <label htmlFor="email" className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">E-mail</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white outline-none transition-all placeholder:text-slate-400 font-medium"
          placeholder="nome@empresa.com"
          autoComplete="email"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Senha</label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-5 py-4 pr-14 rounded-2xl bg-slate-50 border border-slate-100 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white outline-none transition-all placeholder:text-slate-400 font-medium"
            placeholder="••••••••"
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-indigo-600 transition-colors"
            aria-label={showPassword ? 'Esconder senha' : 'Mostrar senha'}
            tabIndex={-1}
          >
            {showPassword ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
      </div>
      <button
        type="submit"
        disabled={isLoading}
        className={`w-full py-5 rounded-2xl text-white font-bold text-lg shadow-2xl shadow-indigo-600/30 transition-all ${
          isLoading ? 'bg-slate-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.97]'
        }`}
      >
        {isLoading ? 'Autenticando...' : 'Entrar no Dashboard'}
      </button>
    </form>
  );
};

// Componente principal da página de login
const LoginPage: React.FC<LoginProps> = ({ onLogin, showToast }) => {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200">
        <div className="p-12">
          <div className="flex flex-col items-center mb-10">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-lg mb-6">Z</div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight text-center leading-tight">Plataforma ZapAI</h1>
            <p className="text-slate-400 mt-2 font-medium">Gestão inteligente de WhatsApp</p>
          </div>
          <LoginForm onLogin={onLogin} showToast={showToast} />
        </div>
      </div>
      <p className="mt-8 text-slate-500 text-xs font-bold uppercase tracking-[0.2em]">ZapAI Pro v2.4.0</p>
    </div>
  );
};

export default LoginPage;