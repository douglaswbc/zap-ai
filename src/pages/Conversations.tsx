import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/services/api';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/hooks/useAuth';
import { ToastType } from '@/components/Toast';
import MessageBubble from '@/components/MessageBubble';

interface ConversationsProps {
  showToast: (msg: string, type: ToastType) => void;
}

const ConversationsPage: React.FC<ConversationsProps> = ({ showToast }) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadConversations = async () => {
    if (!user?.id) return;
    try {
      setIsLoading(true);
      const data = await api.conversations.list(user);
      setConversations(data || []);

      if (selectedChat) {
        const updated = data.find((c: any) => c.id === selectedChat.id);
        if (updated) setSelectedChat(updated);
      }
    } catch (error) {
      console.error("Erro conversas:", error);
      showToast('Erro ao carregar conversas', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async (id: string) => {
    try {
      const data = await api.messages.list(id);
      setMessages(data);
    } catch (error) {
      showToast('Erro ao carregar histórico', 'error');
    }
  };

  useEffect(() => {
    if (user) {
      loadConversations();

      const channel = supabase
        .channel('chat_updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
          const newMsg = payload.new as any;
          setConversations(prev => prev.map(c =>
            c.id === newMsg.conversation_id
              ? { ...c, last_message: newMsg.content, last_timestamp: new Date().toISOString(), unread_count: (c.unread_count || 0) + (newMsg.sender === 'USER' && selectedChat?.id !== c.id ? 1 : 0) }
              : c
          ).sort((a, b) => new Date(b.last_timestamp).getTime() - new Date(a.last_timestamp).getTime()));

          if (selectedChat && newMsg.conversation_id === selectedChat.id) {
            loadMessages(selectedChat.id);
          }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, (payload) => {
          const updatedConv = payload.new as any;
          setConversations(prev => prev.map(c => c.id === updatedConv.id ? { ...c, ...updatedConv } : c));
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [user, selectedChat?.id]);

  useEffect(() => {
    if (selectedChat) {
      loadMessages(selectedChat.id);
      api.conversations.markAsRead(selectedChat.id);
      setConversations(prev => prev.map(c => c.id === selectedChat.id ? { ...c, unread_count: 0 } : c));
    }
  }, [selectedChat?.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat) return;

    const instanceName = selectedChat.instances?.name;
    if (!instanceName) {
      showToast('Instância não encontrada.', 'error');
      return;
    }

    try {
      await api.messages.send(instanceName, selectedChat.contacts.phone, newMessage, selectedChat.id);
      setNewMessage('');
    } catch (error: any) {
      showToast('Erro ao enviar mensagem.', 'error');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChat) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];
      const instanceName = selectedChat.instances?.name;

      try {
        await api.messages.sendMedia(
          instanceName,
          selectedChat.contacts.phone,
          base64,
          file.name,
          '',
          selectedChat.id
        );
        showToast('Mídia enviada!', 'success');
      } catch (error) {
        showToast('Erro ao enviar mídia.', 'error');
      }
    };
    reader.readAsDataURL(file);
  };

  const toggleAIStatus = async (activateHuman: boolean) => {
    if (!selectedChat) return;
    try {
      await api.conversations.updateMode(selectedChat.id, activateHuman);
      const msg = activateHuman ? 'IA pausada. Você assumiu.' : 'IA reativada com sucesso!';
      showToast(msg, activateHuman ? 'info' : 'success');
    } catch (error) {
      showToast('Erro ao alterar status do chat.', 'error');
    }
  };

  const handleResetChat = async () => {
    if (!selectedChat) return;
    const confirm = window.confirm("Limpar todo o histórico?");
    if (confirm) {
      try {
        await api.messages.resetChat(selectedChat.id);
        setMessages([]);
        showToast('Histórico removido!', 'success');
      } catch (error) {
        showToast('Erro ao resetar chat.', 'error');
      }
    }
  };

  const filteredConversations = conversations.filter(c =>
    (c.contacts?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.contacts?.phone || '').includes(searchTerm)
  );

  const formatMessageDate = (date: string) => {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'Hoje';
    if (d.toDateString() === yesterday.toDateString()) return 'Ontem';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
  };

  const groupedMessages = messages.reduce((groups: any, message: any) => {
    const date = formatMessageDate(message.timestamp);
    if (!groups[date]) groups[date] = [];
    groups[date].push(message);
    return groups;
  }, {});

  const canReset = ['admin', 'company'].includes(user?.role?.toLowerCase() || '');

  return (
    <div className="flex h-full overflow-hidden bg-white relative">

      {/* Sidebar Lateral */}
      <div className={`
        ${selectedChat ? 'hidden md:flex' : 'flex'} 
        w-full md:w-80 lg:w-96 bg-white border-r border-slate-200 flex-col shrink-0
      `}>
        <div className="p-6 border-b border-slate-100">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-slate-900">Conversas</h2>
            {isLoading && <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>}
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Buscar contato..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 px-4 py-2.5 rounded-xl text-sm outline-none border border-transparent focus:border-indigo-500 transition-all pl-10"
            />
            <svg className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
          {filteredConversations.length === 0 && !isLoading && (
            <div className="p-10 text-center text-slate-400 text-sm">Nenhuma conversa encontrada</div>
          )}

          {filteredConversations.map(chatItem => (
            <button
              key={chatItem.id}
              onClick={() => setSelectedChat(chatItem)}
              className={`w-full p-4 rounded-[1.5rem] flex items-center gap-4 transition-all ${selectedChat?.id === chatItem.id ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-50 text-slate-600'
                }`}
            >
              <div className="relative shrink-0">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold ${selectedChat?.id === chatItem.id ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-600'
                  }`}>
                  {chatItem.contacts?.name?.charAt(0) || '?'}
                </div>
                {chatItem.unread_count > 0 && selectedChat?.id !== chatItem.id && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full border-2 border-white flex items-center justify-center">
                    {chatItem.unread_count}
                  </div>
                )}
              </div>

              <div className="flex-1 text-left min-w-0">
                <div className="flex justify-between items-start">
                  <span className="font-bold truncate text-sm block">
                    {chatItem.contacts?.name || chatItem.contacts?.phone}
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase ${selectedChat?.id === chatItem.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'
                    }`}>
                    {chatItem.instances?.name || 'S/ Instância'}
                  </span>
                </div>
                <p className={`text-xs truncate font-medium ${selectedChat?.id === chatItem.id ? 'text-indigo-100' : 'text-slate-400'}`}>
                  {chatItem.last_message || 'Inicie a conversa...'}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Janela de Chat */}
      <div className={`
        ${selectedChat ? 'flex' : 'hidden md:flex'} 
        flex-1 flex flex-col bg-slate-50/50
      `}>
        {selectedChat ? (
          <>
            <div className="p-4 md:p-5 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm z-10">
              <div className="flex items-center gap-3 md:gap-4">
                <button onClick={() => setSelectedChat(null)} className="md:hidden p-2 -ml-2 text-slate-400 hover:text-indigo-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="w-10 h-10 bg-indigo-100 rounded-2xl flex items-center justify-center font-bold text-indigo-600 shrink-0">
                  {selectedChat.contacts?.name?.charAt(0) || '?'}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 leading-none mb-1 truncate">{selectedChat.contacts?.name}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {selectedChat.is_human_active ? '● Humano' : '● IA'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {canReset && (
                  <button onClick={handleResetChat} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
                <button onClick={() => toggleAIStatus(!selectedChat.is_human_active)}
                  className={`px-3 py-2 rounded-xl text-[10px] md:text-xs font-bold transition-all ${selectedChat.is_human_active ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-900 text-white'
                    }`}
                >
                  {selectedChat.is_human_active ? 'Reativar IA' : 'Assumir'}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
              {Object.entries(groupedMessages).map(([date, msgs]: any) => (
                <div key={date}>
                  <div className="flex justify-center my-6">
                    <span className="bg-slate-200/50 text-slate-500 text-[10px] font-bold uppercase px-3 py-1 rounded-full">
                      {date}
                    </span>
                  </div>
                  <div className="flex flex-col gap-4">
                    {msgs.map((m: any) => (
                      <MessageBubble
                        key={m.id}
                        message={{
                          ...m,
                          isMine: m.sender === 'AI' || m.sender === 'OPERATOR',
                          senderType: m.sender
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <div className="p-4 md:p-6 bg-white border-t border-slate-200">
              <form onSubmit={handleSend} className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-2xl transition-all shrink-0"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*,application/pdf" />

                <input
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  className="flex-1 bg-slate-50 px-6 py-4 rounded-2xl text-sm outline-none border border-transparent focus:border-indigo-500 focus:bg-white transition-all"
                  placeholder={selectedChat.is_human_active ? "Digite sua mensagem..." : "Assuma para responder"}
                />
                <button type="submit" disabled={!newMessage.trim()}
                  className="p-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 disabled:opacity-50 shadow-lg shrink-0"
                >
                  <svg className="w-6 h-6 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="hidden md:flex flex-1 flex-col items-center justify-center">
            <div className="w-20 h-20 bg-slate-100 rounded-[2rem] flex items-center justify-center text-slate-300 mb-4">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8s-9-3.582-9-8z" />
              </svg>
            </div>
            <p className="text-slate-400 font-bold">Selecione uma conversa</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationsPage;