import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { 
  Shield, 
  Search, 
  RefreshCw, 
  LogIn, 
  LogOut, 
  UserPlus, 
  UserMinus, 
  Edit, 
  Trash2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Globe
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('all');

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const response = await api.get('/audit-logs?limit=500');
      setLogs(response.data?.logs || []);
    } catch (error) {
      console.error('Fehler beim Laden der Audit-Logs:', error);
      if (error?.code !== 'ERR_CANCELED') {
        toast.error('Fehler beim Laden der Audit-Logs');
      }
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action) => {
    const icons = {
      'login_success': <LogIn className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
      'login_failed': <XCircle className="w-4 h-4 text-red-500 dark:text-red-400" />,
      'logout': <LogOut className="w-4 h-4 text-stone-500 dark:text-stone-400" />,
      'create': <UserPlus className="w-4 h-4 text-blue-500 dark:text-blue-400" />,
      'update': <Edit className="w-4 h-4 text-amber-500 dark:text-amber-400" />,
      'delete': <Trash2 className="w-4 h-4 text-red-500 dark:text-red-400" />,
    };
    return icons[action] || <AlertTriangle className="w-4 h-4 text-stone-400" />;
  };

  const getActionLabel = (action) => {
    const labels = {
      'login_success': 'Login erfolgreich',
      'login_failed': 'Login fehlgeschlagen',
      'logout': 'Abgemeldet',
      'create': 'Erstellt',
      'update': 'Aktualisiert',
      'delete': 'Gelöscht',
    };
    return labels[action] || action;
  };

  const getActionColor = (action) => {
    const colors = {
      'login_success': 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
      'login_failed': 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
      'logout': 'bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-600',
      'create': 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
      'update': 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
      'delete': 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
    };
    return colors[action] || 'bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-600';
  };

  const getResourceLabel = (type) => {
    const labels = {
      'auth': 'Authentifizierung',
      'user': 'Benutzer',
      'member': 'Mitglied',
      'fine': 'Strafe',
      'fine_type': 'Strafenart',
      'profile': 'Profil',
    };
    return labels[type] || type;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      (log.username?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (log.details?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (log.ip_address?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (log.resource_type?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    
    const matchesAction = filterAction === 'all' || log.action === filterAction;
    
    return matchesSearch && matchesAction;
  });

  const uniqueActions = [...new Set(logs.map(log => log.action))];

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-stone-900 dark:text-stone-100 tracking-tight flex items-center gap-2">
            <Shield className="w-7 h-7 text-emerald-700 dark:text-emerald-400" />
            Audit-Log
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
            Übersicht aller System-Aktivitäten
          </p>
        </div>
        
        <Button
          onClick={loadLogs}
          disabled={loading}
          className="h-10 px-4 rounded-full bg-emerald-700 text-white hover:bg-emerald-800"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Aktualisieren
        </Button>
      </div>

      {/* Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 dark:text-stone-500" />
          <Input
            placeholder="Suchen nach Benutzer, IP, Details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-10 rounded-xl"
          />
        </div>
        
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-full sm:w-48 h-10 rounded-xl">
            <SelectValue placeholder="Alle Aktionen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Aktionen</SelectItem>
            {uniqueActions.map(action => (
              <SelectItem key={action} value={action}>
                {getActionLabel(action)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-stone-900 rounded-xl p-4 border border-stone-200 dark:border-stone-700">
          <div className="flex items-center gap-2 text-stone-500 dark:text-stone-400 text-sm mb-1">
            <Clock className="w-4 h-4" />
            Gesamt
          </div>
          <p className="text-2xl font-bold text-stone-900 dark:text-stone-100">{logs.length}</p>
        </div>
        <div className="bg-white dark:bg-stone-900 rounded-xl p-4 border border-stone-200 dark:border-stone-700">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm mb-1">
            <CheckCircle className="w-4 h-4" />
            Erfolgreiche Logins
          </div>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
            {logs.filter(l => l.action === 'login_success').length}
          </p>
        </div>
        <div className="bg-white dark:bg-stone-900 rounded-xl p-4 border border-stone-200 dark:border-stone-700">
          <div className="flex items-center gap-2 text-red-500 dark:text-red-400 text-sm mb-1">
            <XCircle className="w-4 h-4" />
            Fehlgeschlagene Logins
          </div>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
            {logs.filter(l => l.action === 'login_failed').length}
          </p>
        </div>
        <div className="bg-white dark:bg-stone-900 rounded-xl p-4 border border-stone-200 dark:border-stone-700">
          <div className="flex items-center gap-2 text-blue-500 dark:text-blue-400 text-sm mb-1">
            <Edit className="w-4 h-4" />
            Änderungen
          </div>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {logs.filter(l => ['create', 'update', 'delete'].includes(l.action)).length}
          </p>
        </div>
      </div>

      {/* Log List */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-600 dark:text-emerald-400 mb-3" />
            <p className="text-stone-500 dark:text-stone-400">Lade Audit-Logs...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-8 text-center">
            <Shield className="w-12 h-12 mx-auto text-stone-300 dark:text-stone-600 mb-3" />
            <p className="text-stone-500 dark:text-stone-400">Keine Einträge gefunden</p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100 dark:divide-stone-700">
            {filteredLogs.map((log, index) => (
              <div
                key={log.id || index}
                className="p-4 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  {/* Action Icon */}
                  <div className={`p-2 rounded-lg ${getActionColor(log.action).split(' ')[0]} ${getActionColor(log.action).split(' ')[1]}`}>
                    {getActionIcon(log.action)}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getActionColor(log.action)}`}>
                        {getActionLabel(log.action)}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400">
                        {getResourceLabel(log.resource_type)}
                      </span>
                    </div>
                    
                    {log.details && (
                      <p className="text-sm text-stone-700 dark:text-stone-300 mb-2">
                        {log.details}
                      </p>
                    )}
                    
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
                      {log.username && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {log.username}
                        </span>
                      )}
                      {log.ip_address && (
                        <span className="flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          {log.ip_address}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(log.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <p className="text-xs text-stone-400 dark:text-stone-500 text-center">
        Zeigt die letzten 500 Einträge. Ältere Einträge werden automatisch archiviert.
      </p>
      </div>
    </div>
  );
};

export default AuditLogs;
