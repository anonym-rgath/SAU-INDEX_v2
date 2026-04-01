import React from 'react';
import { ShieldCheck } from 'lucide-react';

const roles = [
  { role: 'Admin', desc: 'Vollzugriff auf alle Bereiche. System-Account, nicht als Mitglied geführt.', color: 'bg-red-50 text-red-700 border-red-200' },
  { role: 'Spieß', desc: 'Kann Mitglieder, Strafen und Termine verwalten. Sieht eigene Strafen, wenn mit Mitglied verknüpft.', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { role: 'Vorstand', desc: 'Kann Mitglieder und Termine verwalten. Sieht eigene Strafen, wenn mit Mitglied verknüpft.', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { role: 'Mitglied', desc: 'Nur-Lese-Zugriff. Sieht eigenes persönliches Dashboard mit Strafen und Terminen.', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
];

const Roles = () => (
  <div data-testid="roles-page" className="max-w-2xl mx-auto px-4 py-6 space-y-6">
    <div>
      <h1 className="text-3xl md:text-4xl font-bold text-stone-900 tracking-tight">Benutzerrollen</h1>
      <p className="text-sm text-stone-500 mt-1">Übersicht der verfügbaren Rollen und Berechtigungen</p>
    </div>

    <div className="space-y-3">
      {roles.map(r => (
        <div key={r.role} className={`rounded-2xl border p-5 ${r.color}`}>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-4 h-4" />
            <p className="font-semibold">{r.role}</p>
          </div>
          <p className="text-sm opacity-80">{r.desc}</p>
        </div>
      ))}
    </div>

    <p className="text-sm text-stone-400">Rollen werden über die Benutzerverwaltung zugewiesen.</p>
  </div>
);

export default Roles;
