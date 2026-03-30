import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import { Card } from '../components/ui/card';
import { Calendar, TrendingUp, Award, Users as UsersIcon, Coins } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const COLORS = ['#3e875f', '#f97316', '#ec4899', '#6366f1', '#eab308', '#06b6d4'];

// Formatiert Name als "Vorname N."
const formatShortName = (fullName) => {
  if (!fullName) return '';
  const parts = fullName.trim().split(' ');
  if (parts.length === 1) return parts[0];
  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${firstName} ${lastInitial}.`;
};

const Statistics = () => {
  const { isVorstand } = useAuth();
  const [fiscalYear, setFiscalYear] = useState('');
  const [fiscalYears, setFiscalYears] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [fines, setFines] = useState([]);
  const [members, setMembers] = useState([]);
  const [fineTypes, setFineTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (fiscalYear) {
      loadData();
    }
  }, [fiscalYear]);

  const loadInitialData = async () => {
    try {
      const yearsRes = await api.fiscalYears.getAll();
      const years = yearsRes.data?.fiscal_years || [];
      setFiscalYears(years);
      if (years.length > 0) {
        setFiscalYear(years[0]);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Geschäftsjahre:', error);
      // Nur Toast anzeigen wenn es kein Netzwerkfehler beim Seitenwechsel ist
      if (error?.code !== 'ERR_CANCELED') {
        toast.error('Fehler beim Laden der Geschäftsjahre');
      }
    }
  };

  const loadData = async () => {
    if (!fiscalYear) return;
    setLoading(true);
    try {
      const [statsRes, finesRes, membersRes, fineTypesRes] = await Promise.all([
        api.statistics.getByFiscalYear(fiscalYear),
        api.fines.getAll(fiscalYear),
        api.members.getAll(),
        api.fineTypes.getAll(),
      ]);
      
      setStatistics(statsRes.data);
      setFines(finesRes.data);
      setMembers(membersRes.data);
      setFineTypes(fineTypesRes.data);
    } catch (error) {
      console.error('Fehler beim Laden der Daten:', error);
      if (error?.code !== 'ERR_CANCELED') {
        toast.error('Fehler beim Laden der Daten');
      }
    } finally {
      setLoading(false);
    }
  };

  const getMemberName = (memberId) => {
    return members.find(m => m.id === memberId)?.name || 'Unbekannt';
  };

  const fineTypeStats = useMemo(() => {
    const stats = {};
    fineTypes.forEach(ft => {
      stats[ft.id] = { label: ft.label, count: 0, total: 0 };
    });
    
    fines.forEach(fine => {
      if (stats[fine.fine_type_id]) {
        stats[fine.fine_type_id].count += 1;
        stats[fine.fine_type_id].total += fine.amount;
      }
    });
    
    return Object.values(stats).filter(s => s.count > 0);
  }, [fines, fineTypes]);

  const monthlyStats = useMemo(() => {
    const monthNames = ['Aug', 'Sep', 'Okt', 'Nov', 'Dez', 'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul'];
    const monthlyData = monthNames.map(month => ({ month, amount: 0, count: 0 }));
    
    fines.forEach(fine => {
      const date = new Date(fine.date);
      let monthIndex = date.getMonth();
      
      if (monthIndex >= 7) {
        monthIndex = monthIndex - 7;
      } else {
        monthIndex = monthIndex + 5;
      }
      
      if (monthIndex >= 0 && monthIndex < 12) {
        monthlyData[monthIndex].amount += fine.amount;
        monthlyData[monthIndex].count += 1;
      }
    });
    
    return monthlyData;
  }, [fines]);

  const activeMembersRanking = useMemo(() => {
    if (!statistics?.ranking) return [];
    return statistics.ranking.filter(entry => {
      const member = members.find(m => m.id === entry.member_id);
      return !member?.status || member?.status === 'aktiv' || member?.status === '';
    });
  }, [statistics, members]);

  const passiveMembersRanking = useMemo(() => {
    if (!statistics?.ranking) return [];
    return statistics.ranking.filter(entry => {
      const member = members.find(m => m.id === entry.member_id);
      return member?.status === 'passiv';
    });
  }, [statistics, members]);

  const avgFine = useMemo(() => {
    return statistics?.total_fines > 0 ? statistics.total_amount / statistics.total_fines : 0;
  }, [statistics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-stone-500">Laden...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-stone-900 tracking-tight">
              Statistiken
            </h1>
            <p className="text-sm text-stone-500 mt-1">
              Auswertungen & Analysen
            </p>
          </div>
          
          <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-full px-3 h-10 shadow-sm">
            <Calendar className="w-4 h-4 text-stone-400" />
            <select
              data-testid="stats-fiscal-year-selector"
              value={fiscalYear}
              onChange={(e) => setFiscalYear(e.target.value)}
              className="bg-transparent border-none outline-none text-stone-700 font-medium cursor-pointer text-base"
            >
              {fiscalYears.map(fy => (
                <option key={fy} value={fy}>GJ {fy}</option>
              ))}
            </select>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="w-4 h-4 text-emerald-700" />
              <p className="text-xs text-stone-500 font-medium">Gesamt</p>
            </div>
            <p className="text-2xl font-bold text-stone-900">
              {formatCurrency(statistics?.total_amount || 0)}
            </p>
          </Card>

          <Card className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <Award className="w-4 h-4 text-orange-500" />
              <p className="text-xs text-stone-500 font-medium">Anzahl</p>
            </div>
            <p className="text-2xl font-bold text-stone-900">
              {statistics?.total_fines || 0}
            </p>
          </Card>

          <Card className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              <p className="text-xs text-stone-500 font-medium">Durchschnitt</p>
            </div>
            <p className="text-2xl font-bold text-stone-900">
              {formatCurrency(avgFine)}
            </p>
          </Card>

          <Card className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <UsersIcon className="w-4 h-4 text-emerald-700" />
              <p className="text-xs text-stone-500 font-medium">Mitglieder</p>
            </div>
            <p className="text-2xl font-bold text-stone-900">
              {statistics?.ranking?.length || 0}
            </p>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Top 10 Mitglieder */}
          <Card className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
            <h2 className="text-xl font-bold text-stone-900 mb-4">
              Top 10 {isVorstand ? '' : 'Mitglieder'}
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={(statistics?.ranking?.slice(0, 10) || []).map((item, index) => ({
                ...item,
                member_name: isVorstand ? `#${index + 1}` : formatShortName(item.member_name)
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis 
                  dataKey="member_name" 
                  angle={0} 
                  textAnchor="middle" 
                  height={50}
                  tick={{ fontSize: 11, fill: '#78716c' }}
                  interval={0}
                />
                <YAxis tick={{ fontSize: 12, fill: '#78716c' }} />
                <Tooltip 
                  formatter={(value) => formatCurrency(value)}
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e7e5e4',
                    borderRadius: '12px'
                  }}
                />
                <Bar dataKey="total" fill="#3e875f" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Strafen pro Art */}
          <Card className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
            <h2 className="text-xl font-bold text-stone-900 mb-4">
              Strafen nach Art
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={fineTypeStats}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ label, count }) => `${label} (${count})`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {fineTypeStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value, name, props) => [value, props.payload.label]}
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e7e5e4',
                    borderRadius: '12px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          {/* Monatlicher Verlauf */}
          <Card className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 md:col-span-2">
            <h2 className="text-xl font-bold text-stone-900 mb-4">
              Verlauf über das Geschäftsjahr
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={monthlyStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 12, fill: '#78716c' }}
                />
                <YAxis tick={{ fontSize: 12, fill: '#78716c' }} />
                <Tooltip 
                  formatter={(value) => formatCurrency(value)}
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e7e5e4',
                    borderRadius: '12px'
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="#3e875f" 
                  strokeWidth={3}
                  name="Betrag"
                  dot={{ fill: '#3e875f', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Aktiv vs Passiv */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
            <h2 className="text-xl font-bold text-stone-900 mb-4">
              Aktive {isVorstand ? '' : 'Mitglieder'} (Top 5)
            </h2>
            <div className="space-y-3">
              {activeMembersRanking.slice(0, 5).map((entry, idx) => (
                <div 
                  key={entry.member_id}
                  className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm flex items-center justify-center">
                      {idx + 1}
                    </div>
                    <span className="font-medium text-stone-900">
                      {isVorstand ? `#${idx + 1}` : formatShortName(entry.member_name)}
                    </span>
                  </div>
                  <span className="font-bold text-emerald-700">
                    {formatCurrency(entry.total)}
                  </span>
                </div>
              ))}
              {activeMembersRanking.length === 0 && (
                <p className="text-center text-stone-400 py-4">Keine aktiven Mitglieder</p>
              )}
            </div>
          </Card>

          <Card className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
            <h2 className="text-xl font-bold text-stone-900 mb-4">
              Passive {isVorstand ? '' : 'Mitglieder'} (Top 5)
            </h2>
            <div className="space-y-3">
              {passiveMembersRanking.slice(0, 5).map((entry, idx) => (
                <div 
                  key={entry.member_id}
                  className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-stone-100 text-stone-600 font-bold text-sm flex items-center justify-center">
                      {idx + 1}
                    </div>
                    <span className="font-medium text-stone-900">
                      {isVorstand ? `#${idx + 1}` : formatShortName(entry.member_name)}
                    </span>
                  </div>
                  <span className="font-bold text-stone-700">
                    {formatCurrency(entry.total)}
                  </span>
                </div>
              ))}
              {passiveMembersRanking.length === 0 && (
                <p className="text-center text-stone-400 py-4">Keine passiven Mitglieder</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Statistics;
