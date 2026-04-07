import React, { useState, useEffect } from 'react';
import { Building2, CalendarDays, Save, Loader2, Globe, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
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

const Section = ({ icon: Icon, title, description, children }) => (
  <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 p-6 space-y-5">
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-stone-600 dark:text-stone-300" />
      </div>
      <div>
        <h2 className="font-semibold text-stone-900 dark:text-stone-100">{title}</h2>
        <p className="text-sm text-stone-500 dark:text-stone-400">{description}</p>
      </div>
    </div>
    <div className="space-y-4 pl-[52px]">{children}</div>
  </div>
);

const ClubSettings = () => {
  const [foundingDate, setFoundingDate] = useState('');
  const [fiscalYearStartMonth, setFiscalYearStartMonth] = useState(8);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ICS State
  const [icsUrl, setIcsUrl] = useState('');
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [icsSaving, setIcsSaving] = useState(false);
  const [icsSyncing, setIcsSyncing] = useState(false);

  useEffect(() => {
    Promise.all([loadSettings(), loadIcsSettings()]).finally(() => setLoading(false));
  }, []);

  const loadSettings = async () => {
    try {
      const res = await api.get('/club-settings');
      setFoundingDate(res.data.founding_date || '');
      setFiscalYearStartMonth(res.data.fiscal_year_start_month || 8);
    } catch {
      toast.error('Fehler beim Laden der Vereinsstammdaten');
    }
  };

  const loadIcsSettings = async () => {
    try {
      const res = await api.ics.getSettings();
      setIcsUrl(res.data.ics_url || '');
      setSyncEnabled(res.data.sync_enabled || false);
      setLastSync(res.data.last_sync);
    } catch { /* ignore */ }
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

  const handleSaveIcs = async () => {
    setIcsSaving(true);
    try {
      await api.ics.updateSettings({ ics_url: icsUrl, sync_enabled: syncEnabled });
      toast.success('ICS-Einstellungen gespeichert');
    } catch { toast.error('Fehler beim Speichern'); }
    finally { setIcsSaving(false); }
  };

  const handleSyncNow = async () => {
    setIcsSyncing(true);
    try {
      const res = await api.ics.sync();
      toast.success(`Sync: ${res.data.created || 0} neu, ${res.data.updated || 0} aktualisiert`);
      loadIcsSettings();
    } catch { toast.error('Sync fehlgeschlagen'); }
    finally { setIcsSyncing(false); }
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
          <h1 className="text-3xl md:text-4xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">Stammdaten des Vereins</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">Zentrale Angaben des Vereins</p>
        </div>

        {/* Gründungsdatum */}
        <Section icon={Building2} title="Gründungsdatum" description="Offizielles Gründungsdatum des Vereins">
          <input
            data-testid="founding-date-input"
            type="date"
            value={foundingDate}
            onChange={e => setFoundingDate(e.target.value)}
            className="w-full h-12 px-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-colors"
          />
        </Section>

        {/* Geschäftsjahr */}
        <Section icon={CalendarDays} title="Geschäftsjahr" description="Startmonat des Vereins-Geschäftsjahres">
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
        </Section>

        {/* Speichern Stammdaten */}
        <Button
          data-testid="save-club-settings-button"
          onClick={handleSave}
          disabled={saving}
          className="w-full h-12 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-base flex items-center justify-center gap-2 transition-colors"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {saving ? 'Speichern...' : 'Speichern'}
        </Button>

        {/* ICS-Kalender */}
        <Section icon={Globe} title="ICS-Kalender" description="Externen Kalender per ICS-URL abonnieren">
          <div className="space-y-2">
            <Label>ICS-URL</Label>
            <Input data-testid="settings-ics-url-input" value={icsUrl} onChange={(e) => setIcsUrl(e.target.value)} placeholder="https://outlook.live.com/.../calendar.ics" className="h-12 rounded-xl border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-800 text-sm" />
          </div>
          <div className="flex items-center justify-between">
            <div><Label>Automatische Synchronisation</Label><p className="text-xs text-stone-400 dark:text-stone-500">Einmal täglich synchronisieren</p></div>
            <Switch data-testid="settings-ics-sync-toggle" checked={syncEnabled} onCheckedChange={setSyncEnabled} />
          </div>
          <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-3">
            <p className="text-xs text-stone-500 dark:text-stone-400">Letzte Synchronisation: <strong>{lastSync ? new Date(lastSync).toLocaleString('de-DE') : 'Noch nie'}</strong></p>
          </div>
          <div className="flex gap-2">
            <Button data-testid="settings-ics-save-button" onClick={handleSaveIcs} disabled={icsSaving} className="h-10 px-6 rounded-full bg-emerald-700 text-white font-medium hover:bg-emerald-800 transition-transform active:scale-95">
              <Save className="w-4 h-4 mr-1.5" />{icsSaving ? 'Speichert...' : 'Speichern'}
            </Button>
            <Button data-testid="settings-ics-sync-button" onClick={handleSyncNow} disabled={icsSyncing || !icsUrl} variant="outline" className="h-10 px-5 rounded-full text-sm">
              <RefreshCw className={`w-4 h-4 mr-1.5 ${icsSyncing ? 'animate-spin' : ''}`} />Jetzt synchronisieren
            </Button>
          </div>
        </Section>
      </div>
    </div>
  );
};

export default ClubSettings;
