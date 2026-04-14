import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { PiggyBank, Wallet, Plus, Trophy, Calendar, QrCode, User, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import AddFineDialog from '../components/AddFineDialog';
import QRScanDialog from '../components/QRScanDialog';
import { formatCurrency, formatDate } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

// --- Persönliche Komponenten ---

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

  return (
    <Card className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm p-4">
      <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100 mb-3">Strafen nach Art</h2>
      {finesByType.length > 0 ? (
        <div className="space-y-2">
          {finesByType.map(ft => (
            <div key={ft.label} className="flex items-center justify-between p-3 rounded-xl border border-stone-100 dark:border-stone-700 bg-stone-50 dark:bg-stone-800">
              <div>
                <p className="font-medium text-stone-900 dark:text-stone-100 text-sm">{ft.label}</p>
                <p className="text-xs text-stone-400 dark:text-stone-500">{ft.count}x</p>
              </div>
              <span className="font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(ft.total)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-stone-400 dark:text-stone-500 py-6 text-sm">Keine Daten</p>
      )}
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

// --- Dashboard ---

const Dashboard = () => {
  const { canManageFines, isSpiess, isAdmin, user } = useAuth();
  const [fiscalYear, setFiscalYear] = useState('');
  const [fiscalYears, setFiscalYears] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [personalStats, setPersonalStats] = useState(null);
  const [myFines, setMyFines] = useState([]);
  const [members, setMembers] = useState([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [loading, setLoading] = useState(true);

  const showAdminSection = isAdmin || isSpiess;
  const hasMemberProfile = !!user?.member_id;

  const loadInitialData = useCallback(async () => {
    try {
      const yearsRes = await api.fiscalYears.getAll();
      const years = yearsRes.data?.fiscal_years || [];
      setFiscalYears(years);
      if (years.length > 0) setFiscalYear(years[0]);
    } catch (error) {
      if (error?.code !== 'ERR_CANCELED') toast.error('Fehler beim Laden der Geschäftsjahre');
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!fiscalYear) return;
    setLoading(true);
    try {
      const calls = [];

      // Persönliche Daten für alle mit Member-Profil
      if (hasMemberProfile) {
        calls.push(api.statistics.getPersonal(fiscalYear));
        calls.push(api.fines.getAll(fiscalYear));
      }

      // Admin/Spieß: Globale Stats + Ranking
      if (showAdminSection) {
        calls.push(api.statistics.getByFiscalYear(fiscalYear));
        calls.push(api.members.getAll());
      }

      const results = await Promise.all(calls);
      let idx = 0;

      if (hasMemberProfile) {
        setPersonalStats(results[idx++].data);
        const allFines = results[idx++].data;
        setMyFines(allFines.filter(f => f.member_id === user.member_id));
      }

      if (showAdminSection) {
        setStatistics(results[idx++].data);
        setMembers(results[idx++].data);
      }
    } catch (error) {
      if (error?.code !== 'ERR_CANCELED') toast.error('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  }, [fiscalYear, hasMemberProfile, showAdminSection, user?.member_id]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (fiscalYear) loadData();
  }, [fiscalYear, loadData]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-stone-500 dark:text-stone-400">Laden...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950">
      <div className="max-w-2xl lg:max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">
              Dashboard
            </h1>
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
              {hasMemberProfile ? (personalStats?.member_name || user?.username) : ''}
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
              {fiscalYears.map(fy => <option key={fy} value={fy}>{fy}</option>)}
            </select>
          </div>
        </div>

        {/* Desktop Buttons (Admin/Spieß) */}
        {canManageFines && (
          <div className="hidden md:flex gap-3">
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
              onClick={() => { setSelectedMemberId(null); setAddDialogOpen(true); }}
              className="h-11 px-8 rounded-full bg-emerald-700 text-white font-bold tracking-wide hover:bg-emerald-800 hover:shadow-emerald-700/30 transition-all uppercase text-sm shadow-lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              Strafe
            </Button>
          </div>
        )}

        {/* ============================================ */}
        {/* LAYOUT: Desktop 2-Spalten / Mobil 1-Spalte */}
        {/* ============================================ */}
        <div className={showAdminSection ? "grid grid-cols-1 lg:grid-cols-2 gap-6" : ""}>
        {/* ============================================ */}
        {/* BEREICH 1: Persönlich (alle Rollen) */}
        {/* ============================================ */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider flex items-center gap-2">
            <User className="w-4 h-4" />
            Meine Übersicht
          </h2>

          {hasMemberProfile ? (
            <>
              {/* Meine Strafen */}
              <Card className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm p-4">
                <div className="mb-3">
                    <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">Meine Strafen</h3>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      {formatCurrency(personalStats?.total_amount || 0)} gesamt
                      <span className="mx-1.5 text-stone-300 dark:text-stone-600">|</span>
                      {personalStats?.total_fines || 0} Einträge
                    </p>
                </div>

                <div className="space-y-2" data-testid="my-fines-list">
                  {myFines.length > 0 ? (
                    myFines.slice(0, 5).map((fine) => (
                      <div key={fine.id} className="p-3 rounded-xl border border-stone-100 dark:border-stone-700 bg-stone-50 dark:bg-stone-800">
                        <div className="flex items-start justify-between mb-1">
                          <p className="font-semibold text-stone-900 dark:text-stone-100 text-sm">{fine.fine_type_label}</p>
                          <span className="text-emerald-700 dark:text-emerald-400 font-bold text-sm">{formatCurrency(fine.amount)}</span>
                        </div>
                        <p className="text-xs text-stone-400 dark:text-stone-500">{formatDate(fine.date)}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-stone-400 dark:text-stone-500 py-6 text-sm">Keine Strafen für {fiscalYear}</p>
                  )}
                </div>
              </Card>

              {/* Strafen nach Art */}
              <PersonalFinesByType fines={myFines} />

              {/* Verlauf */}
              <PersonalMonthlyChart fines={myFines} />

              {/* Finanzdaten */}
              <Card className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm p-4" data-testid="finanzdaten-card">
                <div className="mb-3">
                  <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">Finanzdaten</h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">Beiträge und Sparguthaben</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 rounded-xl border border-stone-100 dark:border-stone-700 bg-stone-50 dark:bg-stone-800">
                    <div>
                      <p className="font-semibold text-stone-900 dark:text-stone-100 text-sm">Offene Beiträge</p>
                      <p className="text-xs text-stone-400 dark:text-stone-500">Aktuell noch zu zahlende Beiträge</p>
                    </div>
                    <span className="text-red-600 dark:text-red-400 font-bold text-sm" data-testid="offene-beitraege">{formatCurrency(0)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl border border-stone-100 dark:border-stone-700 bg-stone-50 dark:bg-stone-800">
                    <div>
                      <p className="font-semibold text-stone-900 dark:text-stone-100 text-sm">Gezahlte Beiträge</p>
                      <p className="text-xs text-stone-400 dark:text-stone-500">Bereits gezahlte Beiträge</p>
                    </div>
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold text-sm" data-testid="gezahlte-beitraege">{formatCurrency(0)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl border border-stone-100 dark:border-stone-700 bg-stone-50 dark:bg-stone-800">
                    <div>
                      <p className="font-semibold text-stone-900 dark:text-stone-100 text-sm">Sparbetrag</p>
                      <p className="text-xs text-stone-400 dark:text-stone-500">Aktuell angesparter Betrag</p>
                    </div>
                    <span className="text-stone-700 dark:text-stone-300 font-bold text-sm" data-testid="sparbetrag">{formatCurrency(0)}</span>
                  </div>
                </div>
              </Card>
            </>
          ) : (
            <Card className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm p-6">
              <p className="text-stone-400 dark:text-stone-500 text-sm text-center">
                Kein Mitgliedsprofil verknüpft. Persönliche Daten werden hier angezeigt, sobald ein Profil zugeordnet ist.
              </p>
            </Card>
          )}
        </div>

        {/* ============================================ */}
        {/* BEREICH 2: Verwaltung (nur Admin & Spieß) */}
        {/* ============================================ */}
        {showAdminSection && statistics && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider flex items-center gap-2 pt-2">
              <TrendingUp className="w-4 h-4" />
              Vereinsübersicht
            </h2>

            {/* Sau & Lämmchen */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-gradient-to-br from-pink-50 to-white dark:from-pink-900/20 dark:to-stone-900 border-pink-100 dark:border-pink-900/40 rounded-2xl shadow-sm p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs text-stone-400 dark:text-stone-500 uppercase tracking-wider font-bold mb-0.5">Sau</p>
                    <p className="text-xs text-stone-500 dark:text-stone-400">Höchster</p>
                  </div>
                  <div className="bg-pink-100 dark:bg-pink-900/40 p-2 rounded-lg">
                    <PiggyBank className="w-5 h-5 text-pink-500 dark:text-pink-400" />
                  </div>
                </div>
                <div data-testid="sau-value">
                  {statistics.sau ? (
                    <>
                      <p className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-0.5">{formatCurrency(statistics.sau.total)}</p>
                      <p className="text-sm text-stone-600 dark:text-stone-400 truncate">{statistics.sau.member_name}</p>
                    </>
                  ) : (
                    <p className="text-stone-400 dark:text-stone-500 text-sm">Keine Daten</p>
                  )}
                </div>
              </Card>

              <Card className="bg-gradient-to-br from-stone-50 to-white dark:from-stone-800 dark:to-stone-900 border-stone-200 dark:border-stone-700 rounded-2xl shadow-sm p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs text-stone-400 dark:text-stone-500 uppercase tracking-wider font-bold mb-0.5">Lämmchen</p>
                    <p className="text-xs text-stone-500 dark:text-stone-400">Niedrigster</p>
                  </div>
                  <div className="bg-stone-100 dark:bg-stone-700 p-2 rounded-lg">
                    <Wallet className="w-5 h-5 text-stone-500 dark:text-stone-400" />
                  </div>
                </div>
                <div data-testid="laemmchen-value">
                  {statistics.laemmchen ? (
                    <>
                      <p className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-0.5">{formatCurrency(statistics.laemmchen.total)}</p>
                      <p className="text-sm text-stone-600 dark:text-stone-400 truncate">{statistics.laemmchen.member_name}</p>
                    </>
                  ) : (
                    <p className="text-stone-400 dark:text-stone-500 text-sm">Keine Daten</p>
                  )}
                </div>
              </Card>
            </div>

            {/* Ranking */}
            <Card className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm p-4">
              <div className="flex items-center gap-3 mb-4">
                <Trophy className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 tracking-tight">
                  Ranking {fiscalYear}
                </h3>
              </div>
              <div className="space-y-2" data-testid="ranking-list">
                {statistics.ranking && statistics.ranking.length > 0 ? (
                  statistics.ranking.slice(0, 5).map((entry) => (
                    <div
                      key={entry.member_id}
                      className="flex items-center gap-3 p-4 rounded-xl border border-stone-100 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 transition-colors min-h-[72px]"
                      data-testid={`ranking-entry-${entry.rank}`}
                    >
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 font-bold text-sm flex-shrink-0">
                        #{entry.rank}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-stone-900 dark:text-stone-100 truncate">{entry.member_name}</p>
                        <p className="text-sm text-stone-500 dark:text-stone-400">{formatCurrency(entry.total)}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-stone-400 dark:text-stone-500 py-8">Noch keine Strafen für {fiscalYear}</p>
                )}
              </div>
            </Card>
          </div>
        )}
        </div>{/* End grid wrapper */}

        {/* Floating Action Buttons (nur mobil) */}
        {canManageFines && (
          <div className="md:hidden">
            <button
              data-testid="add-fine-fab"
              onClick={() => { setSelectedMemberId(null); setAddDialogOpen(true); }}
              className="fixed bottom-6 right-4 z-40 w-14 h-14 rounded-full bg-emerald-700 text-white shadow-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
            >
              <Plus className="w-6 h-6" />
            </button>
            <button
              data-testid="scan-fab"
              onClick={() => setScanDialogOpen(true)}
              className="fixed bottom-6 right-20 z-40 w-12 h-12 rounded-full bg-white dark:bg-stone-800 border-2 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
            >
              <QrCode className="w-5 h-5" />
            </button>
          </div>
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
