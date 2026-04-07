import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { Camera, Save, User } from 'lucide-react';
import { api } from '../lib/api';

const Profile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarBlobUrl, setAvatarBlobUrl] = useState(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', birthday: '' });
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
      });
      if (res.data.avatar_path) {
        loadAvatar(res.data.avatar_path);
      }
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
    } catch {
      // Kein Avatar vorhanden
    }
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

    // Client-seitige MIME-Type Validierung
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      toast.error('Nur JPG und PNG Dateien sind erlaubt');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Client-seitige Dateigrößen-Validierung
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
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/profile/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });
      toast.success('Profilbild hochgeladen');
      if (res.data.avatar_path) {
        loadAvatar(res.data.avatar_path);
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

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><div className="text-stone-400 dark:text-stone-500">Laden...</div></div>;
  }

  const noMember = !profile?.member_id;

  return (
    <div data-testid="profile-page" className="min-h-screen bg-stone-50 dark:bg-stone-950">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">Profil</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">Persönliche Daten verwalten</p>
        </div>

        {/* Avatar */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 p-6">
          <div className="flex flex-col items-center gap-4">
            <div className="relative group">
              {avatarBlobUrl ? (
                <img
                  data-testid="profile-avatar-img"
                  src={avatarBlobUrl}
                  alt="Profilbild"
                  className="w-28 h-28 rounded-full object-cover border-4 border-stone-200 dark:border-stone-700"
                />
              ) : (
                <div
                  data-testid="profile-avatar-initials"
                  className="w-28 h-28 rounded-full bg-emerald-100 dark:bg-emerald-900/40 border-4 border-stone-200 dark:border-stone-700 flex items-center justify-center"
                >
                  <span className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">{getInitials()}</span>
                </div>
              )}
              {!noMember && (
                <button
                  data-testid="profile-avatar-upload-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg transition-colors disabled:opacity-50"
                >
                  <Camera className="w-4 h-4" />
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>
            {uploading && <p className="text-xs text-stone-400 dark:text-stone-500">Wird hochgeladen...</p>}
            <div className="text-center">
              <p className="font-semibold text-stone-900 dark:text-stone-100">{form.firstName} {form.lastName}</p>
              <p className="text-sm text-stone-500 dark:text-stone-400 capitalize">{profile?.role}</p>
            </div>
          </div>
        </div>

        {/* Formulardaten */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 p-6 space-y-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-stone-600 dark:text-stone-300" />
            </div>
            <div>
              <h2 className="font-semibold text-stone-900 dark:text-stone-100">Persönliche Daten</h2>
              <p className="text-sm text-stone-500 dark:text-stone-400">Dein Name und Geburtsdatum</p>
            </div>
          </div>

          {noMember ? (
            <p className="text-sm text-stone-500 dark:text-stone-400 pl-[52px]">
              Dein Account ist keinem Mitgliedsprofil zugeordnet. Bitte wende dich an einen Administrator.
            </p>
          ) : (
            <div className="space-y-4 pl-[52px]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Vorname</label>
                  <Input
                    data-testid="profile-firstname-input"
                    value={form.firstName}
                    onChange={(e) => setForm(p => ({ ...p, firstName: e.target.value }))}
                    placeholder="Vorname"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Nachname</label>
                  <Input
                    data-testid="profile-lastname-input"
                    value={form.lastName}
                    onChange={(e) => setForm(p => ({ ...p, lastName: e.target.value }))}
                    placeholder="Nachname"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Geburtstag</label>
                <Input
                  data-testid="profile-birthday-input"
                  type="date"
                  value={form.birthday}
                  onChange={(e) => setForm(p => ({ ...p, birthday: e.target.value }))}
                />
              </div>
              <div className="flex justify-end pt-2">
                <Button
                  data-testid="profile-save-button"
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Speichern...' : 'Speichern'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Kontoinformationen */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 p-6 space-y-4">
          <h2 className="font-semibold text-stone-900 dark:text-stone-100">Kontoinformationen</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-stone-500 dark:text-stone-400">Benutzername</p>
              <p className="font-medium text-stone-900 dark:text-stone-100">{profile?.username}</p>
            </div>
            <div>
              <p className="text-stone-500 dark:text-stone-400">Rolle</p>
              <p className="font-medium text-stone-900 dark:text-stone-100 capitalize">{profile?.role}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
