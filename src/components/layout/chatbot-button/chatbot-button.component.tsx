import { Bot } from 'lucide-react';
import { useState } from 'react';

export const ChatbotButton = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setIsOpen(!isOpen)}
      className="fixed right-6 bottom-6 z-50 flex h-14 w-14 items-center justify-center rounded-[18px] bg-blue-600 text-white shadow-lg shadow-blue-500/25 transition-transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
      aria-label="AI Chatbot"
    >
      <Bot className="h-6 w-6" />
    </button>
  );
};
