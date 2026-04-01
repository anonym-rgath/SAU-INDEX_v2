import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useTheme } from '../contexts/ThemeContext';
import { Switch } from '../components/ui/switch';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import { Globe, Moon, Languages, RefreshCw, Save } from 'lucide-react';

const SettingsSection = ({ icon: Icon, title, description, children }) => (
  <div data-testid={`settings-section-${title.toLowerCase().replace(/\s/g, '-')}`} className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 p-6 space-y-5">
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-stone-600 dark:text-stone-300" />
      </div>
      <div>
        <h2 className="font-semibold text-stone-900 dark:text-stone-100">{title}</h2>
        <p className="text-sm text-stone-500 dark:text-stone-400">{description}</p>
      </div>
    </div>
    <div className="space-y-4 pl-[52px]">
      {children}
    </div>
  </div>
);

const Settings = () => {
  const { darkMode, toggleDarkMode } = useTheme();
  const [language, setLanguage] = useState('de');

  // ICS state
  const [icsUrl, setIcsUrl] = useState('');
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [icsSaving, setIcsSaving] = useState(false);
  const [icsSyncing, setIcsSyncing] = useState(false);

  useEffect(() => {
    loadIcsSettings();
  }, []);

  const loadIcsSettings = async () => {
    try {
      const res = await api.ics.getSettings();
      setIcsUrl(res.data.ics_url || '');
      setSyncEnabled(res.data.sync_enabled || false);
      setLastSync(res.data.last_sync);
    } catch {
      // ignore on load
    }
  };

  const handleSaveIcs = async () => {
    setIcsSaving(true);
    try {
      await api.ics.updateSettings({ ics_url: icsUrl, sync_enabled: syncEnabled });
      toast.success('ICS-Einstellungen gespeichert');
    } catch {
      toast.error('Fehler beim Speichern der ICS-Einstellungen');
    } finally {
      setIcsSaving(false);
    }
  };

  const handleSyncNow = async () => {
    setIcsSyncing(true);
    try {
      const res = await api.ics.sync();
      toast.success(`Synchronisation abgeschlossen: ${res.data.created || 0} neu, ${res.data.updated || 0} aktualisiert`);
      loadIcsSettings();
    } catch {
      toast.error('Fehler bei der Synchronisation');
    } finally {
      setIcsSyncing(false);
    }
  };

  const formatLastSync = (dateStr) => {
    if (!dateStr) return 'Noch nie';
    return new Date(dateStr).toLocaleString('de-DE');
  };

  return (
    <div data-testid="settings-page" className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">
          Einstellungen
        </h1>
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
          App-Konfiguration und Darstellung anpassen
        </p>
      </div>

      {/* Sprache */}
      <SettingsSection
        icon={Languages}
        title="Sprache"
        description="Anzeigesprache der Anwendung"
      >
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
      <SettingsSection
        icon={Moon}
        title="Darstellung"
        description="Erscheinungsbild der Anwendung"
      >
        <div className="flex items-center justify-between">
          <div>
            <Label>Dark Mode</Label>
            <p className="text-xs text-stone-400 dark:text-stone-500">Dunkles Farbschema aktivieren</p>
          </div>
          <Switch
            data-testid="dark-mode-toggle"
            checked={darkMode}
            onCheckedChange={toggleDarkMode}
          />
        </div>
      </SettingsSection>

      {/* ICS-Kalender */}
      <SettingsSection
        icon={Globe}
        title="ICS-Kalender"
        description="Externen Kalender per ICS-URL abonnieren"
      >
        <div className="space-y-2">
          <Label>ICS-URL</Label>
          <Input
            data-testid="settings-ics-url-input"
            value={icsUrl}
            onChange={(e) => setIcsUrl(e.target.value)}
            placeholder="https://outlook.live.com/.../calendar.ics"
            className="h-12 rounded-xl border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-800 text-sm"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Automatische Synchronisation</Label>
            <p className="text-xs text-stone-400 dark:text-stone-500">Einmal täglich synchronisieren</p>
          </div>
          <Switch
            data-testid="settings-ics-sync-toggle"
            checked={syncEnabled}
            onCheckedChange={setSyncEnabled}
          />
        </div>

        <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-3">
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Letzte Synchronisation: <strong>{formatLastSync(lastSync)}</strong>
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            data-testid="settings-ics-save-button"
            onClick={handleSaveIcs}
            disabled={icsSaving}
            className="h-10 px-6 rounded-full bg-emerald-700 text-white font-medium hover:bg-emerald-800 transition-transform active:scale-95"
          >
            <Save className="w-4 h-4 mr-1.5" />
            {icsSaving ? 'Speichert...' : 'Speichern'}
          </Button>
          <Button
            data-testid="settings-ics-sync-button"
            onClick={handleSyncNow}
            disabled={icsSyncing || !icsUrl}
            variant="outline"
            className="h-10 px-5 rounded-full text-sm"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${icsSyncing ? 'animate-spin' : ''}`} />
            Jetzt synchronisieren
          </Button>
        </div>
      </SettingsSection>
    </div>
  );
};

export default Settings;
