import React from 'react';
import { ShieldCheck } from 'lucide-react';

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

const ROLES = [
  { role: 'Admin', desc: 'Vollzugriff auf alle Bereiche. System-Account, nicht als Mitglied geführt.', color: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800' },
  { role: 'Spieß', desc: 'Verwaltet Mitglieder, Strafen und Termine. Sieht erweiterte Statistiken mit vollem Einblick.', color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
  { role: 'Vorstand', desc: 'Verwaltet Mitglieder und Termine. Sieht erweiterte Statistiken anonymisiert.', color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800' },
  { role: 'Mitglied', desc: 'Sieht persönliches Dashboard, eigene Strafen und Statistiken. Termine ohne Strafen-Details.', color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' },
];

const Roles = () => {
  return (
    <div data-testid="roles-page" className="min-h-screen bg-stone-50 dark:bg-stone-950">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">Benutzerrollen</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">Rollen und Berechtigungen im Überblick</p>
        </div>

        {/* Rollenbeschreibungen */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 p-6 space-y-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-stone-600 dark:text-stone-300" />
            </div>
            <div>
              <h2 className="font-semibold text-stone-900 dark:text-stone-100">Verfügbare Rollen</h2>
              <p className="text-sm text-stone-500 dark:text-stone-400">Jede Rolle bestimmt den Funktionsumfang in der App</p>
            </div>
          </div>
          <div className="space-y-3 pl-[52px]">
            {ROLES.map(r => (
              <div key={r.role} className={`rounded-xl border p-3 ${r.color}`}>
                <p className="font-semibold text-sm">{r.role}</p>
                <p className="text-xs opacity-80 mt-0.5">{r.desc}</p>
              </div>
            ))}
            <p className="text-xs text-stone-400 dark:text-stone-500">Rollen werden über die Benutzerverwaltung zugewiesen.</p>
          </div>
        </div>

        {/* Berechtigungsmatrix */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 p-6">
          <h2 className="font-semibold text-stone-900 dark:text-stone-100 mb-4">Berechtigungsmatrix</h2>
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
                <PermRow label="Statistiken (Erweitert)" admin="full" spiess="full" vorstand="anon" mitglied="none" />
                <PermRow label="Einstellungen" admin="full" spiess="full" vorstand="full" mitglied="limited" />

                <PermRow section label="Verwaltung" />
                <PermRow label="Benutzerrollen" admin="full" spiess="full" vorstand="full" mitglied="none" />
                <PermRow label="Benutzerverwaltung" admin="full" spiess="full" vorstand="full" mitglied="none" />
                <PermRow label="App-Zugang verwalten" admin="yes" spiess="yes" vorstand="yes" mitglied="no" />
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
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Roles;
