import React, { useState } from 'react';
import {
  ArrowLeft,
  Send
} from 'lucide-react';
import { ChatMessage } from '../types';

interface MessagesViewProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onBack: () => void;
}

export const MessagesView: React.FC<MessagesViewProps> = ({
  messages,
  onSendMessage,
  onBack
}) => {
  const [inputText, setInputText] = useState('');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  return (
    <div className="min-h-screen bg-[#F5F8FD] pb-24 md:pb-12 flex flex-col">
      {/* Top Header */}
      <div className="sticky top-16 z-30 bg-white border-b border-[#DFE7F1] px-4 sm:px-6 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-1 rounded-lg text-slate-600 hover:text-[#14243B] transition"
              aria-label="Назад"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#1769F4] text-white flex items-center justify-center font-bold text-xs">
                ОК
              </div>
              <div>
                <h1 className="text-sm font-bold text-[#14243B]">Олександр (Toyota Camry)</h1>
                <p className="text-[11px] text-emerald-600 font-medium">Онлайн · Запит Одеса → Київ</p>
              </div>
            </div>
          </div>
          <span className="text-xs text-slate-400 font-semibold">Безпечний чат</span>
        </div>
      </div>

      {/* Messages Stream */}
      <div className="max-w-2xl mx-auto w-full flex-1 p-4 sm:p-6 space-y-4 overflow-y-auto">
        {messages.map((msg) => {
          const isSystem = msg.isSystemEvent;
          const isMe = msg.senderName === 'Анна' || msg.senderName === 'Дмитро' || msg.senderId === 'usr_me_01';

          if (isSystem) {
            return (
              <div key={msg.id} className="text-center my-2">
                <span className="inline-block px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
                  {msg.text}
                </span>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
            >
              <div className="text-[10px] text-slate-400 px-1 mb-0.5">{msg.senderName} · {msg.timestamp}</div>

              {/* Chat bubble */}
              <div
                className={`max-w-[85%] sm:max-w-md p-3.5 rounded-2xl text-xs space-y-2 ${
                  isMe
                    ? 'bg-[#1769F4] text-white rounded-tr-xs shadow-sm'
                    : 'bg-white text-[#14243B] border border-slate-200 rounded-tl-xs shadow-sm'
                }`}
              >
                <p className="leading-relaxed">{msg.text}</p>

                {/* Structured proposal revision card if attached */}
                {msg.proposalCard && (
                  <div className={`p-2.5 rounded-xl border text-xs ${
                    isMe
                      ? 'bg-blue-600/40 border-blue-400 text-white'
                      : 'bg-slate-50 border-slate-200 text-[#14243B]'
                  }`}>
                    <div className="flex items-center justify-between font-bold">
                      <span>Офіційна пропозиція ціни:</span>
                      <span className="text-sm tabular-nums">{msg.proposalCard.amount} грн</span>
                    </div>
                    <div className="text-[10px] opacity-80 mt-0.5">
                      Статус: {msg.proposalCard.status === 'active' ? 'Очікує рішення' : msg.proposalCard.status}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Message Input Bar */}
      <div className="sticky bottom-16 md:bottom-0 bg-white border-t border-[#DFE7F1] p-3 sm:p-4">
        <form onSubmit={handleSend} className="max-w-2xl mx-auto flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Введіть повідомлення водієві..."
            className="flex-1 p-3 rounded-xl border border-slate-300 text-xs bg-[#F5F8FD] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1769F4]"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-3 rounded-xl bg-[#1769F4] text-white hover:bg-[#1358CE] disabled:opacity-50 transition active:scale-95 shrink-0"
            aria-label="Надіслати"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
