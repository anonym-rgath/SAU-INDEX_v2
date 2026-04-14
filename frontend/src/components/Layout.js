import React from 'react';
import { Outlet } from 'react-router-dom';
import TopBar from './TopBar';
import DesktopSidebar from './DesktopSidebar';

const Layout = () => {
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 flex flex-col">
      <TopBar />
      <div className="flex flex-1">
        <DesktopSidebar />
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;