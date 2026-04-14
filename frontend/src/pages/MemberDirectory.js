import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { api } from '../lib/api';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Users, Search, SlidersHorizontal, Check, ChevronUp, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { displayRole } from '../lib/utils';

const ALL_COLUMNS = [
  { key: 'name', label: 'Name', alwaysVisible: true },
  { key: 'status', label: 'Status' },
  { key: 'role', label: 'Rolle' },
  { key: 'email', label: 'E-Mail' },
  { key: 'birthday', label: 'Geburtstag' },
  { key: 'street', label: 'Straße' },
  { key: 'zipCode', label: 'PLZ' },
  { key: 'city', label: 'Ort' },
  { key: 'joinDate', label: 'Eintritt (Verein)' },
  { key: 'joinDateCorps', label: 'Eintritt (Corps)' },
  { key: 'confession', label: 'Konfession' },
];

const DEFAULT_VISIBLE = ['name', 'status', 'role', 'email', 'birthday', 'city', 'joinDate'];

const STORAGE_KEY = 'memberDirectoryColumns';

const MemberDirectory = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('alle');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [columnPickerOpen, setColumnPickerOpen] = useState(false);
  const pickerRef = useRef(null);
  const pickerBtnRef = useRef(null);

  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_VISIBLE;
  });

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const toggleColumn = (key) => {
    const col = ALL_COLUMNS.find(c => c.key === key);
    if (col?.alwaysVisible) return;
    setVisibleColumns(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // Close picker on outside click
  useEffect(() => {
    const handler = (e) => {
      if (columnPickerOpen && pickerRef.current && !pickerRef.current.contains(e.target) && pickerBtnRef.current && !pickerBtnRef.current.contains(e.target)) {
        setColumnPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [columnPickerOpen]);

  const loadMembers = useCallback(async () => {
    try {
      const res = await api.get('/member-directory');
      setMembers(res.data);
    } catch (error) {
      if (error?.code !== 'ERR_CANCELED') toast.error('Fehler beim Laden der Mitglieder');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  const toggleSort = (key) => {
    if (sortBy === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDir('asc');
    }
  };

  const getSortValue = (member, key) => {
    switch (key) {
      case 'name': return `${member.lastName || ''} ${member.firstName || ''}`.toLowerCase();
      case 'status': return member.status || '';
      case 'role': return member.role || 'zzz';
      case 'email': return (member.email || '').toLowerCase();
      case 'birthday': return member.birthday || '';
      case 'street': return (member.street || '').toLowerCase();
      case 'zipCode': return member.zipCode || '';
      case 'city': return (member.city || '').toLowerCase();
      case 'joinDate': return member.joinDate || '';
      case 'joinDateCorps': return member.joinDateCorps || '';
      case 'confession': return (member.confession || '').toLowerCase();
      default: return '';
    }
  };

  const filteredAndSortedMembers = useMemo(() => {
    const filtered = members.filter(m => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q ||
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) ||
        (m.email || '').toLowerCase().includes(q) ||
        (m.city || '').toLowerCase().includes(q) ||
        (m.street || '').toLowerCase().includes(q) ||
        (m.confession || '').toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'alle' || m.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const valA = getSortValue(a, sortBy);
      const valB = getSortValue(b, sortBy);
      if (valA < valB) return -1 * dir;
      if (valA > valB) return 1 * dir;
      return 0;
    });
  }, [members, searchQuery, statusFilter, sortBy, sortDir]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '–';
    try { return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
    catch { return '–'; }
  };

  const calcAge = (birthday) => {
    if (!birthday) return null;
    const d = new Date(birthday);
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
    return age >= 0 ? age : null;
  };

  const statusCounts = useMemo(() => {
    const aktiv = members.filter(m => m.status === 'aktiv').length;
    const passiv = members.filter(m => m.status === 'passiv').length;
    return { aktiv, passiv, total: members.length };
  }, [members]);

  const activeColumns = useMemo(() => ALL_COLUMNS.filter(c => visibleColumns.includes(c.key)), [visibleColumns]);

  const getCellContent = (member, colKey) => {
    const age = colKey === 'birthday' ? calcAge(member.birthday) : null;
    switch (colKey) {
      case 'name':
        return <p className="font-semibold text-stone-900 dark:text-stone-100 truncate">{member.firstName} {member.lastName}</p>;
      case 'status':
        return (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${member.status === 'aktiv' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' : 'bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300'}`}>
            {member.status === 'aktiv' ? 'Aktiv' : 'Passiv'}
          </span>
        );
      case 'role':
        return member.role
          ? <Badge className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-0 text-[10px]">{displayRole(member.role)}</Badge>
          : <span className="text-xs text-stone-300 dark:text-stone-600">–</span>;
      case 'email':
        return member.email
          ? <a href={`mailto:${member.email}`} className="text-sm text-emerald-700 dark:text-emerald-400 hover:underline truncate block">{member.email}</a>
          : <span className="text-xs text-stone-300 dark:text-stone-600">–</span>;
      case 'birthday':
        return member.birthday
          ? <span className="text-sm text-stone-600 dark:text-stone-400">{formatDate(member.birthday)}{age !== null && <span className="text-stone-400 dark:text-stone-500 ml-1">({age})</span>}</span>
          : <span className="text-xs text-stone-300 dark:text-stone-600">–</span>;
      case 'street':
        return member.street
          ? <span className="text-sm text-stone-600 dark:text-stone-400 truncate block">{member.street}</span>
          : <span className="text-xs text-stone-300 dark:text-stone-600">–</span>;
      case 'zipCode':
        return member.zipCode
          ? <span className="text-sm text-stone-600 dark:text-stone-400">{member.zipCode}</span>
          : <span className="text-xs text-stone-300 dark:text-stone-600">–</span>;
      case 'city':
        return member.city
          ? <span className="text-sm text-stone-600 dark:text-stone-400">{member.city}</span>
          : <span className="text-xs text-stone-300 dark:text-stone-600">–</span>;
      case 'joinDate':
        return member.joinDate
          ? <span className="text-sm text-stone-600 dark:text-stone-400">{formatDate(member.joinDate)}</span>
          : <span className="text-xs text-stone-300 dark:text-stone-600">–</span>;
      case 'joinDateCorps':
        return member.joinDateCorps
          ? <span className="text-sm text-stone-600 dark:text-stone-400">{formatDate(member.joinDateCorps)}</span>
          : <span className="text-xs text-stone-300 dark:text-stone-600">–</span>;
      case 'confession':
        return member.confession
          ? <span className="text-sm text-stone-600 dark:text-stone-400">{member.confession}</span>
          : <span className="text-xs text-stone-300 dark:text-stone-600">–</span>;
      default:
        return <span className="text-xs text-stone-300">–</span>;
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="text-stone-500 dark:text-stone-400">Laden...</div></div>;

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950">
      <div className="max-w-2xl lg:max-w-[90rem] mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Users className="w-7 h-7 text-emerald-700 dark:text-emerald-400" />
              <h1 className="text-3xl md:text-4xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">Mitgliederseite</h1>
            </div>
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
              {statusCounts.total} Mitglieder ({statusCounts.aktiv} aktiv, {statusCounts.passiv} passiv)
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {['alle', 'aktiv', 'passiv'].map(s => (
              <button
                key={s}
                data-testid={`filter-${s}`}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${statusFilter === s ? 'bg-emerald-700 text-white' : 'bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-700'}`}
              >
                {s === 'alle' ? 'Alle' : s === 'aktiv' ? 'Aktiv' : 'Passiv'}
              </button>
            ))}
          </div>
        </div>

        {/* Suche + Spaltenauswahl */}
        <div className="flex gap-3 items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              data-testid="member-directory-search"
              type="text"
              placeholder="Suche nach Name, E-Mail, Ort, Straße..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>
          {/* Column Picker */}
          <div className="relative">
            <button
              ref={pickerBtnRef}
              data-testid="column-picker-btn"
              onClick={() => setColumnPickerOpen(!columnPickerOpen)}
              className={`h-10 px-3 rounded-xl border transition-colors flex items-center gap-2 text-sm font-medium ${columnPickerOpen ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400' : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-700'}`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Spalten</span>
              <span className="text-xs bg-stone-100 dark:bg-stone-700 text-stone-500 dark:text-stone-400 rounded-full px-1.5 py-0.5">{activeColumns.length}</span>
            </button>
            {columnPickerOpen && (
              <div
                ref={pickerRef}
                data-testid="column-picker-dropdown"
                className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 shadow-2xl z-50 py-2 animate-in fade-in slide-in-from-top-2 duration-150"
              >
                <p className="px-3 py-1.5 text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">Sichtbare Spalten</p>
                {ALL_COLUMNS.map(col => {
                  const active = visibleColumns.includes(col.key);
                  return (
                    <button
                      key={col.key}
                      data-testid={`col-toggle-${col.key}`}
                      onClick={() => toggleColumn(col.key)}
                      disabled={col.alwaysVisible}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${col.alwaysVisible ? 'text-stone-400 dark:text-stone-500 cursor-default' : active ? 'text-stone-900 dark:text-stone-100 hover:bg-stone-50 dark:hover:bg-stone-800' : 'text-stone-400 dark:text-stone-500 hover:bg-stone-50 dark:hover:bg-stone-800'}`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${active ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-stone-300 dark:border-stone-600'}`}>
                        {active && <Check className="w-3 h-3" />}
                      </div>
                      {col.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Tabelle */}
        <Card className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="member-directory-table">
              <thead>
                <tr className="border-b border-stone-100 dark:border-stone-800">
                  {activeColumns.map(col => (
                    <th
                      key={col.key}
                      onClick={() => toggleSort(col.key)}
                      className="text-left px-4 py-3 text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {sortBy === col.key && (
                          sortDir === 'asc'
                            ? <ChevronUp className="w-3 h-3" />
                            : <ChevronDown className="w-3 h-3" />
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody data-testid="member-directory-list">
                {filteredAndSortedMembers.length > 0 ? filteredAndSortedMembers.map(member => (
                  <tr
                    key={member.id}
                    data-testid={`directory-member-${member.id}`}
                    className="border-b border-stone-50 dark:border-stone-800 last:border-0 hover:bg-stone-50/50 dark:hover:bg-stone-800/30 transition-colors"
                  >
                    {activeColumns.map(col => (
                      <td key={col.key} className="px-4 py-3 whitespace-nowrap max-w-[200px]">
                        {getCellContent(member, col.key)}
                      </td>
                    ))}
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={activeColumns.length} className="text-center text-stone-400 dark:text-stone-500 py-12">
                      {searchQuery ? 'Keine Treffer' : 'Keine Mitglieder'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default MemberDirectory;
