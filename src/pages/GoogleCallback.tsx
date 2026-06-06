import React, { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { ToastType } from '@/components/Toast';

interface GoogleCallbackProps {
  showToast: (msg: string, type: ToastType) => void;
}

const GoogleCallback: React.FC<GoogleCallbackProps> = ({ showToast }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const calledRef = useRef(false);

  useEffect(() => {
    const code = searchParams.get('code');
    // Em modo desenvolvimento, o redirect_uri deve ser exatamente o mesmo usado no início do fluxo
    const redirectUri = window.location.origin + '/google-callback';

    if (calledRef.current) return;

    if (code) {
      calledRef.current = true;

      const finishAuth = async () => {
        try {
          const { data, error } = await supabase.functions.invoke('google-auth', {
            body: { code, redirectUri }
          });

          if (error || data?.error) {
            throw new Error(error?.message || data?.error || 'Erro na troca de tokens');
          }

          showToast('Agenda Google conectada com sucesso!', 'success');
          window.location.href = '/settings'; 
        } catch (err: any) {
          console.error('Erro na autenticação Google:', err);
          showToast('Falha ao conectar com o Google: ' + err.message, 'error');
          navigate('/settings');
        }
      };

      finishAuth();
    } else if (searchParams.has('error')) {
      showToast('Acesso ao Google negado pelo usuário.', 'info');
      navigate('/settings');
    }
  }, [searchParams, navigate, showToast]);

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-white">
      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4 text-indigo-600"></div>
      <p className="text-slate-600 font-bold animate-pulse text-sm">
        Sincronizando com o Google Calendar...
      </p>
    </div>
  );
};

export default GoogleCallback;