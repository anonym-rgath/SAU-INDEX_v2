import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import { Card } from '../components/ui/card';
import { Calendar, TrendingUp, Award, Coins, User } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

const Statistics = () => {
  const { user } = useAuth();
  const [fiscalYear, setFiscalYear] = useState('');
  const [fiscalYears, setFiscalYears] = useState([]);
  const [personalStats, setPersonalStats] = useState(null);
  const [fines, setFines] = useState([]);
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
      if (error?.code !== 'ERR_CANCELED') toast.error('Fehler beim Laden');
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, finesRes] = await Promise.all([
        api.statistics.getPersonal(fiscalYear),
        api.fines.getAll(fiscalYear),
      ]);
      setPersonalStats(statsRes.data);
      setFines(finesRes.data);
    } catch (error) {
      if (error?.code !== 'ERR_CANCELED') toast.error('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  const monthlyData = useMemo(() => {
    const monthNames = ['Aug', 'Sep', 'Okt', 'Nov', 'Dez', 'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul'];
    const data = monthNames.map(m => ({ month: m, amount: 0, count: 0 }));
    fines.forEach(f => {
      const d = new Date(f.date);
      let idx = d.getMonth() >= 7 ? d.getMonth() - 7 : d.getMonth() + 5;
      if (idx >= 0 && idx < 12) {
        data[idx].amount += f.amount;
        data[idx].count += 1;
      }
    });
    return data;
  }, [fines]);

  const finesByType = useMemo(() => {
    const map = {};
    fines.forEach(f => {
      const label = f.fine_type_label || 'Sonstige';
      if (!map[label]) map[label] = { label, count: 0, total: 0 };
      map[label].count += 1;
      map[label].total += f.amount;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [fines]);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="text-stone-500 dark:text-stone-400">Laden...</div></div>;

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">
              Meine Statistiken
            </h1>
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
              Persönliche Auswertung
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-full px-3 h-10 shadow-sm">
            <Calendar className="w-4 h-4 text-stone-400" />
            <select
              data-testid="stats-fiscal-year-selector"
              value={fiscalYear}
              onChange={(e) => setFiscalYear(e.target.value)}
              className="bg-transparent border-none outline-none text-stone-700 dark:text-stone-200 font-medium cursor-pointer text-base"
            >
              {fiscalYears.map(fy => (
                <option key={fy} value={fy}>GJ {fy}</option>
              ))}
            </select>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="w-4 h-4 text-emerald-700" />
              <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">Gesamtbetrag</p>
            </div>
            <p className="text-2xl font-bold text-stone-900 dark:text-stone-100">
              {formatCurrency(personalStats?.total_amount || 0)}
            </p>
          </Card>

          <Card className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <Award className="w-4 h-4 text-orange-500" />
              <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">Anzahl Strafen</p>
            </div>
            <p className="text-2xl font-bold text-stone-900 dark:text-stone-100">
              {personalStats?.total_fines || 0}
            </p>
          </Card>

          <Card className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">Rang</p>
            </div>
            <p className="text-2xl font-bold text-stone-900 dark:text-stone-100">
              {personalStats?.rank ? `${personalStats.rank} / ${personalStats.total_members}` : '–'}
            </p>
          </Card>

          <Card className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-emerald-700" />
              <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">Durchschnitt</p>
            </div>
            <p className="text-2xl font-bold text-stone-900 dark:text-stone-100">
              {personalStats?.total_fines > 0 ? formatCurrency(personalStats.total_amount / personalStats.total_fines) : '–'}
            </p>
          </Card>
        </div>

        {/* Strafen nach Art */}
        {finesByType.length > 0 && (
          <Card className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm p-5 mb-6">
            <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100 mb-3">Meine Strafen nach Art</h2>
            <div className="space-y-2">
              {finesByType.map(ft => (
                <div key={ft.label} className="flex items-center justify-between p-3 rounded-xl bg-stone-50 dark:bg-stone-800">
                  <div>
                    <p className="font-medium text-stone-900 dark:text-stone-100 text-sm">{ft.label}</p>
                    <p className="text-xs text-stone-500 dark:text-stone-400">{ft.count}x</p>
                  </div>
                  <span className="font-bold text-emerald-700">{formatCurrency(ft.total)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Monatlicher Verlauf */}
        <Card className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm p-5">
          <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100 mb-3">Verlauf über das Geschäftsjahr</h2>
          <div className="space-y-1">
            {monthlyData.map(m => (
              <div key={m.month} className="flex items-center gap-2">
                <span className="text-xs text-stone-500 dark:text-stone-400 w-8">{m.month}</span>
                <div className="flex-1 h-6 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                  {m.amount > 0 && (
                    <div
                      className="h-full bg-emerald-600 rounded-full flex items-center justify-end pr-2"
                      style={{ width: `${Math.min(100, (m.amount / Math.max(...monthlyData.map(d => d.amount), 1)) * 100)}%`, minWidth: m.amount > 0 ? '40px' : '0' }}
                    >
                      <span className="text-xs text-white font-medium">{formatCurrency(m.amount)}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Statistics;
