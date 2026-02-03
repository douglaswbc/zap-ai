import React, { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/services/supabase'; //
import { ToastType } from '@/components/Toast'; //

interface GoogleCallbackProps {
  showToast: (msg: string, type: ToastType) => void;
}

const GoogleCallback: React.FC<GoogleCallbackProps> = ({ showToast }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const calledRef = useRef(false); // Evita chamadas duplicadas causadas pelo React Strict Mode

  useEffect(() => {
    const code = searchParams.get('code');
    const userId = searchParams.get('state');

    // Impede que a função execute duas vezes seguidas
    if (calledRef.current) return;

    if (code && userId) {
      calledRef.current = true;

      const finishAuth = async () => {
        try {
          // Invoca a Edge Function para trocar o código pelos tokens
          const { error } = await supabase.functions.invoke('google-auth', {
            body: { code, userId }
          });

          if (error) {
            throw error;
          }

          showToast('Agenda Google conectada com sucesso!', 'success');
          
          /**
           * IMPORTANTE: Usamos window.location.href em vez de navigate.
           * Isso força um recarregamento completo da aplicação, garantindo que o 
           * hook useAuth busque os dados atualizados do perfil (google_connected: true)
           * diretamente do banco de dados.
           */
          window.location.href = '/settings'; 
        } catch (err: any) {
          console.error('Erro na autenticação Google:', err);
          showToast('Falha ao conectar com o Google.', 'error');
          navigate('/settings');
        }
      };

      finishAuth();
    } else if (searchParams.has('error')) {
      // Trata caso o usuário cancele a autorização no Google
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