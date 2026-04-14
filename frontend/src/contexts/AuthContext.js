import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const ABSOLUTE_TIMEOUT_MS = 8 * 60 * 60 * 1000;

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => {
    const savedToken = sessionStorage.getItem('token');
    if (savedToken) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
    }
    return savedToken;
  });
  const [user, setUser] = useState(JSON.parse(sessionStorage.getItem('user') || 'null'));
  const [loading, setLoading] = useState(false);
  const [loginTime, setLoginTime] = useState(parseInt(sessionStorage.getItem('loginTime') || '0'));
  
  const idleTimerRef = useRef(null);
  const absoluteTimerRef = useRef(null);

  const logout = useCallback((reason = '') => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('loginTime');
    setToken(null);
    setUser(null);
    setLoginTime(0);
    delete axios.defaults.headers.common['Authorization'];
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (absoluteTimerRef.current) clearTimeout(absoluteTimerRef.current);
    if (reason) sessionStorage.setItem('logoutReason', reason);
  }, []);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (token) {
      idleTimerRef.current = setTimeout(() => {
        logout('Automatisch abgemeldet wegen Inaktivität (15 Minuten)');
      }, IDLE_TIMEOUT_MS);
    }
  }, [token, logout]);

  const login = useCallback(async (username, password) => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/auth/login`, { username, password });
      const { token: newToken, role, username: userName, member_id } = response.data;
      const now = Date.now();
      sessionStorage.setItem('token', newToken);
      sessionStorage.setItem('user', JSON.stringify({ username: userName, role, member_id }));
      sessionStorage.setItem('loginTime', now.toString());
      setToken(newToken);
      setUser({ username: userName, role, member_id });
      setLoginTime(now);
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      sessionStorage.removeItem('logoutReason');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Login fehlgeschlagen' };
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token && loginTime) {
      const elapsed = Date.now() - loginTime;
      const remaining = ABSOLUTE_TIMEOUT_MS - elapsed;
      if (remaining <= 0) {
        logout('Sitzung abgelaufen (maximale Sitzungsdauer: 8 Stunden)');
      } else {
        absoluteTimerRef.current = setTimeout(() => {
          logout('Sitzung abgelaufen (maximale Sitzungsdauer: 8 Stunden)');
        }, remaining);
      }
    }
    return () => { if (absoluteTimerRef.current) clearTimeout(absoluteTimerRef.current); };
  }, [token, loginTime, logout]);

  useEffect(() => {
    if (token) {
      const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
      let debounceTimer = null;
      const handleActivity = () => {
        if (debounceTimer) return;
        debounceTimer = setTimeout(() => { debounceTimer = null; resetIdleTimer(); }, 2000);
      };
      events.forEach(event => document.addEventListener(event, handleActivity, { passive: true }));
      resetIdleTimer();
      return () => {
        events.forEach(event => document.removeEventListener(event, handleActivity));
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        if (debounceTimer) clearTimeout(debounceTimer);
      };
    }
  }, [token, resetIdleTimer]);

  useEffect(() => {
    if (token) axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }, [token]);

  const role = user?.role;
  const isAdmin = role === 'admin';
  const isSpiess = role === 'spiess';
  const isVorstand = role === 'vorstand';
  const isMitglied = role === 'mitglied';

  // Berechtigungen
  const canManageMembers = ['admin', 'spiess', 'vorstand'].includes(role);
  const canManageFines = ['admin', 'spiess'].includes(role);
  const canManageFineTypes = ['admin', 'spiess', 'vorstand'].includes(role);
  const canManageEvents = ['admin', 'spiess', 'vorstand'].includes(role);
  const canSeeAdvancedStats = ['admin', 'spiess', 'vorstand'].includes(role);
  const canSeeAllFines = ['admin', 'spiess'].includes(role);
  const canSeeFineInfo = ['admin', 'spiess', 'vorstand'].includes(role);
  const canManageICS = ['admin', 'spiess', 'vorstand'].includes(role);
  const canManageRoles = isAdmin;

  const contextValue = useMemo(() => ({
    token, user, login, logout, loading,
    isAuthenticated: !!token,
    isAdmin, isSpiess, isVorstand, isMitglied,
    canManageMembers, canManageFines, canManageFineTypes,
    canManageEvents, canSeeAdvancedStats, canSeeAllFines,
    canSeeFineInfo, canManageICS, canManageRoles,
  }), [token, user, login, logout, loading, isAdmin, isSpiess, isVorstand, isMitglied, canManageMembers, canManageFines, canManageFineTypes, canManageEvents, canSeeAdvancedStats, canSeeAllFines, canSeeFineInfo, canManageICS, canManageRoles]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
