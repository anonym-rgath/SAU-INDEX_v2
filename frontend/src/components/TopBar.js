import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Menu, X, LayoutDashboard, Receipt, Users, Tag, BarChart4, User, Key, Shield, ShieldCheck, CalendarDays, ChevronDown, SlidersHorizontal, UserCircle } from 'lucide-react';
import { Button } from './ui/button';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import ChangePasswordDialog from './ChangePasswordDialog';

const TopBar = () => {
  const { logout, isAdmin, isMitglied, canSeeAdvancedStats, canManageMembers, canManageFineTypes, canSeeAllFines, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [verwaltungOpen, setVerwaltungOpen] = useState(() => {
    const verwaltPaths = ['/members', '/fine-types', '/audit', '/settings'];
    return verwaltPaths.includes(window.location.pathname);
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Top-level items (sichtbar für alle)
  const topNavItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/calendar', icon: CalendarDays, label: 'Termine' },
    { path: '/fines', icon: Receipt, label: 'Strafenübersicht' },
    canSeeAdvancedStats && { path: '/statistics-advanced', icon: BarChart4, label: 'Statistiken (Erweitert)' },
  ].filter(Boolean);

  // Administration sub-items
  const verwaltungItems = [
    { path: '/profile', icon: UserCircle, label: 'Profil' },
    canManageMembers && { path: '/roles', icon: ShieldCheck, label: 'Benutzerrollen' },
    canManageMembers && { path: '/members', icon: Users, label: 'Benutzerverwaltung' },
    canManageFineTypes && { path: '/fine-types', icon: Tag, label: 'Strafenarten' },
    canManageMembers && { path: '/audit', icon: Shield, label: 'Audit-Log' },
    { path: '/settings', icon: SlidersHorizontal, label: 'Einstellungen' },
  ].filter(Boolean);

  const verwaltungPaths = verwaltungItems.map(i => i.path);
  const isVerwaltungActive = verwaltungPaths.includes(location.pathname);

  const handleNavClick = (path) => {
    navigate(path);
    setDrawerOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-stone-900/80 backdrop-blur-md border-b border-stone-100 dark:border-stone-800 h-14 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Button
            data-testid="menu-button"
            onClick={() => setDrawerOpen(!drawerOpen)}
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg"
          >
            <Menu className="w-5 h-5" />
          </Button>
          
          <div className="flex items-center gap-2">
            <img 
              src="/logo.png" 
              alt="Rheinzelmänner" 
              className="w-8 h-8 object-contain"
            />
            <div>
              <h2 className="font-bold text-base text-stone-900 dark:text-stone-100 leading-none">Rheinzelmänner</h2>
            </div>
          </div>
        </div>
      </header>

      {/* Drawer Overlay */}
      {drawerOpen && (
        <div
          data-testid="drawer-overlay"
          className="fixed inset-0 bg-black/40 z-40 animate-in fade-in duration-200"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        data-testid="navigation-drawer"
        className={cn(
          "fixed top-0 left-0 h-full w-64 sm:w-72 bg-white dark:bg-stone-900 z-50 shadow-2xl transform transition-transform duration-300 ease-out",
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Drawer Header */}
          <div className="flex items-center justify-between p-4 border-b border-stone-200 dark:border-stone-700">
            <div className="flex items-center gap-2">
              <img 
                src="/logo.png" 
                alt="Rheinzelmänner" 
                className="w-10 h-10 object-contain"
              />
              <div>
                <h2 className="font-bold text-lg text-stone-900 dark:text-stone-100">Rheinzelmänner</h2>
              </div>
            </div>
            <Button
              data-testid="close-drawer-button"
              onClick={() => setDrawerOpen(false)}
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 p-4 overflow-y-auto">
            <ul className="space-y-1">
              {topNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <li key={item.path}>
                    <button
                      data-testid={`drawer-nav-${item.path.slice(1)}`}
                      onClick={() => handleNavClick(item.path)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left min-h-[48px]",
                        isActive
                          ? "bg-emerald-50 text-emerald-700 font-semibold dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 active:bg-stone-100"
                      )}
                    >
                      <Icon className={cn("w-5 h-5", isActive && "stroke-[2.5]")} />
                      <span className="text-base">{item.label}</span>
                    </button>
                  </li>
                );
              })}

              {/* Verwaltung Group */}
              {verwaltungItems.length > 0 && (
                <li>
                  <button
                    data-testid="drawer-nav-verwaltung"
                    onClick={() => setVerwaltungOpen(!verwaltungOpen)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left min-h-[48px]",
                      isVerwaltungActive
                        ? "bg-emerald-50 text-emerald-700 font-semibold dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 active:bg-stone-100"
                    )}
                  >
                    <SlidersHorizontal className={cn("w-5 h-5", isVerwaltungActive && "stroke-[2.5]")} />
                    <span className="text-base flex-1">Administration</span>
                    <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", verwaltungOpen && "rotate-180")} />
                  </button>

                  <ul className={cn(
                    "overflow-hidden transition-all duration-200 ease-in-out",
                    verwaltungOpen ? "max-h-96 opacity-100 mt-1" : "max-h-0 opacity-0"
                  )}>
                    {verwaltungItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = location.pathname === item.path;
                      return (
                        <li key={item.path}>
                          <button
                            data-testid={`drawer-nav-${item.path.slice(1)}`}
                            onClick={() => handleNavClick(item.path)}
                            className={cn(
                              "w-full flex items-center gap-3 pl-12 pr-4 py-2.5 rounded-xl transition-all text-left min-h-[40px]",
                              isActive
                                ? "bg-emerald-50 text-emerald-700 font-semibold dark:bg-emerald-900/30 dark:text-emerald-400"
                                : "text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 active:bg-stone-100"
                            )}
                          >
                            <Icon className={cn("w-4 h-4", isActive && "stroke-[2.5]")} />
                            <span className="text-sm">{item.label}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              )}
            </ul>
          </nav>

          {/* Drawer Footer - Benutzerbereich */}
          <div className="p-4 border-t border-stone-200 dark:border-stone-700 space-y-3">
            {/* Benutzer-Info */}
            <div className="flex items-center gap-3 px-2">
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                <User className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-stone-900 dark:text-stone-100 truncate capitalize" data-testid="drawer-username">
                  {user?.username}
                </p>
                <p className="text-xs text-stone-500 dark:text-stone-400 capitalize">
                  {user?.role}
                </p>
              </div>
            </div>
            
            {/* Passwort ändern */}
            <Button
              data-testid="drawer-change-password-button"
              onClick={() => {
                setPasswordDialogOpen(true);
                setDrawerOpen(false);
              }}
              className="w-full h-11 rounded-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors flex items-center justify-center gap-2 text-base font-medium"
            >
              <Key className="w-4 h-4" />
              Passwort ändern
            </Button>
            
            {/* Abmelden */}
            <Button
              data-testid="drawer-logout-button"
              onClick={handleLogout}
              className="w-full h-11 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors flex items-center justify-center gap-2 text-base font-medium"
            >
              <LogOut className="w-5 h-5" />
              Abmelden
            </Button>
          </div>
        </div>
      </div>

      {/* Passwort ändern Dialog */}
      <ChangePasswordDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
      />
    </>
  );
};

export default TopBar;