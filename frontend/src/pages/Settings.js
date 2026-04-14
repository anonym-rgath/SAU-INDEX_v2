import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import { SlidersHorizontal, Save, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { toast } from 'sonner';

const SettingsSection = ({ title, description, children }) => (
  <div data-testid={`settings-section-${title.toLowerCase().replace(/\s/g, '-')}`} className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 p-6 space-y-5">
    <div>
      <h2 className="font-semibold text-stone-900 dark:text-stone-100">{title}</h2>
      <p className="text-sm text-stone-500 dark:text-stone-400">{description}</p>
    </div>
    <div className="space-y-4">{children}</div>
  </div>
);

const Settings = () => {
  const { darkMode, toggleDarkMode } = useTheme();
  const { isMitglied } = useAuth();
  const canEdit = !isMitglied;
  const [language, setLanguage] = useState('de');

  const [icsUrl, setIcsUrl] = useState('');
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [icsSaving, setIcsSaving] = useState(false);
  const [icsSyncing, setIcsSyncing] = useState(false);

  useEffect(() => {
    if (canEdit) loadIcsSettings();
  }, []);

  const loadIcsSettings = async () => {
    try {
      const res = await api.ics.getSettings();
      setIcsUrl(res.data.ics_url || '');
      setSyncEnabled(res.data.sync_enabled || false);
      setLastSync(res.data.last_sync);
    } catch { /* ignore */ }
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

  return (
    <div data-testid="settings-page" className="min-h-screen bg-stone-50 dark:bg-stone-950">
      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-3">
          <SlidersHorizontal className="w-7 h-7 text-emerald-700 dark:text-emerald-400" />
          <h1 className="text-3xl md:text-4xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">Einstellungen</h1>
        </div>
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">App-Konfiguration und Darstellung</p>
      </div>

      {/* Sprache */}
      <SettingsSection title="Sprache" description="Anzeigesprache der Anwendung">
        <div className="space-y-2">
          <Label>Sprache</Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger data-testid="language-select" className="h-12 rounded-xl border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-800 text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="de">Deutsch</SelectItem>
              <SelectItem value="en" disabled>English (demnächst)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-stone-400 dark:text-stone-500">Weitere Sprachen werden in Zukunft verfügbar sein.</p>
        </div>
      </SettingsSection>

      {/* Darstellung */}
      <SettingsSection title="Darstellung" description="Erscheinungsbild der Anwendung">
        <div className="flex items-center justify-between">
          <div>
            <Label>Dark Mode</Label>
            <p className="text-xs text-stone-400 dark:text-stone-500">Dunkles Farbschema aktivieren</p>
          </div>
          <Switch data-testid="dark-mode-toggle" checked={darkMode} onCheckedChange={toggleDarkMode} />
        </div>
      </SettingsSection>

      {/* ICS-Kalender - nur für Admin/Spieß/Vorstand */}
      {canEdit && (
        <SettingsSection title="ICS-Kalender" description="Externen Kalender per ICS-URL abonnieren">
          <div>
            <Label className="mb-1.5 block">ICS-URL</Label>
            <Input data-testid="settings-ics-url-input" value={icsUrl} onChange={(e) => setIcsUrl(e.target.value)} placeholder="https://outlook.live.com/.../calendar.ics" className="h-12 rounded-xl border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-800 text-sm" />
          </div>
          <div className="flex items-center justify-between">
            <div><Label>Automatische Synchronisation</Label><p className="text-xs text-stone-400 dark:text-stone-500">Einmal täglich synchronisieren</p></div>
            <Switch data-testid="settings-ics-sync-toggle" checked={syncEnabled} onCheckedChange={setSyncEnabled} />
          </div>
          <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-3">
            <p className="text-xs text-stone-500 dark:text-stone-400">Letzte Synchronisation: <strong>{lastSync ? new Date(lastSync).toLocaleString('de-DE') : 'Noch nie'}</strong></p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button data-testid="settings-ics-save-button" onClick={handleSaveIcs} disabled={icsSaving} className="h-10 px-6 rounded-full bg-emerald-700 text-white font-medium hover:bg-emerald-800 transition-transform active:scale-95">
              <Save className="w-4 h-4 mr-1.5" />{icsSaving ? 'Speichert...' : 'Speichern'}
            </Button>
            <Button data-testid="settings-ics-sync-button" onClick={handleSyncNow} disabled={icsSyncing || !icsUrl} variant="outline" className="h-10 px-5 rounded-full text-sm">
              <RefreshCw className={`w-4 h-4 mr-1.5 ${icsSyncing ? 'animate-spin' : ''}`} />Jetzt synchronisieren
            </Button>
          </div>
        </SettingsSection>
      )}

    </div>
    </div>
  );
};

export default Settings;
