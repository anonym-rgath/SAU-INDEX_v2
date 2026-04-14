import React, { useState, useEffect, useRef } from 'react';
import { Building2, Save, Loader2, Upload, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuth } from '../contexts/AuthContext';
import { useBranding } from '../contexts/BrandingContext';
import { api } from '../lib/api';
import { toast } from 'sonner';

const MONTHS = [
  { value: 1, label: 'Januar' },
  { value: 2, label: 'Februar' },
  { value: 3, label: 'März' },
  { value: 4, label: 'April' },
  { value: 5, label: 'Mai' },
  { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' },
  { value: 12, label: 'Dezember' },
];

const Section = ({ title, description, children }) => (
  <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 p-5 sm:p-6 space-y-4">
    <div>
      <h2 className="font-semibold text-stone-900 dark:text-stone-100">{title}</h2>
      <p className="text-sm text-stone-500 dark:text-stone-400">{description}</p>
    </div>
    <div className="space-y-4">{children}</div>
  </div>
);

const ClubSettings = () => {
  const { isMitglied } = useAuth();
  const { loadBranding, logoUrl, hasLogo } = useBranding();
  const canEdit = !isMitglied;
  const [clubName, setClubName] = useState('');
  const [foundingDate, setFoundingDate] = useState('');
  const [fiscalYearStartMonth, setFiscalYearStartMonth] = useState(8);
  const [loading, setLoading] = useState(true);
  const [savingClubName, setSavingClubName] = useState(false);
  const [savingFoundingDate, setSavingFoundingDate] = useState(false);
  const [savingFiscalYear, setSavingFiscalYear] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const [currentHasLogo, setCurrentHasLogo] = useState(false);
  const logoInputRef = useRef(null);

  useEffect(() => {
    loadSettings().finally(() => setLoading(false));
  }, []);

  const loadSettings = async () => {
    try {
      const res = await api.get('/club-settings');
      setFoundingDate(res.data.founding_date || '');
      setFiscalYearStartMonth(res.data.fiscal_year_start_month || 8);
      setClubName(res.data.club_name || '');
      setCurrentHasLogo(res.data.has_logo || false);
    } catch {
      toast.error('Fehler beim Laden der Vereinsstammdaten');
    }
  };

  const handleSaveClubName = async () => {
    setSavingClubName(true);
    try {
      await api.put('/club-settings', { club_name: clubName || null });
      toast.success('Vereinsname gespeichert');
      loadBranding();
    } catch { toast.error('Fehler beim Speichern'); }
    finally { setSavingClubName(false); }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.clubSettings.uploadLogo(formData);
      toast.success('Logo gespeichert');
      setCurrentHasLogo(true);
      setLogoPreview(`${logoUrl}?t=${Date.now()}`);
      loadBranding();
    } catch { toast.error('Fehler beim Hochladen'); }
    finally { setUploadingLogo(false); if (logoInputRef.current) logoInputRef.current.value = ''; }
  };

  const handleLogoDelete = async () => {
    try {
      await api.clubSettings.deleteLogo();
      toast.success('Logo entfernt');
      setCurrentHasLogo(false);
      setLogoPreview(null);
      loadBranding();
    } catch { toast.error('Fehler beim Löschen'); }
  };

  const handleSaveFoundingDate = async () => {
    if (!foundingDate) {
      toast.error('Gründungsdatum ist ein Pflichtfeld');
      return;
    }
    setSavingFoundingDate(true);
    try {
      await api.put('/club-settings', { founding_date: foundingDate });
      toast.success('Gründungsdatum gespeichert');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fehler beim Speichern');
    } finally {
      setSavingFoundingDate(false);
    }
  };

  const handleSaveFiscalYear = async () => {
    setSavingFiscalYear(true);
    try {
      await api.put('/club-settings', { fiscal_year_start_month: fiscalYearStartMonth });
      toast.success('Geschäftsjahr gespeichert');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fehler beim Speichern');
    } finally {
      setSavingFiscalYear(false);
    }
  };

  const getFiscalYearPreview = () => {
    const month = MONTHS.find(m => m.value === fiscalYearStartMonth);
    const now = new Date();
    let startYear = now.getFullYear();
    if (now.getMonth() + 1 < fiscalYearStartMonth) startYear--;
    return `${month?.label} ${startYear} – ${MONTHS[(fiscalYearStartMonth - 2 + 12) % 12]?.label} ${startYear + 1}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <div data-testid="club-settings-page" className="min-h-screen bg-stone-50 dark:bg-stone-950">
      <div className="max-w-2xl lg:max-w-4xl mx-auto px-4 py-6 flex flex-col gap-6">
        <div>
          <div className="flex items-center gap-3">
            <Building2 className="w-7 h-7 text-emerald-700 dark:text-emerald-400" />
            <h1 className="text-3xl md:text-4xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">Stammdaten des Vereins</h1>
          </div>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">Zentrale Angaben des Vereins</p>
        </div>

        {/* Vereinsname & Logo */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vereinsname */}
        <Section title="Vereinsname" description="Name des Vereins (erscheint in Header, Login etc.)">
          <input
            data-testid="club-name-input"
            type="text"
            value={clubName}
            onChange={e => setClubName(e.target.value)}
            disabled={!canEdit}
            placeholder="SAU-INDEX"
            className="w-full h-12 px-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-left focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          />
          {canEdit && (
            <Button data-testid="save-club-name" onClick={handleSaveClubName} disabled={savingClubName} className="h-10 px-5 rounded-xl bg-emerald-700 text-white hover:bg-emerald-800">
              {savingClubName ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Speichern
            </Button>
          )}
        </Section>

        {/* Vereinslogo */}
        <Section title="Vereinslogo" description="Logo des Vereins (PNG, JPG, max. 512px)">
          {(currentHasLogo || logoPreview) && (
            <div className="flex items-center gap-4">
              <img
                src={logoPreview || `${logoUrl}?t=${Date.now()}`}
                alt="Vereinslogo"
                className="w-20 h-20 object-contain rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 p-2"
                data-testid="club-logo-preview"
              />
              {canEdit && (
                <Button data-testid="delete-club-logo" onClick={handleLogoDelete} variant="outline" className="h-10 px-4 rounded-xl text-red-600 border-red-200 hover:bg-red-50">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Entfernen
                </Button>
              )}
            </div>
          )}
          {canEdit && (
            <div>
              <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoUpload} className="hidden" data-testid="club-logo-input" />
              <Button data-testid="upload-club-logo" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo} variant="outline" className="h-10 px-5 rounded-xl">
                {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                {currentHasLogo ? 'Logo ändern' : 'Logo hochladen'}
              </Button>
            </div>
          )}
        </Section>
        </div>{/* End grid */}

        {/* Gründungsdatum & Geschäftsjahr */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gründungsdatum */}
        <Section title="Gründungsdatum" description="Offizielles Gründungsdatum des Vereins">
          <input
            data-testid="founding-date-input"
            type="date"
            value={foundingDate}
            onChange={e => setFoundingDate(e.target.value)}
            disabled={!canEdit}
            className="w-full h-12 px-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-left focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          />
          {canEdit && (
            <Button data-testid="save-founding-date-button" onClick={handleSaveFoundingDate} disabled={savingFoundingDate} className="h-10 px-6 rounded-full bg-emerald-700 text-white font-medium hover:bg-emerald-800 transition-transform active:scale-95">
              <Save className="w-4 h-4 mr-1.5" />{savingFoundingDate ? 'Speichert...' : 'Speichern'}
            </Button>
          )}
        </Section>

        {/* Geschäftsjahr */}
        <Section title="Geschäftsjahr" description="Startmonat des Vereins-Geschäftsjahres">
          <select
            data-testid="fiscal-year-month-select"
            value={fiscalYearStartMonth}
            onChange={e => setFiscalYearStartMonth(Number(e.target.value))}
            disabled={!canEdit}
            className="w-full h-12 px-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-colors appearance-none disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {MONTHS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <p className="text-xs text-stone-400 dark:text-stone-500">
            Aktuelles Geschäftsjahr: {getFiscalYearPreview()}
          </p>
          {canEdit && (
            <Button data-testid="save-fiscal-year-button" onClick={handleSaveFiscalYear} disabled={savingFiscalYear} className="h-10 px-6 rounded-full bg-emerald-700 text-white font-medium hover:bg-emerald-800 transition-transform active:scale-95">
              <Save className="w-4 h-4 mr-1.5" />{savingFiscalYear ? 'Speichert...' : 'Speichern'}
            </Button>
          )}
        </Section>
        </div>{/* End grid */}
      </div>
    </div>
  );
};

export default ClubSettings;
