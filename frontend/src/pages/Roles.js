import React from 'react';
import { ShieldCheck } from 'lucide-react';

const permIcon = (level) => {
  switch (level) {
    case 'full': return <span className="inline-block w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold leading-5 text-center">V</span>;
    case 'yes': return <span className="inline-block w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold leading-5 text-center">V</span>;
    case 'personal': return <span className="inline-block w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-bold leading-5 text-center">P</span>;
    case 'own': return <span className="inline-block w-5 h-5 rounded-full bg-violet-500 text-white text-[10px] font-bold leading-5 text-center">T</span>;
    case 'read': return <span className="inline-block w-5 h-5 rounded-full bg-violet-500 text-white text-[10px] font-bold leading-5 text-center">T</span>;
    case 'limited': return <span className="inline-block w-5 h-5 rounded-full bg-violet-500 text-white text-[10px] font-bold leading-5 text-center">T</span>;
    case 'anon': return <span className="inline-block w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold leading-5 text-center">A</span>;
    case 'none': return <span className="inline-block w-5 h-5 rounded-full bg-stone-200 dark:bg-stone-700 text-stone-400 dark:text-stone-500 text-[10px] font-bold leading-5 text-center">&ndash;</span>;
    case 'no': return <span className="inline-block w-5 h-5 rounded-full bg-stone-200 dark:bg-stone-700 text-stone-400 dark:text-stone-500 text-[10px] font-bold leading-5 text-center">&ndash;</span>;
    default: return null;
  }
};

const permLabel = { full: 'Vollzugriff', yes: 'Vollzugriff', personal: 'Persönlich', own: 'Teilweise', read: 'Teilweise', limited: 'Teilweise', anon: 'Anonymisiert', none: 'Kein Zugriff', no: 'Kein Zugriff' };

const Section = ({ label }) => (
  <tr className="bg-stone-50 dark:bg-stone-800/50">
    <td colSpan={5} className="p-2 font-bold text-stone-700 dark:text-stone-300 text-xs tracking-wide uppercase">{label}</td>
  </tr>
);

const Row = ({ label, admin, spiess, vorstand, mitglied, sub }) => (
  <tr className="hover:bg-stone-50 dark:hover:bg-stone-800/30 transition-colors">
    <td className={`p-2.5 text-stone-700 dark:text-stone-300 ${sub ? 'pl-6 text-stone-500 dark:text-stone-400' : 'font-medium'}`}>
      {sub && <span className="text-stone-300 dark:text-stone-600 mr-1.5">&#8227;</span>}
      {label}
    </td>
    {['admin', 'spiess', 'vorstand', 'mitglied'].map((role) => (
      <td key={role} className="text-center p-2.5">
        <div className="flex flex-col items-center gap-0.5">
          {permIcon({ admin, spiess, vorstand, mitglied }[role])}
          <span className="text-[9px] text-stone-400 dark:text-stone-500 leading-none">{permLabel[{ admin, spiess, vorstand, mitglied }[role]]}</span>
        </div>
      </td>
    ))}
  </tr>
);

const ROLES = [
  { role: 'Admin', desc: 'Vollzugriff auf alle Bereiche. System-Account, Nicht als Mitglied geführt.', color: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800' },
  { role: 'Spieß', desc: 'Verwaltet Mitglieder, Strafen und Termine. Sieht erweiterte Statistiken mit vollem Einblick.', color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
  { role: 'Vorstand', desc: 'Verwaltet Mitglieder, Strafen und Termine. Sieht erweiterte Statistiken anonymisiert.', color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800' },
  { role: 'Mitglied', desc: 'Sieht persönliches Dashboard und eigene Strafen. Termine ohne Strafen-Details.', color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' },
];

const Roles = () => {
  return (
    <div data-testid="roles-page" className="min-h-screen bg-stone-50 dark:bg-stone-950">
      <div className="max-w-2xl lg:max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div>
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-7 h-7 text-emerald-700 dark:text-emerald-400" />
            <h1 className="text-3xl md:text-4xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">Benutzerrollen</h1>
          </div>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">Rollen und Berechtigungen im Überblick</p>
        </div>

        {/* Rollenbeschreibungen + Matrix */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 p-6 space-y-5">
            <div>
              <h2 className="font-semibold text-stone-900 dark:text-stone-100">Verfügbare Rollen</h2>
              <p className="text-sm text-stone-500 dark:text-stone-400">Jede Rolle bestimmt den Funktionsumfang in der App</p>
            </div>
            <div className="space-y-3">
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
          <div className="lg:col-span-2 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 p-6">
          <h2 className="font-semibold text-stone-900 dark:text-stone-100">Berechtigungsmatrix</h2>
          <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">Detaillierte Übersicht aller Berechtigungen je Rolle</p>
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

                {/* Dashboard */}
                <Section label="Dashboard" />
                <Row label="Zugriff" admin="full" spiess="full" vorstand="personal" mitglied="personal" />

                {/* Termine */}
                <Section label="Termine" />
                <Row label="Zugriff" admin="full" spiess="full" vorstand="full" mitglied="read" />
                <Row sub label="Termine erstellen / bearbeiten" admin="yes" spiess="yes" vorstand="yes" mitglied="no" />
                <Row sub label="Zu-/Absage" admin="yes" spiess="yes" vorstand="yes" mitglied="yes" />
                <Row sub label="Rückmeldungen einsehen" admin="yes" spiess="yes" vorstand="yes" mitglied="no" />
                <Row sub label="Strafen-Badge sichtbar" admin="yes" spiess="yes" vorstand="yes" mitglied="no" />
                <Row sub label="Strafbetrag sichtbar" admin="yes" spiess="yes" vorstand="yes" mitglied="no" />

                {/* Strafenübersicht */}
                <Section label="Strafenübersicht" />
                <Row label="Zugriff" admin="full" spiess="full" vorstand="own" mitglied="own" />
                <Row sub label="Alle Strafen einsehen" admin="yes" spiess="yes" vorstand="no" mitglied="no" />
                <Row sub label="Eigene Strafen einsehen" admin="yes" spiess="yes" vorstand="yes" mitglied="yes" />
                <Row sub label="Strafen erstellen" admin="yes" spiess="yes" vorstand="own" mitglied="no" />

                {/* Statistiken */}
                <Section label="Statistiken (Erweitert)" />
                <Row label="Zugriff" admin="full" spiess="full" vorstand="anon" mitglied="none" />

                {/* Administration */}
                <Section label="Administration" />
                <Row label="Profil" admin="full" spiess="full" vorstand="full" mitglied="full" />
                <Row label="Benutzerrollen" admin="full" spiess="full" vorstand="full" mitglied="none" />
                <Row label="Benutzerverwaltung" admin="full" spiess="full" vorstand="full" mitglied="none" />
                <Row sub label="App-Zugang verwalten" admin="yes" spiess="yes" vorstand="yes" mitglied="no" />
                <Row label="Stammdaten des Vereins" admin="full" spiess="full" vorstand="full" mitglied="read" />
                <Row sub label="ICS-Kalender" admin="yes" spiess="yes" vorstand="yes" mitglied="no" />
                <Row label="Strafenkatalog" admin="full" spiess="full" vorstand="full" mitglied="none" />
                <Row label="Audit-Log" admin="full" spiess="full" vorstand="full" mitglied="none" />
                <Row label="Einstellungen" admin="full" spiess="full" vorstand="full" mitglied="full" />
                <Row sub label="Sprache & Dark Mode" admin="yes" spiess="yes" vorstand="yes" mitglied="yes" />

              </tbody>
            </table>
          </div>

          {/* Legende */}
          <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4 text-xs text-stone-500 dark:text-stone-400">
            <div className="flex items-center gap-1.5">{permIcon('full')} <span>Vollzugriff</span></div>
            <div className="flex items-center gap-1.5">{permIcon('personal')} <span>Persönlich</span></div>
            <div className="flex items-center gap-1.5">{permIcon('own')} <span>Teilweise</span></div>
            <div className="flex items-center gap-1.5">{permIcon('anon')} <span>Anonymisiert</span></div>
            <div className="flex items-center gap-1.5">{permIcon('none')} <span>Kein Zugriff</span></div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Roles;
