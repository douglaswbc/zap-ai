import { useEffect } from 'react';
import { supabase } from '@/services/supabase';
import { ToastType } from './Toast';

interface NotificationListenerProps {
  showToast: (msg: string, type: ToastType) => void;
}

const NotificationListener: React.FC<NotificationListenerProps> = ({ showToast }) => {
  useEffect(() => {
    // 1. Criamos um canal para ouvir inserções na tabela 'messages'
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          // 2. Quando uma mensagem chega, buscamos o nome do contato para a notificação
          const newMessage = payload.new;
          
          // Buscamos detalhes da conversa para saber quem enviou
          const { data: convData } = await supabase
            .from('conversations')
            .select('contacts(name)')
            .eq('id', newMessage.conversation_id)
            .single();

          const contactName = convData?.contacts?.name || 'Novo Contato';

          // 3. Exibimos a notificação apenas se a mensagem NÃO for do operador
          if (newMessage.sender === 'USER') {
            showToast(`📩 ${contactName}: ${newMessage.content}`, 'info');
            
            // Opcional: Tocar um som de notificação
            const audio = new Audio('/notification-sound.mp3');
            audio.play().catch(() => {}); // Ignora erro se o browser bloquear som sem interação
          }
        }
      )
      .subscribe();

    // Limpeza ao desmontar o componente
    return () => {
      supabase.removeChannel(channel);
    };
  }, [showToast]);

  return null; // Este componente apenas executa a lógica em background
};

export default NotificationListener;