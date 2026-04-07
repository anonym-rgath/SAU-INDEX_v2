import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import { Moon, Languages } from 'lucide-react';

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

const Settings = () => {
  const { darkMode, toggleDarkMode } = useTheme();
  const [language, setLanguage] = useState('de');

  return (
    <div data-testid="settings-page" className="min-h-screen bg-stone-50 dark:bg-stone-950">
      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">Konsoleneinstellungen</h1>
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

    </div>
    </div>
  );
};

export default Settings;
