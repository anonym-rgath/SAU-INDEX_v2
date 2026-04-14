import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Receipt, CalendarDays, BarChart4, Shield, ShieldCheck, Users, Tag, SlidersHorizontal, UserCircle, Building2, ChevronDown, LogOut, Key } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useBranding } from '../contexts/BrandingContext';
import { displayRole } from '../lib/utils';
import { cn } from '../lib/utils';

const DesktopSidebar = () => {
  const { logout, isAdmin, canSeeAdvancedStats, canManageMembers, canManageFineTypes, user } = useAuth();
  const { clubName, hasLogo, logoUrl } = useBranding();
  const navigate = useNavigate();
  const location = useLocation();
  const [verwaltungOpen, setVerwaltungOpen] = useState(() => {
    const verwaltPaths = ['/members', '/fine-types', '/audit', '/settings', '/profile', '/roles', '/club-settings'];
    return verwaltPaths.includes(location.pathname);
  });

  const topNavItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/calendar', icon: CalendarDays, label: 'Termine' },
    { path: '/fines', icon: Receipt, label: 'Strafenübersicht' },
    canSeeAdvancedStats && { path: '/statistics-advanced', icon: BarChart4, label: 'Statistiken' },
  ].filter(Boolean);

  const verwaltungItems = [
    { path: '/profile', icon: UserCircle, label: 'Profil' },
    canManageMembers && { path: '/roles', icon: ShieldCheck, label: 'Benutzerrollen' },
    canManageMembers && { path: '/members', icon: Users, label: 'Benutzerverwaltung' },
    { path: '/club-settings', icon: Building2, label: 'Stammdaten' },
    canManageFineTypes && { path: '/fine-types', icon: Tag, label: 'Strafenkatalog' },
    canManageMembers && { path: '/audit', icon: Shield, label: 'Audit-Log' },
    { path: '/settings', icon: SlidersHorizontal, label: 'Einstellungen' },
  ].filter(Boolean);

  const verwaltungPaths = verwaltungItems.map(i => i.path);
  const isVerwaltungActive = verwaltungPaths.includes(location.pathname);

  const getInitials = () => (user?.username || '?').charAt(0).toUpperCase();

  return (
    <aside className="hidden lg:flex flex-col w-60 xl:w-64 bg-white dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
      <nav className="flex-1 p-3 space-y-0.5">
        {topNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-left text-sm",
                isActive
                  ? "bg-emerald-50 text-emerald-700 font-semibold dark:bg-emerald-900/30 dark:text-emerald-400"
                  : "text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800"
              )}
            >
              <Icon className={cn("w-[18px] h-[18px]", isActive && "stroke-[2.5]")} />
              <span>{item.label}</span>
            </button>
          );
        })}

        {/* Verwaltung Group */}
        <div className="pt-2">
          <button
            onClick={() => setVerwaltungOpen(!verwaltungOpen)}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-left text-sm",
              isVerwaltungActive
                ? "bg-emerald-50 text-emerald-700 font-semibold dark:bg-emerald-900/30 dark:text-emerald-400"
                : "text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800"
            )}
          >
            <SlidersHorizontal className={cn("w-[18px] h-[18px]", isVerwaltungActive && "stroke-[2.5]")} />
            <span className="flex-1">Administration</span>
            <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", verwaltungOpen && "rotate-180")} />
          </button>

          <div className={cn(
            "overflow-hidden transition-all duration-200 ease-in-out",
            verwaltungOpen ? "max-h-96 opacity-100 mt-0.5" : "max-h-0 opacity-0"
          )}>
            {verwaltungItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={cn(
                    "w-full flex items-center gap-2.5 pl-9 pr-3 py-2 rounded-xl transition-all text-left text-[13px]",
                    isActive
                      ? "bg-emerald-50 text-emerald-700 font-semibold dark:bg-emerald-900/30 dark:text-emerald-400"
                      : "text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800"
                  )}
                >
                  <Icon className={cn("w-4 h-4", isActive && "stroke-[2.5]")} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Footer - User */}
      <div className="p-3 border-t border-stone-100 dark:border-stone-800">
        <div className="flex items-center gap-2.5 px-2 py-1.5 mb-2">
          <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{getInitials()}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-stone-900 dark:text-stone-100 text-sm truncate capitalize">{user?.username}</p>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">{displayRole(user?.role)}</p>
          </div>
        </div>
        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Abmelden</span>
        </button>
      </div>
    </aside>
  );
};

export default DesktopSidebar;
