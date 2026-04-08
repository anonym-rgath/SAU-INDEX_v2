import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { Camera, Save, User, UserCircle } from 'lucide-react';
import { api } from '../lib/api';
import { displayRole } from '../lib/utils';

const CONFESSIONS = ['Römisch-Katholisch', 'Evangelisch', 'Ohne Konfession', 'Sonstige'];

const Profile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarBlobUrl, setAvatarBlobUrl] = useState(null);
  const [form, setForm] = useState({
    firstName: '', lastName: '', birthday: '', joinDate: '', joinDateCorps: '',
    street: '', zipCode: '', city: '', confession: '', email: '',
  });
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadProfile();
    return () => { if (avatarBlobUrl) URL.revokeObjectURL(avatarBlobUrl); };
  }, []);

  const loadProfile = async () => {
    try {
      const res = await api.get('/profile');
      setProfile(res.data);
      setForm({
        firstName: res.data.firstName || '',
        lastName: res.data.lastName || '',
        birthday: res.data.birthday || '',
        joinDate: res.data.joinDate || '',
        joinDateCorps: res.data.joinDateCorps || '',
        street: res.data.street || '',
        zipCode: res.data.zipCode || '',
        city: res.data.city || '',
        confession: res.data.confession || '',
        email: res.data.email || '',
      });
      if (res.data.avatar_path) loadAvatar(res.data.avatar_path);
    } catch {
      toast.error('Profil konnte nicht geladen werden');
    } finally {
      setLoading(false);
    }
  };

  const loadAvatar = async (path) => {
    try {
      const res = await api.get(`/profile/avatar/${path}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      setAvatarBlobUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
    } catch {}
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/profile', form);
      toast.success('Profil gespeichert');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      toast.error('Nur JPG und PNG Dateien sind erlaubt');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Maximale Dateigröße: 5 MB');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (file.size === 0) {
      toast.error('Leere Datei');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/profile/avatar', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });
      toast.success('Profilbild hochgeladen');
      if (res.data.avatar_path) {
        loadAvatar(res.data.avatar_path);
        window.dispatchEvent(new Event('avatar-updated'));
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        toast.error('Upload-Zeitüberschreitung. Bitte erneut versuchen.');
      } else if (detail) {
        toast.error(detail);
      } else {
        toast.error('Upload fehlgeschlagen. Bitte erneut versuchen.');
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const getInitials = () => {
    const f = form.firstName?.[0] || '';
    const l = form.lastName?.[0] || '';
    return (f + l).toUpperCase() || '?';
  };

  const calcYears = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const now = new Date();
    let years = now.getFullYear() - d.getFullYear();
    if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) years--;
    return years >= 0 ? years : 0;
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><div className="text-stone-400 dark:text-stone-500">Laden...</div></div>;
  }

  const noMember = !profile?.member_id;
  const memberYears = calcYears(form.joinDate);
  const corpsYears = calcYears(form.joinDateCorps);
  const statusLabel = { aktiv: 'Aktiv', passiv: 'Passiv', archiviert: 'Archiviert' };
  const statusColor = { aktiv: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400', passiv: 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400', archiviert: 'bg-stone-100 text-stone-400 dark:bg-stone-800 dark:text-stone-500' };

  return (
    <div data-testid="profile-page" className="min-h-screen bg-stone-50 dark:bg-stone-950">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div>
          <div className="flex items-center gap-3">
            <UserCircle className="w-7 h-7 text-emerald-700 dark:text-emerald-400" />
            <h1 className="text-3xl md:text-4xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">Profil</h1>
          </div>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">Persönliche Daten verwalten</p>
        </div>

        {/* Persönliche Daten */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 p-6 space-y-5">
          <div>
            <h2 className="font-semibold text-stone-900 dark:text-stone-100">Persönliche Daten</h2>
            <p className="text-sm text-stone-500 dark:text-stone-400">Profilbild, Name und Kontaktdaten</p>
          </div>

          {noMember ? (
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Dein Account ist keinem Mitgliedsprofil zugeordnet. Bitte wende dich an einen Administrator.
            </p>
          ) : (
            <div className="space-y-5">
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div className="relative group shrink-0">
                  {avatarBlobUrl ? (
                    <img data-testid="profile-avatar-img" src={avatarBlobUrl} alt="Profilbild" className="w-20 h-20 rounded-full object-cover border-2 border-stone-200 dark:border-stone-700" />
                  ) : (
                    <div data-testid="profile-avatar-initials" className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/40 border-2 border-stone-200 dark:border-stone-700 flex items-center justify-center">
                      <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{getInitials()}</span>
                    </div>
                  )}
                  <button
                    data-testid="profile-avatar-upload-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg transition-colors disabled:opacity-50"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleAvatarUpload} />
                </div>
                <div>
                  <p className="text-sm text-stone-500 dark:text-stone-400">JPG oder PNG, max. 5 MB</p>
                  {uploading && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">Wird hochgeladen...</p>}
                </div>
              </div>

              {/* Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Vorname</label>
                  <Input data-testid="profile-firstname-input" value={form.firstName} onChange={(e) => setForm(p => ({ ...p, firstName: e.target.value }))} placeholder="Vorname" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Nachname</label>
                  <Input data-testid="profile-lastname-input" value={form.lastName} onChange={(e) => setForm(p => ({ ...p, lastName: e.target.value }))} placeholder="Nachname" />
                </div>
              </div>

              {/* Geburtstag */}
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Geburtstag</label>
                <Input data-testid="profile-birthday-input" type="date" value={form.birthday} onChange={(e) => setForm(p => ({ ...p, birthday: e.target.value }))} />
              </div>

              {/* Eintrittsdatum (Verein) + Eintrittsdatum (Corps) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Eintrittsdatum (Verein)</label>
                  <Input data-testid="profile-joindate-input" type="date" value={form.joinDate} onChange={(e) => setForm(p => ({ ...p, joinDate: e.target.value }))} />
                  {memberYears !== null && (
                    <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">
                      Mitglied seit {memberYears} {memberYears === 1 ? 'Jahr' : 'Jahren'}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Eintrittsdatum (Corps)</label>
                  <Input data-testid="profile-joindate-corps-input" type="date" value={form.joinDateCorps} onChange={(e) => setForm(p => ({ ...p, joinDateCorps: e.target.value }))} />
                  {corpsYears !== null && (
                    <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">
                      Im Corps seit {corpsYears} {corpsYears === 1 ? 'Jahr' : 'Jahren'}
                    </p>
                  )}
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">E-Mail</label>
                <Input data-testid="profile-email-input" type="email" value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} placeholder="max@example.de" />
              </div>

              {/* Adresse */}
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Straße</label>
                <Input data-testid="profile-street-input" value={form.street} onChange={(e) => setForm(p => ({ ...p, street: e.target.value }))} placeholder="Musterstraße 1" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Postleitzahl</label>
                  <Input data-testid="profile-zipcode-input" value={form.zipCode} onChange={(e) => setForm(p => ({ ...p, zipCode: e.target.value }))} placeholder="12345" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Ort</label>
                  <Input data-testid="profile-city-input" value={form.city} onChange={(e) => setForm(p => ({ ...p, city: e.target.value }))} placeholder="Musterstadt" />
                </div>
              </div>

              {/* Konfession */}
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Konfession</label>
                <select
                  data-testid="profile-confession-select"
                  value={form.confession}
                  onChange={(e) => setForm(p => ({ ...p, confession: e.target.value }))}
                  className="w-full h-10 px-3 rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                >
                  <option value="">Keine Angabe</option>
                  {CONFESSIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Speichern */}
              <div className="flex justify-end pt-2">
                <Button data-testid="profile-save-button" onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Save className="w-4 h-4 mr-2" />{saving ? 'Speichern...' : 'Speichern'}
                </Button>
              </div>

              {/* Kontoinformationen */}
              <div className="border-t border-stone-200 dark:border-stone-700 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-stone-500 dark:text-stone-400">Benutzername</p>
                    <p className="font-medium text-stone-900 dark:text-stone-100">{profile?.username}</p>
                  </div>
                  <div>
                    <p className="text-stone-500 dark:text-stone-400">Rolle</p>
                    <p className="font-medium text-stone-900 dark:text-stone-100">{displayRole(profile?.role)}</p>
                  </div>
                  {profile?.status && (
                    <div>
                      <p className="text-stone-500 dark:text-stone-400">Status</p>
                      <span data-testid="profile-status-badge" className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${statusColor[profile.status] || ''}`}>
                        {statusLabel[profile.status] || profile.status}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
