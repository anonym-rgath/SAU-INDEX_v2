import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { PiggyBank, Wallet, Plus, Trophy, Calendar, QrCode, User } from 'lucide-react';
import { toast } from 'sonner';
import AddFineDialog from '../components/AddFineDialog';
import QRScanDialog from '../components/QRScanDialog';
import { formatCurrency, formatDate } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

const PersonalFinesByType = ({ fines }) => {
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

  if (finesByType.length === 0) return null;

  return (
    <Card className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm p-4">
      <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100 mb-3">Strafen nach Art</h2>
      <div className="space-y-2">
        {finesByType.map(ft => (
          <div key={ft.label} className="flex items-center justify-between p-3 rounded-xl border border-stone-100 dark:border-stone-700 bg-stone-50 dark:bg-stone-800">
            <div>
              <p className="font-medium text-stone-900 dark:text-stone-100 text-sm">{ft.label}</p>
              <p className="text-xs text-stone-400">{ft.count}x</p>
            </div>
            <span className="font-bold text-emerald-700">{formatCurrency(ft.total)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
};

const PersonalMonthlyChart = ({ fines }) => {
  const monthlyData = useMemo(() => {
    const months = ['Aug', 'Sep', 'Okt', 'Nov', 'Dez', 'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul'];
    const data = months.map(m => ({ month: m, amount: 0 }));
    fines.forEach(f => {
      const d = new Date(f.date);
      const idx = d.getMonth() >= 7 ? d.getMonth() - 7 : d.getMonth() + 5;
      if (idx >= 0 && idx < 12) data[idx].amount += f.amount;
    });
    return data;
  }, [fines]);

  const maxAmount = Math.max(...monthlyData.map(d => d.amount), 1);

  return (
    <Card className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm p-4">
      <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100 mb-3">Verlauf über das Geschäftsjahr</h2>
      <div className="space-y-1">
        {monthlyData.map(m => (
          <div key={m.month} className="flex items-center gap-2">
            <span className="text-xs text-stone-500 dark:text-stone-400 w-8">{m.month}</span>
            <div className="flex-1 h-6 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
              {m.amount > 0 && (
                <div
                  className="h-full bg-emerald-600 rounded-full flex items-center justify-end pr-2"
                  style={{ width: `${Math.min(100, (m.amount / maxAmount) * 100)}%`, minWidth: '40px' }}
                >
                  <span className="text-xs text-white font-medium">{formatCurrency(m.amount)}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

const Dashboard = () => {
  const { canManageFines, isMitglied, isVorstand, isSpiess, isAdmin, user } = useAuth();
  const [fiscalYear, setFiscalYear] = useState('');
  const [fiscalYears, setFiscalYears] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [personalStats, setPersonalStats] = useState(null);
  const [recentFines, setRecentFines] = useState([]);
  const [myFines, setMyFines] = useState([]);
  const [members, setMembers] = useState([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Mitglied oder Vorstand zeigt nur persönliches Dashboard
  const showPersonalDashboard = isMitglied || isVorstand;
  // Spieß mit member_id zeigt zusätzlich seine eigenen Strafen im Admin-Dashboard
  const spiessHasLinkedMember = isSpiess && user?.member_id;
  // Persönliche Charts für alle nicht-Admin Rollen
  const showPersonalCharts = !isAdmin && user?.member_id;

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
      if (error?.code !== 'ERR_CANCELED') {
        toast.error('Fehler beim Laden der Geschäftsjahre');
      }
    }
  };

  const loadData = async () => {
    if (!fiscalYear) return;
    setLoading(true);
    try {
      if (showPersonalDashboard) {
        // Mitglied oder Vorstand mit Mitglied-Verknüpfung: Nur persönliche Daten laden
        const [personalRes, finesRes] = await Promise.all([
          api.statistics.getPersonal(fiscalYear),
          api.fines.getAll(fiscalYear),
        ]);
        setPersonalStats(personalRes.data);
        setRecentFines(finesRes.data.slice(0, 10));
      } else {
        // Admin/Spiess: Vollständige Statistiken laden
        const apiCalls = [
          api.statistics.getByFiscalYear(fiscalYear),
          api.fines.getAll(fiscalYear),
          api.members.getAll(),
        ];
        
        // Spieß mit verlinktem Mitglied: zusätzlich persönliche Stats laden
        if (spiessHasLinkedMember) {
          apiCalls.push(api.statistics.getPersonal(fiscalYear));
        }
        
        const results = await Promise.all(apiCalls);
        
        setStatistics(results[0].data);
        setRecentFines(results[1].data.slice(0, 6));
        setMembers(results[2].data);
        
        if (spiessHasLinkedMember && results[3]) {
          setPersonalStats(results[3].data);
          // Eigene Strafen für Spieß laden
          const allFines = results[1].data;
          const ownFines = allFines.filter(f => f.member_id === user.member_id);
          setMyFines(ownFines);
        }
      }
    } catch (error) {
      console.error('Fehler beim Laden der Daten:', error);
      if (error?.code !== 'ERR_CANCELED') {
        toast.error('Fehler beim Laden der Daten');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFineAdded = () => {
    setAddDialogOpen(false);
    loadData();
    toast.success('Strafe erfolgreich eingetragen');
  };

  const handleScanComplete = (memberId) => {
    setScanDialogOpen(false);
    setSelectedMemberId(memberId);
    setAddDialogOpen(true);
  };

  const getMemberName = (memberId) => {
    const member = members.find(m => m.id === memberId);
    if (!member) return 'Unbekannt';
    if (member.firstName && member.lastName) {
      return `${member.firstName} ${member.lastName}`;
    }
    return member.name || 'Unbekannt';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-stone-500 dark:text-stone-400">Laden...</div>
      </div>
    );
  }

  // Persönliches Dashboard (für Mitglied oder Vorstand mit Mitglied-Verknüpfung)
  if (showPersonalDashboard) {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-stone-950">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">
                Meine Übersicht
              </h1>
              <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
                {personalStats?.member_name || user?.username}
              </p>
            </div>
            
            <div className="flex items-center gap-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-full px-3 h-10 shadow-sm">
              <Calendar className="w-4 h-4 text-stone-400" />
              <select
                data-testid="fiscal-year-selector"
                value={fiscalYear}
                onChange={(e) => setFiscalYear(e.target.value)}
                className="bg-transparent border-none outline-none text-stone-700 dark:text-stone-200 font-medium cursor-pointer text-base"
              >
                {fiscalYears.map(fy => (
                  <option key={fy} value={fy}>{fy}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Persönliche Statistiken */}
          <Card className="bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/20 dark:to-stone-900 border-emerald-100 dark:border-emerald-900/40 rounded-2xl shadow-sm p-4 mb-6">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-stone-400 uppercase tracking-wider font-bold mb-0.5">
                  Meine Strafen
                </p>
                <p className="text-xs text-stone-500">Gesamt</p>
              </div>
              <div className="bg-emerald-100 p-2 rounded-lg">
                <Wallet className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
            <div data-testid="my-total">
              <p className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-0.5">
                {formatCurrency(personalStats?.total_amount || 0)}
              </p>
              <p className="text-sm text-stone-600 dark:text-stone-400">{personalStats?.total_fines || 0} Einträge</p>
            </div>
          </Card>

          {/* Meine Strafen */}
          <Card className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm p-4">
            <div className="flex items-center gap-3 mb-4">
              <User className="w-5 h-5 text-emerald-700" />
              <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">
                Meine Strafen
              </h2>
            </div>
            
            <div className="space-y-2" data-testid="my-fines-list">
              {recentFines.length > 0 ? (
                recentFines.map((fine) => (
                  <div
                    key={fine.id}
                    className="p-3 rounded-xl border border-stone-100 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <p className="font-semibold text-stone-900 dark:text-stone-100">
                        {fine.fine_type_label}
                      </p>
                      <span className="text-emerald-700 font-bold">
                        {formatCurrency(fine.amount)}
                      </span>
                    </div>
                    <p className="text-xs text-stone-400">
                      {formatDate(fine.date)}
                    </p>
                    {fine.notes && (
                      <p className="text-xs text-stone-500 mt-1">
                        {fine.notes}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-center text-stone-400 py-8">
                  Keine Strafen für {fiscalYear}
                </p>
              )}
            </div>
          </Card>

          {/* Strafen nach Art */}
          <PersonalFinesByType fines={recentFines} />

          {/* Monatsverlauf */}
          <PersonalMonthlyChart fines={recentFines} />
        </div>
      </div>
    );
  }

  // Admin/Spiess Dashboard (Original)
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">
              Dashboard
            </h1>
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
              Ranking & Strafen
            </p>
          </div>
          
          <div className="flex items-center gap-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-full px-3 h-10 shadow-sm">
            <Calendar className="w-4 h-4 text-stone-400" />
            <select
              data-testid="fiscal-year-selector"
              value={fiscalYear}
              onChange={(e) => setFiscalYear(e.target.value)}
              className="bg-transparent border-none outline-none text-stone-700 dark:text-stone-200 font-medium cursor-pointer text-base"
            >
              {fiscalYears.map(fy => (
                <option key={fy} value={fy}>{fy}</option>
              ))}
            </select>
          </div>
        </div>
        
        {/* Desktop-only buttons */}
        {canManageFines && (
          <div className="hidden md:flex gap-3 mb-6">
            <Button
              data-testid="scan-demo-button"
              onClick={() => setScanDialogOpen(true)}
              className="h-11 px-6 rounded-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
            >
              <QrCode className="w-4 h-4 mr-2" />
              QR Scan
            </Button>
            
            <Button
              data-testid="add-fine-button-desktop"
              onClick={() => {
                setSelectedMemberId(null);
                setAddDialogOpen(true);
              }}
              className="h-11 px-8 rounded-full bg-orange-500 text-white font-bold tracking-wide hover:bg-orange-600 hover:shadow-orange-500/30 transition-all uppercase text-sm shadow-lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              Strafe
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-pink-50 to-white dark:from-pink-900/20 dark:to-stone-900 border-pink-100 dark:border-pink-900/40 rounded-2xl shadow-sm p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-stone-400 uppercase tracking-wider font-bold mb-0.5">
                  Sau
                </p>
                <p className="text-xs text-stone-500">Höchster</p>
              </div>
              <div className="bg-pink-100 p-2 rounded-lg">
                <PiggyBank className="w-5 h-5 text-pink-500" />
              </div>
            </div>
            <div data-testid="sau-value">
              {statistics?.sau ? (
                <>
                  <p className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-0.5">
                    {formatCurrency(statistics.sau.total)}
                  </p>
                  <p className="text-sm text-stone-600 dark:text-stone-400 truncate">{statistics.sau.member_name}</p>
                </>
              ) : (
                <p className="text-stone-400 text-sm">Keine Daten</p>
              )}
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-stone-50 to-white dark:from-stone-800 dark:to-stone-900 border-stone-200 dark:border-stone-700 rounded-2xl shadow-sm p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-stone-400 uppercase tracking-wider font-bold mb-0.5">
                  Lämmchen
                </p>
                <p className="text-xs text-stone-500">Niedrigster</p>
              </div>
              <div className="bg-stone-100 p-2 rounded-lg">
                <Wallet className="w-5 h-5 text-stone-500" />
              </div>
            </div>
            <div data-testid="laemmchen-value">
              {statistics?.laemmchen ? (
                <>
                  <p className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-0.5">
                    {formatCurrency(statistics.laemmchen.total)}
                  </p>
                  <p className="text-sm text-stone-600 dark:text-stone-400 truncate">{statistics.laemmchen.member_name}</p>
                </>
              ) : (
                <p className="text-stone-400 text-sm">Keine Daten</p>
              )}
            </div>
          </Card>
        </div>

            <Card className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm p-4 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <Trophy className="w-5 h-5 text-emerald-700" />
                <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">
                  Ranking {fiscalYear}
                </h2>
              </div>
              
              <div className="space-y-2" data-testid="ranking-list">
                {statistics?.ranking && statistics.ranking.length > 0 ? (
                  statistics.ranking.map((entry) => (
                    <div
                      key={entry.member_id}
                      className="flex items-center gap-3 p-4 rounded-xl border border-stone-100 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 active:bg-stone-100 transition-colors min-h-[72px]"
                      data-testid={`ranking-entry-${entry.rank}`}
                    >
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm flex-shrink-0">
                        #{entry.rank}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-stone-900 dark:text-stone-100 truncate">{entry.member_name}</p>
                        <p className="text-sm text-stone-500">
                          {formatCurrency(entry.total)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-stone-400 py-8">
                    Noch keine Strafen für {fiscalYear}
                  </p>
                )}
              </div>
            </Card>

            <Card className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm p-4">
              <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">
                Letzte Strafen
              </h2>
              
              <div className="space-y-2" data-testid="recent-fines-list">
                {recentFines.length > 0 ? (
                  recentFines.map((fine) => (
                    <div
                      key={fine.id}
                      className="p-3 rounded-xl border border-stone-100 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                    >
                      <div className="flex items-start justify-between mb-1">
                        <p className="font-semibold text-stone-900 dark:text-stone-100">
                          {getMemberName(fine.member_id)}
                        </p>
                        <span className="text-emerald-700 font-bold">
                          {formatCurrency(fine.amount)}
                        </span>
                      </div>
                      <p className="text-xs text-stone-500">
                        {fine.fine_type_label}
                      </p>
                      <p className="text-xs text-stone-400 mt-1">
                        {formatDate(fine.date)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-stone-400 py-8">
                    Noch keine Strafen
                  </p>
                )}
              </div>
            </Card>

            {/* Meine Strafen - nur für Spieß mit verlinktem Mitglied */}
            {spiessHasLinkedMember && personalStats && (
              <Card className="bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/20 dark:to-stone-900 border-0 dark:border dark:border-emerald-900/40 rounded-2xl shadow-sm p-4 mt-6">
                <div className="flex items-center gap-3 mb-4">
                  <User className="w-5 h-5 text-emerald-700" />
                  <div>
                    <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">
                      Meine Strafen
                    </h2>
                    <p className="text-xs text-stone-500">
                      {personalStats.member_name}
                    </p>
                  </div>
                </div>
                
                {/* Persönliche Statistik */}
                <div className="bg-white/60 dark:bg-stone-800/60 rounded-xl p-3 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-stone-400 uppercase tracking-wider font-bold">Gesamt</p>
                      <p className="text-xl font-bold text-stone-900 dark:text-stone-100">{formatCurrency(personalStats.total_amount || 0)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-stone-400 uppercase tracking-wider font-bold">Einträge</p>
                      <p className="text-xl font-bold text-emerald-700">{personalStats.total_fines || 0}</p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2" data-testid="my-fines-list-spiess">
                  {myFines.length > 0 ? (
                    myFines.map((fine) => (
                      <div
                        key={fine.id}
                        className="p-3 rounded-xl bg-white/50 dark:bg-stone-800/50"
                      >
                        <div className="flex items-start justify-between mb-1">
                          <p className="font-semibold text-stone-900 dark:text-stone-100">
                            {fine.fine_type_label}
                          </p>
                          <span className="text-emerald-700 font-bold">
                            {formatCurrency(fine.amount)}
                          </span>
                        </div>
                        <p className="text-xs text-stone-400">
                          {formatDate(fine.date)}
                        </p>
                        {fine.notes && (
                          <p className="text-xs text-stone-500 mt-1">
                            {fine.notes}
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-stone-400 py-4 text-sm">
                      Keine Strafen für {fiscalYear}
                    </p>
                  )}
                </div>
              </Card>
            )}

          {/* Persönliche Charts für Spieß mit verknüpftem Mitglied */}
          {showPersonalCharts && (
            <>
              <PersonalFinesByType fines={myFines.length > 0 ? myFines : recentFines} />
              <PersonalMonthlyChart fines={myFines.length > 0 ? myFines : recentFines} />
            </>
          )}

          {/* Floating Action Button - nur für Admin */}
          {canManageFines && (
            <>
              <button
                data-testid="add-fine-fab"
                onClick={() => {
                  setSelectedMemberId(null);
                  setAddDialogOpen(true);
                }}
                className="fixed bottom-6 right-4 z-40 w-14 h-14 rounded-full bg-emerald-700 text-white shadow-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
              >
                <Plus className="w-6 h-6" />
              </button>

              <button
                data-testid="scan-fab"
                onClick={() => setScanDialogOpen(true)}
                className="fixed bottom-6 right-20 z-40 w-12 h-12 rounded-full bg-white border-2 border-stone-200 text-stone-700 shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
              >
                <QrCode className="w-5 h-5" />
              </button>
            </>
          )}
      </div>

      <AddFineDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={handleFineAdded}
        preselectedMemberId={selectedMemberId}
      />
      
      <QRScanDialog
        open={scanDialogOpen}
        onOpenChange={setScanDialogOpen}
        onScanComplete={handleScanComplete}
      />
    </div>
  );
};

export default Dashboard;