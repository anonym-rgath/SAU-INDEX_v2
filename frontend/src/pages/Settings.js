import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Switch } from '../components/ui/switch';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import { Globe, Moon, Languages, RefreshCw, Save, ShieldCheck } from 'lucide-react';

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
    <div className="space-y-4 pl-[52px]">{children}</div>
  </div>
);

const permIcon = (level) => {
  switch (level) {
    case 'full': return <span className="inline-block w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold leading-5 text-center">V</span>;
    case 'yes': return <span className="inline-block w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold leading-5 text-center">V</span>;
    case 'personal': return <span className="inline-block w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-bold leading-5 text-center">P</span>;
    case 'own': return <span className="inline-block w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-bold leading-5 text-center">E</span>;
    case 'read': return <span className="inline-block w-5 h-5 rounded-full bg-stone-400 text-white text-[10px] font-bold leading-5 text-center">L</span>;
    case 'limited': return <span className="inline-block w-5 h-5 rounded-full bg-stone-400 text-white text-[10px] font-bold leading-5 text-center">T</span>;
    case 'anon': return <span className="inline-block w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold leading-5 text-center">A</span>;
    case 'none': return <span className="inline-block w-5 h-5 rounded-full bg-stone-200 dark:bg-stone-700 text-stone-400 dark:text-stone-500 text-[10px] font-bold leading-5 text-center">&ndash;</span>;
    case 'no': return <span className="inline-block w-5 h-5 rounded-full bg-stone-200 dark:bg-stone-700 text-stone-400 dark:text-stone-500 text-[10px] font-bold leading-5 text-center">&ndash;</span>;
    default: return null;
  }
};

const permLabel = { full: 'Vollzugriff', yes: 'Ja', personal: 'Persönlich', own: 'Eigene', read: 'Lesen', limited: 'Teilweise', anon: 'Anonymisiert', none: 'Kein Zugriff', no: 'Nein' };

const PermRow = ({ label, admin, spiess, vorstand, mitglied, section }) => {
  if (section) {
    return (
      <tr className="bg-stone-50 dark:bg-stone-800/50">
        <td colSpan={5} className="p-2 font-bold text-stone-700 dark:text-stone-300 text-xs tracking-wide uppercase">{label}</td>
      </tr>
    );
  }
  return (
    <tr className="hover:bg-stone-50 dark:hover:bg-stone-800/30 transition-colors">
      <td className="p-2.5 text-stone-700 dark:text-stone-300 font-medium">{label}</td>
      {[admin, spiess, vorstand, mitglied].map((level, i) => (
        <td key={i} className="text-center p-2.5">
          <div className="flex flex-col items-center gap-0.5">
            {permIcon(level)}
            <span className="text-[9px] text-stone-400 dark:text-stone-500 leading-none">{permLabel[level]}</span>
          </div>
        </td>
      ))}
    </tr>
  );
};

const Settings = () => {
  const { darkMode, toggleDarkMode } = useTheme();
  const { canManageICS, isMitglied } = useAuth();
  const [language, setLanguage] = useState('de');

  const [icsUrl, setIcsUrl] = useState('');
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [icsSaving, setIcsSaving] = useState(false);
  const [icsSyncing, setIcsSyncing] = useState(false);

  useEffect(() => { if (canManageICS) loadIcsSettings(); }, [canManageICS]);

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
    <div data-testid="settings-page" className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">Einstellungen</h1>
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">App-Konfiguration und Darstellung</p>
      </div>

      {/* Sprache */}
      <SettingsSection icon={Languages} title="Sprache" description="Anzeigesprache der Anwendung">
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
      <SettingsSection icon={Moon} title="Darstellung" description="Erscheinungsbild der Anwendung">
        <div className="flex items-center justify-between">
          <div>
            <Label>Dark Mode</Label>
            <p className="text-xs text-stone-400 dark:text-stone-500">Dunkles Farbschema aktivieren</p>
          </div>
          <Switch data-testid="dark-mode-toggle" checked={darkMode} onCheckedChange={toggleDarkMode} />
        </div>
      </SettingsSection>

      {/* ICS - nur für Admin */}
      {canManageICS && (
        <SettingsSection icon={Globe} title="ICS-Kalender" description="Externen Kalender per ICS-URL abonnieren">
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
        </SettingsSection>
      )}

      {/* Benutzerrollen - nicht für Mitglied */}
      {!isMitglied && (
      <SettingsSection icon={ShieldCheck} title="Benutzerrollen" description="Übersicht der verfügbaren Rollen und Berechtigungen">
        <div className="space-y-3">
          {[
            { role: 'Admin', desc: 'Vollzugriff auf alle Bereiche. System-Account, nicht als Mitglied geführt.', color: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800' },
            { role: 'Spieß', desc: 'Verwaltet Mitglieder, Strafen und Termine. Sieht erweiterte Statistiken mit vollem Einblick.', color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
            { role: 'Vorstand', desc: 'Verwaltet Mitglieder und Termine. Sieht erweiterte Statistiken anonymisiert.', color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800' },
            { role: 'Mitglied', desc: 'Sieht persönliches Dashboard, eigene Strafen und Statistiken. Termine ohne Strafen-Details.', color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' },
          ].map(r => (
            <div key={r.role} className={`rounded-xl border p-3 ${r.color}`}>
              <p className="font-semibold text-sm">{r.role}</p>
              <p className="text-xs opacity-80 mt-0.5">{r.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-stone-400 dark:text-stone-500 mb-2">Rollen werden über die Benutzerverwaltung zugewiesen.</p>

        {/* Berechtigungsmatrix */}
        <div className="mt-2 -ml-[52px] pl-0">
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 text-sm mb-3 ml-[52px]">Berechtigungsmatrix</h3>
          <div className="overflow-x-auto rounded-xl border border-stone-200 dark:border-stone-700">
            <table className="w-full text-xs" data-testid="permissions-matrix">
              <thead>
                <tr className="bg-stone-100 dark:bg-stone-800">
                  <th className="text-left p-2.5 font-semibold text-stone-700 dark:text-stone-300 min-w-[180px]">Bereich / Funktion</th>
                  <th className="text-center p-2.5 font-semibold text-red-700 dark:text-red-400 w-20">Admin</th>
                  <th className="text-center p-2.5 font-semibold text-amber-700 dark:text-amber-400 w-20">Spieß</th>
                  <th className="text-center p-2.5 font-semibold text-blue-700 dark:text-blue-400 w-20">Vorstand</th>
                  <th className="text-center p-2.5 font-semibold text-emerald-700 dark:text-emerald-400 w-20">Mitglied</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-700">
                <PermRow section label="Seiten" />
                <PermRow label="Dashboard" admin="full" spiess="full" vorstand="full" mitglied="personal" />
                <PermRow label="Termine" admin="full" spiess="full" vorstand="full" mitglied="read" />
                <PermRow label="Strafenübersicht" admin="full" spiess="full" vorstand="own" mitglied="own" />
                <PermRow label="Statistiken" admin="personal" spiess="none" vorstand="none" mitglied="none" />
                <PermRow label="Statistiken (Erweitert)" admin="full" spiess="full" vorstand="anon" mitglied="none" />
                <PermRow label="Einstellungen" admin="full" spiess="full" vorstand="full" mitglied="limited" />

                <PermRow section label="Verwaltung" />
                <PermRow label="Benutzerverwaltung" admin="full" spiess="full" vorstand="full" mitglied="none" />
                <PermRow label="App-Zugang verwalten" admin="yes" spiess="yes" vorstand="no" mitglied="no" />
                <PermRow label="Strafenarten" admin="full" spiess="full" vorstand="full" mitglied="none" />
                <PermRow label="Audit-Log" admin="full" spiess="none" vorstand="none" mitglied="none" />

                <PermRow section label="Termine - Details" />
                <PermRow label="Strafen-Badge sichtbar" admin="yes" spiess="yes" vorstand="yes" mitglied="no" />
                <PermRow label="Strafbetrag sichtbar" admin="yes" spiess="yes" vorstand="yes" mitglied="no" />
                <PermRow label="Termine erstellen" admin="yes" spiess="yes" vorstand="yes" mitglied="no" />
                <PermRow label="Zu-/Absage" admin="yes" spiess="yes" vorstand="yes" mitglied="yes" />
                <PermRow label="Rückmeldungen einsehen" admin="yes" spiess="yes" vorstand="yes" mitglied="no" />

                <PermRow section label="Strafen" />
                <PermRow label="Alle Strafen einsehen" admin="yes" spiess="yes" vorstand="no" mitglied="no" />
                <PermRow label="Eigene Strafen einsehen" admin="yes" spiess="yes" vorstand="yes" mitglied="yes" />
                <PermRow label="Strafen erstellen" admin="yes" spiess="yes" vorstand="no" mitglied="no" />

                <PermRow section label="Einstellungen - Details" />
                <PermRow label="Sprache & Dark Mode" admin="yes" spiess="yes" vorstand="yes" mitglied="yes" />
                <PermRow label="ICS-Kalender" admin="yes" spiess="yes" vorstand="yes" mitglied="no" />
                <PermRow label="Benutzerrollen (Ansicht)" admin="yes" spiess="yes" vorstand="yes" mitglied="no" />
              </tbody>
            </table>
          </div>
        </div>
      </SettingsSection>
      )}
    </div>
  );
};

export default Settings;
