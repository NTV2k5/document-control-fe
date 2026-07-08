import type { IMainLayoutProps } from '../layout.type';
import { useState } from 'react';
import { Header } from '../header';
import { Sidebar } from '../sidebar';
import { ChatbotButton } from '../chatbot-button';

export const MainLayout = ({ children, routes }: IMainLayoutProps) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#F4F7FE]">
      <Sidebar
        routes={routes}
        isCollapsed={isSidebarCollapsed}
        onCollapsedChange={setIsSidebarCollapsed}
      />
      {/* Main content shifts right based on sidebar width */}
      <div
        className={`flex flex-1 flex-col transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? 'ml-[72px]' : 'ml-64'
        }`}
      >
        <Header />
        {/* Header is h-16 (search row) + ~40px (hashtag row) ≈ 104px, but it's sticky so main scrolls beneath */}
        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto max-w-screen-2xl px-6 py-6">
            {children}
          </div>
        </main>
        <ChatbotButton />
      </div>
    </div>
  );
};
