import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Menu, X, LayoutDashboard, Receipt, Users, Tag, BarChart3, User, Key, UserCog, Shield, CalendarDays, Settings, ChevronDown } from 'lucide-react';
import { Button } from './ui/button';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import ChangePasswordDialog from './ChangePasswordDialog';

const TopBar = () => {
  const { logout, isVorstand, isAdmin, isMitglied, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [verwaltungOpen, setVerwaltungOpen] = useState(() => {
    const verwaltPaths = ['/members', '/users', '/fine-types', '/audit'];
    return verwaltPaths.includes(window.location.pathname);
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const filterItem = (item) => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.hideForVorstand && isVorstand) return false;
    if (item.hideForMitglied && isMitglied) return false;
    return true;
  };

  // Top-level items
  const topNavItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', showForAll: true },
    { path: '/calendar', icon: CalendarDays, label: 'Termine', showForAll: true },
    { path: '/statistics', icon: BarChart3, label: 'Statistiken', hideForMitglied: true },
    { path: '/fines', icon: Receipt, label: 'Strafenübersicht', hideForMitglied: true, hideForVorstand: true },
  ].filter(filterItem);

  // Verwaltung sub-items
  const verwaltungItems = [
    { path: '/members', icon: Users, label: 'Mitgliederverwaltung', hideForMitglied: true },
    { path: '/users', icon: UserCog, label: 'Benutzerverwaltung', adminOnly: true },
    { path: '/fine-types', icon: Tag, label: 'Strafenarten', hideForMitglied: true },
    { path: '/audit', icon: Shield, label: 'Audit-Log', adminOnly: true },
  ].filter(filterItem);

  const verwaltungPaths = verwaltungItems.map(i => i.path);
  const isVerwaltungActive = verwaltungPaths.includes(location.pathname);

  const handleNavClick = (path) => {
    navigate(path);
    setDrawerOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-stone-100 h-14 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Button
            data-testid="menu-button"
            onClick={() => setDrawerOpen(!drawerOpen)}
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg"
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
              <h2 className="font-bold text-base text-stone-900 leading-none">Rheinzelmänner</h2>
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
          "fixed top-0 left-0 h-full w-64 sm:w-72 bg-white z-50 shadow-2xl transform transition-transform duration-300 ease-out",
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Drawer Header */}
          <div className="flex items-center justify-between p-4 border-b border-stone-200">
            <div className="flex items-center gap-2">
              <img 
                src="/logo.png" 
                alt="Rheinzelmänner" 
                className="w-10 h-10 object-contain"
              />
              <div>
                <h2 className="font-bold text-lg text-stone-900">Rheinzelmänner</h2>
              </div>
            </div>
            <Button
              data-testid="close-drawer-button"
              onClick={() => setDrawerOpen(false)}
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg"
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
                          ? "bg-emerald-50 text-emerald-700 font-semibold"
                          : "text-stone-600 hover:bg-stone-50 active:bg-stone-100"
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
                        ? "bg-emerald-50 text-emerald-700 font-semibold"
                        : "text-stone-600 hover:bg-stone-50 active:bg-stone-100"
                    )}
                  >
                    <Settings className={cn("w-5 h-5", isVerwaltungActive && "stroke-[2.5]")} />
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
                                ? "bg-emerald-50 text-emerald-700 font-semibold"
                                : "text-stone-500 hover:bg-stone-50 active:bg-stone-100"
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
          <div className="p-4 border-t border-stone-200 space-y-3">
            {/* Benutzer-Info */}
            <div className="flex items-center gap-3 px-2">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <User className="w-5 h-5 text-emerald-700" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-stone-900 truncate capitalize" data-testid="drawer-username">
                  {user?.username}
                </p>
                <p className="text-xs text-stone-500 capitalize">
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
              className="w-full h-11 rounded-full bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 transition-colors flex items-center justify-center gap-2 text-base font-medium"
            >
              <Key className="w-4 h-4" />
              Passwort ändern
            </Button>
            
            {/* Abmelden */}
            <Button
              data-testid="drawer-logout-button"
              onClick={handleLogout}
              className="w-full h-11 rounded-full bg-stone-100 text-stone-700 hover:bg-stone-200 transition-colors flex items-center justify-center gap-2 text-base font-medium"
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