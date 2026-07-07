import type { IMainLayoutProps } from '../layout.type';
import { useState } from 'react';
import { Header } from '../header';
import { Sidebar } from '../sidebar';

export const MainLayout = ({ children, routes }: IMainLayoutProps) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1 pt-16">
        <Sidebar routes={routes} isCollapsed={isSidebarCollapsed} onCollapsedChange={setIsSidebarCollapsed} />
        <main
          className={`flex-1 overflow-x-hidden bg-slate-100 transition-[margin] duration-300 ease-in-out ${
            isSidebarCollapsed ? 'ml-20' : 'ml-80'
          }`}>
          {children}
        </main>
      </div>
    </div>
  );
};
