import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import { Card } from '../components/ui/card';
import { Calendar, TrendingUp, Award, Users as UsersIcon, Coins } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const COLORS = ['#3e875f', '#f97316', '#ec4899', '#6366f1', '#eab308', '#06b6d4'];

const formatShortName = (fullName) => {
  if (!fullName) return '';
  const parts = fullName.trim().split(' ');
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
};

const StatisticsAdvanced = () => {
  const { isVorstand } = useAuth();
  const anonymize = isVorstand;

  const [fiscalYear, setFiscalYear] = useState('');
  const [fiscalYears, setFiscalYears] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [fines, setFines] = useState([]);
  const [members, setMembers] = useState([]);
  const [fineTypes, setFineTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadInitialData(); }, []);
  useEffect(() => { if (fiscalYear) loadData(); }, [fiscalYear]);

  const loadInitialData = async () => {
    try {
      const yearsRes = await api.fiscalYears.getAll();
      const years = yearsRes.data?.fiscal_years || [];
      setFiscalYears(years);
      if (years.length > 0) setFiscalYear(years[0]);
    } catch (error) {
      if (error?.code !== 'ERR_CANCELED') toast.error('Fehler beim Laden der Geschäftsjahre');
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, finesRes, membersRes, fineTypesRes] = await Promise.all([
        api.statistics.getAll(fiscalYear),
        api.fines.getAll(fiscalYear),
        api.members.getAll(),
        api.fineTypes.getAll(),
      ]);
      setStatistics(statsRes.data);
      setFines(finesRes.data);
      setMembers(membersRes.data);
      setFineTypes(fineTypesRes.data);
    } catch (error) {
      if (error?.code !== 'ERR_CANCELED') toast.error('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  const fineTypeStats = useMemo(() => {
    const stats = {};
    fineTypes.forEach(ft => { stats[ft.id] = { label: ft.label, count: 0, total: 0 }; });
    fines.forEach(fine => { if (stats[fine.fine_type_id]) { stats[fine.fine_type_id].count += 1; stats[fine.fine_type_id].total += fine.amount; } });
    return Object.values(stats).filter(s => s.count > 0);
  }, [fines, fineTypes]);

  const monthlyStats = useMemo(() => {
    const monthNames = ['Aug', 'Sep', 'Okt', 'Nov', 'Dez', 'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul'];
    const data = monthNames.map(m => ({ month: m, amount: 0, count: 0 }));
    fines.forEach(f => {
      const d = new Date(f.date);
      let idx = d.getMonth() >= 7 ? d.getMonth() - 7 : d.getMonth() + 5;
      if (idx >= 0 && idx < 12) { data[idx].amount += f.amount; data[idx].count += 1; }
    });
    return data;
  }, [fines]);

  const activeMembersRanking = useMemo(() => {
    if (!statistics?.ranking) return [];
    return statistics.ranking.filter(e => { const m = members.find(x => x.id === e.member_id); return !m?.status || m?.status === 'aktiv' || m?.status === ''; });
  }, [statistics, members]);

  const passiveMembersRanking = useMemo(() => {
    if (!statistics?.ranking) return [];
    return statistics.ranking.filter(e => { const m = members.find(x => x.id === e.member_id); return m?.status === 'passiv'; });
  }, [statistics, members]);

  const avgFine = useMemo(() => statistics?.total_fines > 0 ? statistics.total_amount / statistics.total_fines : 0, [statistics]);

  const displayName = (name, idx) => anonymize ? `#${idx + 1}` : formatShortName(name);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="text-stone-500 dark:text-stone-400">Laden...</div></div>;

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">
              Statistiken (Erweitert)
            </h1>
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
              {anonymize ? 'Anonymisierte Auswertungen & Analysen' : 'Auswertungen & Analysen'}
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-full px-3 h-10 shadow-sm">
            <Calendar className="w-4 h-4 text-stone-400" />
            <select data-testid="stats-advanced-fiscal-year-selector" value={fiscalYear} onChange={(e) => setFiscalYear(e.target.value)} className="bg-transparent border-none outline-none text-stone-700 dark:text-stone-200 font-medium cursor-pointer text-base">
              {fiscalYears.map(fy => (<option key={fy} value={fy}>GJ {fy}</option>))}
            </select>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2"><Coins className="w-4 h-4 text-emerald-700" /><p className="text-xs text-stone-500 dark:text-stone-400 font-medium">Gesamt</p></div>
            <p className="text-2xl font-bold text-stone-900 dark:text-stone-100">{formatCurrency(statistics?.total_amount || 0)}</p>
          </Card>
          <Card className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2"><Award className="w-4 h-4 text-orange-500" /><p className="text-xs text-stone-500 dark:text-stone-400 font-medium">Anzahl</p></div>
            <p className="text-2xl font-bold text-stone-900 dark:text-stone-100">{statistics?.total_fines || 0}</p>
          </Card>
          <Card className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 text-blue-500" /><p className="text-xs text-stone-500 dark:text-stone-400 font-medium">Durchschnitt</p></div>
            <p className="text-2xl font-bold text-stone-900 dark:text-stone-100">{formatCurrency(avgFine)}</p>
          </Card>
          <Card className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2"><UsersIcon className="w-4 h-4 text-emerald-700" /><p className="text-xs text-stone-500 dark:text-stone-400 font-medium">Mitglieder</p></div>
            <p className="text-2xl font-bold text-stone-900 dark:text-stone-100">{statistics?.ranking?.length || 0}</p>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm p-6">
            <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 mb-4">Top 10 {anonymize ? '' : 'Mitglieder'}</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={(statistics?.ranking?.slice(0, 10) || []).map((item, i) => ({ ...item, member_name: displayName(item.member_name, i) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis dataKey="member_name" angle={0} textAnchor="middle" height={50} tick={{ fontSize: 11, fill: '#78716c' }} interval={0} />
                <YAxis tick={{ fontSize: 12, fill: '#78716c' }} />
                <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ backgroundColor: 'white', border: '1px solid #e7e5e4', borderRadius: '12px' }} />
                <Bar dataKey="total" fill="#3e875f" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm p-6">
            <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 mb-4">Strafen nach Art</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={fineTypeStats} cx="50%" cy="50%" labelLine={false} label={({ label, count }) => `${label} (${count})`} outerRadius={80} fill="#8884d8" dataKey="count">
                  {fineTypeStats.map((_, i) => (<Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />))}
                </Pie>
                <Tooltip formatter={(v, n, p) => [v, p.payload.label]} contentStyle={{ backgroundColor: 'white', border: '1px solid #e7e5e4', borderRadius: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          <Card className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm p-6 md:col-span-2">
            <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 mb-4">Verlauf über das Geschäftsjahr</h2>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={monthlyStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#78716c' }} />
                <YAxis tick={{ fontSize: 12, fill: '#78716c' }} />
                <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ backgroundColor: 'white', border: '1px solid #e7e5e4', borderRadius: '12px' }} />
                <Legend />
                <Line type="monotone" dataKey="amount" stroke="#3e875f" strokeWidth={3} name="Betrag" dot={{ fill: '#3e875f', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Rankings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm p-6">
            <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 mb-4">Aktive {anonymize ? '' : 'Mitglieder'} (Top 5)</h2>
            <div className="space-y-3">
              {activeMembersRanking.slice(0, 5).map((entry, idx) => (
                <div key={entry.member_id} className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-400 font-bold text-sm flex items-center justify-center">{idx + 1}</div>
                    <span className="font-medium text-stone-900 dark:text-stone-100">{displayName(entry.member_name, idx)}</span>
                  </div>
                  <span className="font-bold text-emerald-700">{formatCurrency(entry.total)}</span>
                </div>
              ))}
              {activeMembersRanking.length === 0 && <p className="text-center text-stone-400 py-4">Keine aktiven Mitglieder</p>}
            </div>
          </Card>

          <Card className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm p-6">
            <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 mb-4">Passive {anonymize ? '' : 'Mitglieder'} (Top 5)</h2>
            <div className="space-y-3">
              {passiveMembersRanking.slice(0, 5).map((entry, idx) => (
                <div key={entry.member_id} className="flex items-center justify-between p-3 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 font-bold text-sm flex items-center justify-center">{idx + 1}</div>
                    <span className="font-medium text-stone-900 dark:text-stone-100">{displayName(entry.member_name, idx)}</span>
                  </div>
                  <span className="font-bold text-stone-700 dark:text-stone-300">{formatCurrency(entry.total)}</span>
                </div>
              ))}
              {passiveMembersRanking.length === 0 && <p className="text-center text-stone-400 py-4">Keine passiven Mitglieder</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default StatisticsAdvanced;
