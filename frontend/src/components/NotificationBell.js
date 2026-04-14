import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Check, CheckCheck, Receipt } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

const POLL_INTERVAL = 30000;

const NotificationBell = () => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);
  const bellRef = useRef(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await api.get('/notifications/unread-count');
      setUnreadCount(res.data.count);
    } catch (err) {
      console.error('Failed to fetch unread count:', err);
    }
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  // Poll for unread count
  useEffect(() => {
    if (!user?.member_id) return;
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [user, fetchUnreadCount]);

  // Close panel on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        open &&
        panelRef.current && !panelRef.current.contains(e.target) &&
        bellRef.current && !bellRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleToggle = () => {
    if (!open) {
      fetchNotifications();
    }
    setOpen(!open);
  };

  const markAsRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Gerade eben';
    if (diffMin < 60) return `vor ${diffMin} Min.`;
    if (diffHrs < 24) return `vor ${diffHrs} Std.`;
    if (diffDays < 7) return `vor ${diffDays} Tag${diffDays > 1 ? 'en' : ''}`;
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'fine': return <Receipt className="w-4 h-4 text-amber-600" />;
      default: return <Bell className="w-4 h-4 text-stone-500" />;
    }
  };

  // Don't show for users without member_id (admin)
  if (!user?.member_id) return null;

  return (
    <div className="relative">
      <button
        ref={bellRef}
        data-testid="notification-bell"
        onClick={handleToggle}
        className={cn(
          "relative h-9 w-9 flex items-center justify-center rounded-lg transition-colors",
          "text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800",
          open && "bg-stone-100 dark:bg-stone-800"
        )}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span
            data-testid="notification-badge"
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 ring-2 ring-white dark:ring-stone-900 animate-in zoom-in duration-200"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {open && (
        <div
          ref={panelRef}
          data-testid="notification-panel"
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 dark:border-stone-800">
            <h3 className="font-bold text-stone-900 dark:text-stone-100 text-sm">Benachrichtigungen</h3>
            {unreadCount > 0 && (
              <button
                data-testid="mark-all-read-btn"
                onClick={markAllAsRead}
                className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 font-medium transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Alle gelesen
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto overscroll-contain" data-testid="notification-list">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-sm text-stone-400">Laden...</div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4">
                <Bell className="w-8 h-8 text-stone-300 dark:text-stone-600 mb-2" />
                <p className="text-sm text-stone-400 dark:text-stone-500">Keine Benachrichtigungen</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  data-testid={`notification-item-${notif.id}`}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3 border-b border-stone-50 dark:border-stone-800 last:border-0 transition-colors",
                    !notif.read
                      ? "bg-emerald-50/50 dark:bg-emerald-900/10"
                      : "hover:bg-stone-50 dark:hover:bg-stone-800/50"
                  )}
                >
                  {/* Type Icon */}
                  <div className={cn(
                    "mt-0.5 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                    !notif.read
                      ? "bg-amber-100 dark:bg-amber-900/30"
                      : "bg-stone-100 dark:bg-stone-800"
                  )}>
                    {getTypeIcon(notif.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn(
                        "text-sm leading-tight",
                        !notif.read
                          ? "font-semibold text-stone-900 dark:text-stone-100"
                          : "font-medium text-stone-600 dark:text-stone-400"
                      )}>
                        {notif.title}
                      </p>
                      {!notif.read && (
                        <button
                          data-testid={`mark-read-${notif.id}`}
                          onClick={(e) => { e.stopPropagation(); markAsRead(notif.id); }}
                          className="flex-shrink-0 p-1 rounded-md text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                          title="Als gelesen markieren"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 truncate">
                      {notif.description}
                    </p>
                    <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-1">
                      {formatTime(notif.created_at)}
                    </p>
                  </div>

                  {/* Unread indicator dot */}
                  {!notif.read && (
                    <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 mt-2" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
