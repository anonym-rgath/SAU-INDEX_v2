import React, { useState, useEffect } from 'react';
import { Building2, CalendarDays, Save, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { api } from '../lib/api';
import { toast } from 'sonner';

const MONTHS = [
  { value: 1, label: 'Januar' },
  { value: 2, label: 'Februar' },
  { value: 3, label: 'März' },
  { value: 4, label: 'April' },
  { value: 5, label: 'Mai' },
  { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' },
  { value: 12, label: 'Dezember' },
];

const ClubSettings = () => {
  const [foundingDate, setFoundingDate] = useState('');
  const [fiscalYearStartMonth, setFiscalYearStartMonth] = useState(8);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await api.get('/club-settings');
      setFoundingDate(res.data.founding_date || '');
      setFiscalYearStartMonth(res.data.fiscal_year_start_month || 8);
    } catch {
      toast.error('Fehler beim Laden der Vereinsstammdaten');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!foundingDate) {
      toast.error('Gründungsdatum ist ein Pflichtfeld');
      return;
    }

    setSaving(true);
    try {
      await api.put('/club-settings', {
        founding_date: foundingDate,
        fiscal_year_start_month: fiscalYearStartMonth,
      });
      toast.success('Vereinsstammdaten gespeichert');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const getFiscalYearPreview = () => {
    const month = MONTHS.find(m => m.value === fiscalYearStartMonth);
    const now = new Date();
    let startYear = now.getFullYear();
    if (now.getMonth() + 1 < fiscalYearStartMonth) startYear--;
    return `${month?.label} ${startYear} – ${MONTHS[(fiscalYearStartMonth - 2 + 12) % 12]?.label} ${startYear + 1}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <div data-testid="club-settings-page" className="min-h-screen bg-stone-50 dark:bg-stone-950">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">Stammdaten</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">Zentrale Angaben des Vereins</p>
        </div>

        {/* Gründungsdatum */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 p-6 space-y-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-stone-600 dark:text-stone-300" />
            </div>
            <div>
              <h2 className="font-semibold text-stone-900 dark:text-stone-100">Gründungsdatum</h2>
              <p className="text-sm text-stone-500 dark:text-stone-400">Offizielles Gründungsdatum des Vereins</p>
            </div>
          </div>
          <div className="pl-[52px]">
            <input
              data-testid="founding-date-input"
              type="date"
              value={foundingDate}
              onChange={e => setFoundingDate(e.target.value)}
              className="w-full h-12 px-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-colors"
            />
          </div>
        </div>

        {/* Geschäftsjahr */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 p-6 space-y-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center shrink-0">
              <CalendarDays className="w-5 h-5 text-stone-600 dark:text-stone-300" />
            </div>
            <div>
              <h2 className="font-semibold text-stone-900 dark:text-stone-100">Geschäftsjahr</h2>
              <p className="text-sm text-stone-500 dark:text-stone-400">Startmonat des Vereins-Geschäftsjahres</p>
            </div>
          </div>
          <div className="pl-[52px] space-y-3">
            <select
              data-testid="fiscal-year-month-select"
              value={fiscalYearStartMonth}
              onChange={e => setFiscalYearStartMonth(Number(e.target.value))}
              className="w-full h-12 px-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-colors appearance-none"
            >
              {MONTHS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <p className="text-xs text-stone-400 dark:text-stone-500">
              Aktuelles Geschäftsjahr: {getFiscalYearPreview()}
            </p>
          </div>
        </div>

        {/* Speichern */}
        <Button
          data-testid="save-club-settings-button"
          onClick={handleSave}
          disabled={saving}
          className="w-full h-12 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-base flex items-center justify-center gap-2 transition-colors"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {saving ? 'Speichern...' : 'Speichern'}
        </Button>
      </div>
    </div>
  );
};

export default ClubSettings;
