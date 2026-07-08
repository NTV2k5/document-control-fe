import { Bot } from 'lucide-react';

export const ChatbotButton = () => {
  return (
    <button
      type="button"
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-600/30 transition-transform hover:scale-110 active:scale-95"
      aria-label="AI Chat Assistant"
    >
      <Bot className="h-7 w-7" />
    </button>
  );
};
