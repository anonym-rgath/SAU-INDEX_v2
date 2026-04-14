import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../lib/api';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Users, Search, Mail, MapPin, Calendar, Church } from 'lucide-react';
import { toast } from 'sonner';
import { displayRole } from '../lib/utils';

const MemberDirectory = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('alle');

  const loadMembers = useCallback(async () => {
    try {
      const res = await api.get('/member-directory');
      setMembers(res.data);
    } catch (error) {
      if (error?.code !== 'ERR_CANCELED') toast.error('Fehler beim Laden der Mitglieder');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q ||
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) ||
        (m.email || '').toLowerCase().includes(q) ||
        (m.city || '').toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'alle' || m.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [members, searchQuery, statusFilter]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '–';
    try {
      return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return '–'; }
  };

  const calcAge = (birthday) => {
    if (!birthday) return null;
    const d = new Date(birthday);
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
    return age >= 0 ? age : null;
  };

  const statusCounts = useMemo(() => {
    const aktiv = members.filter(m => m.status === 'aktiv').length;
    const passiv = members.filter(m => m.status === 'passiv').length;
    return { aktiv, passiv, total: members.length };
  }, [members]);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="text-stone-500 dark:text-stone-400">Laden...</div></div>;

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950">
      <div className="max-w-2xl lg:max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Users className="w-7 h-7 text-emerald-700 dark:text-emerald-400" />
              <h1 className="text-3xl md:text-4xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">Mitgliederseite</h1>
            </div>
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
              {statusCounts.total} Mitglieder ({statusCounts.aktiv} aktiv, {statusCounts.passiv} passiv)
            </p>
          </div>
          <div className="flex items-center gap-2">
            {['alle', 'aktiv', 'passiv'].map(s => (
              <button
                key={s}
                data-testid={`filter-${s}`}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${statusFilter === s ? 'bg-emerald-700 text-white' : 'bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-700'}`}
              >
                {s === 'alle' ? 'Alle' : s === 'aktiv' ? 'Aktiv' : 'Passiv'}
              </button>
            ))}
          </div>
        </div>

        {/* Suche */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            data-testid="member-directory-search"
            type="text"
            placeholder="Suche nach Name, E-Mail oder Ort..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
          />
        </div>

        {/* Desktop Tabelle */}
        <Card className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm overflow-hidden">
          {/* Desktop Header */}
          <div className="hidden lg:grid lg:grid-cols-[1fr_120px_160px_160px_140px_100px] items-center px-5 py-3 text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider border-b border-stone-100 dark:border-stone-800">
            <div>Name</div>
            <div>Status / Rolle</div>
            <div>Kontakt</div>
            <div>Adresse</div>
            <div>Geburtstag</div>
            <div>Eintritt</div>
          </div>

          <div data-testid="member-directory-list">
            {filteredMembers.length > 0 ? filteredMembers.map((member) => {
              const age = calcAge(member.birthday);
              return (
                <div
                  key={member.id}
                  data-testid={`directory-member-${member.id}`}
                  className="border-b border-stone-50 dark:border-stone-800 last:border-0 px-5 py-4 hover:bg-stone-50/50 dark:hover:bg-stone-800/30 transition-colors"
                >
                  {/* Desktop Row */}
                  <div className="hidden lg:grid lg:grid-cols-[1fr_120px_160px_160px_140px_100px] items-center gap-2">
                    {/* Name */}
                    <div className="min-w-0">
                      <p className="font-semibold text-stone-900 dark:text-stone-100 truncate">
                        {member.firstName} {member.lastName}
                      </p>
                    </div>
                    {/* Status + Rolle */}
                    <div className="flex flex-col gap-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium w-fit ${member.status === 'aktiv' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' : 'bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300'}`}>
                        {member.status === 'aktiv' ? 'Aktiv' : 'Passiv'}
                      </span>
                      {member.role && (
                        <Badge className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-0 text-[10px] w-fit">
                          {displayRole(member.role)}
                        </Badge>
                      )}
                    </div>
                    {/* Kontakt */}
                    <div className="min-w-0">
                      {member.email ? (
                        <a href={`mailto:${member.email}`} className="text-sm text-emerald-700 dark:text-emerald-400 hover:underline truncate block">{member.email}</a>
                      ) : (
                        <span className="text-xs text-stone-300 dark:text-stone-600">–</span>
                      )}
                    </div>
                    {/* Adresse */}
                    <div className="min-w-0">
                      {(member.city || member.zipCode) ? (
                        <p className="text-sm text-stone-600 dark:text-stone-400 truncate">
                          {[member.zipCode, member.city].filter(Boolean).join(' ')}
                        </p>
                      ) : (
                        <span className="text-xs text-stone-300 dark:text-stone-600">–</span>
                      )}
                    </div>
                    {/* Geburtstag */}
                    <div>
                      {member.birthday ? (
                        <p className="text-sm text-stone-600 dark:text-stone-400">
                          {formatDate(member.birthday)}{age !== null && <span className="text-stone-400 dark:text-stone-500 ml-1">({age})</span>}
                        </p>
                      ) : (
                        <span className="text-xs text-stone-300 dark:text-stone-600">–</span>
                      )}
                    </div>
                    {/* Eintritt */}
                    <div>
                      {member.joinDate ? (
                        <p className="text-sm text-stone-600 dark:text-stone-400">{formatDate(member.joinDate)}</p>
                      ) : (
                        <span className="text-xs text-stone-300 dark:text-stone-600">–</span>
                      )}
                    </div>
                  </div>

                  {/* Mobile Card */}
                  <div className="lg:hidden space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-stone-900 dark:text-stone-100">
                        {member.firstName} {member.lastName}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${member.status === 'aktiv' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' : 'bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300'}`}>
                          {member.status === 'aktiv' ? 'Aktiv' : 'Passiv'}
                        </span>
                        {member.role && (
                          <Badge className="bg-blue-50 text-blue-700 border-0 text-[10px]">{displayRole(member.role)}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
                      {member.email && (
                        <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{member.email}</span>
                      )}
                      {(member.city || member.zipCode) && (
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{[member.zipCode, member.city].filter(Boolean).join(' ')}</span>
                      )}
                      {member.birthday && (
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(member.birthday)}{age !== null && ` (${age})`}</span>
                      )}
                      {member.confession && (
                        <span className="flex items-center gap-1"><Church className="w-3 h-3" />{member.confession}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            }) : (
              <div className="text-center text-stone-400 dark:text-stone-500 py-12">
                {searchQuery ? 'Keine Treffer' : 'Keine Mitglieder'}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default MemberDirectory;
