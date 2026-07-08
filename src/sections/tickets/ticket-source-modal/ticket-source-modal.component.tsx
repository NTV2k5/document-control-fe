import type { ITicketSourceModalProps } from '../ticket.type';
import { ETicketSource } from '../ticket.type';
import { X, Bot, FileText } from 'lucide-react';
import { mockChatTranscript } from '../ticket.mock';

const formatTime = (iso: string) => {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${min}`;
};

export const TicketSourceModal = ({ ticket, open, onClose }: ITicketSourceModalProps) => {
  if (!open || !ticket) return null;

  const isAIChatbot = ticket.source === ETicketSource.AI_CHATBOT;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            {isAIChatbot ? (
              <Bot className="size-5 text-purple-500" />
            ) : (
              <FileText className="size-5 text-blue-500" />
            )}
            <h3 className="text-sm font-bold text-slate-800">
              {isAIChatbot ? 'Hội thoại chatbot' : 'Phiếu thông tin văn bản'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto p-5">
          {isAIChatbot ? (
            /* AI Chatbot Transcript */
            <div className="space-y-3">
              <p className="mb-3 text-xs text-slate-400">
                Đoạn hội thoại giữa sinh viên và AI Chatbot trước khi ticket được tạo:
              </p>
              {mockChatTranscript.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
                    msg.role === 'bot' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
                  }`}>
                    {msg.role === 'bot' ? <Bot className="size-3.5" /> : <span className="text-[10px] font-bold">SV</span>}
                  </div>
                  <div className={`max-w-[80%] rounded-xl px-3 py-2 ${
                    msg.role === 'bot'
                      ? 'bg-slate-50 text-slate-700'
                      : 'bg-blue-600 text-white'
                  }`}>
                    <p className="text-xs leading-relaxed">{msg.content}</p>
                    <span className={`mt-1 block text-[10px] ${
                      msg.role === 'bot' ? 'text-slate-400' : 'text-blue-200'
                    }`}>
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Document form placeholder */
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-6 text-center">
              <FileText className="mx-auto mb-3 size-10 text-slate-300" />
              <h4 className="text-sm font-semibold text-slate-700">
                Phiếu thông tin văn bản: {ticket.documentCode || 'N/A'}
              </h4>
              <p className="mt-2 text-xs text-slate-400">
                Ticket được tạo trực tiếp từ form tạo ticket.
                {ticket.documentCode && (
                  <> Phiếu liên kết: <strong>{ticket.documentCode}</strong></>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-slate-100 px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
