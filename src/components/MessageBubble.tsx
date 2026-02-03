import React from 'react';

interface MessageBubbleProps {
  message: {
    content: string;
    isMine: boolean;
    senderType: 'USER' | 'AI' | 'OPERATOR' | 'SYSTEM';
    timestamp: string;
  };
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isMine = message.isMine;

  // Lógica para detectar mídias
  const isAudio = message.content?.includes('[Transcrição de Áudio]') || message.content?.includes('[Áudio]');
  const isImage = message.content?.includes('[Análise de Imagem]') || message.content?.includes('[Imagem]');
  const isDocument = message.content?.toLowerCase().includes('.pdf') || message.content?.includes('[Arquivo PDF]');

  // Limpa o prefixo
  const cleanContent = message.content
    ?.replace('[Transcrição de Áudio]: ', '')
    ?.replace('[Análise de Áudio]: ', '')
    ?.replace('[Análise de Imagem]: ', '')
    ?.replace('[Imagem]: ', '')
    ?.replace('[Arquivo PDF]: ', '');

  const renderMediaTag = () => {
    if (isAudio) return (
      <div className={`flex items-center gap-2 mb-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter ${isMine ? 'bg-white/10 text-indigo-100' : 'bg-slate-100 text-slate-400'}`}>
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" /></svg>
        Áudio Transcrito
      </div>
    );
    if (isImage) return (
      <div className={`flex items-center gap-2 mb-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter ${isMine ? 'bg-white/10 text-indigo-100' : 'bg-slate-100 text-slate-400'}`}>
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" /></svg>
        Mídia Visual
      </div>
    );
    if (isDocument) return (
      <div className={`flex items-center gap-2 mb-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter ${isMine ? 'bg-white/10 text-indigo-100' : 'bg-rose-50 text-rose-500'}`}>
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" /></svg>
        Documento PDF
      </div>
    );
    return null;
  };

  return (
    <div className={`flex w-full mb-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] md:max-w-[70%] px-4 py-3 rounded-[1.5rem] shadow-sm transition-all ${isMine
          ? 'bg-indigo-600 text-white rounded-tr-none'
          : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'
        }`}>

        <div className={`text-[9px] font-black uppercase mb-1 flex items-center gap-1.5 opacity-50 ${isMine ? 'justify-end' : 'justify-start'}`}>
          {message.senderType === 'AI' ? 'IA' : message.senderType === 'OPERATOR' ? 'Você' : 'Cliente'}
        </div>

        <div className="flex flex-col">
          {renderMediaTag()}
          <p className={`text-sm leading-relaxed ${isAudio ? 'italic' : ''} break-words`}>
            {cleanContent}
          </p>
        </div>

        <div className={`text-[8px] mt-1.5 font-bold opacity-30 ${isMine ? 'text-left' : 'text-right'}`}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;