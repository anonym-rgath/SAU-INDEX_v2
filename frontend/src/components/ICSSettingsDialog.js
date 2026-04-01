import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { toast } from 'sonner';
import { Globe } from 'lucide-react';

const ICSSettingsDialog = ({ open, onOpenChange }) => {
  const [icsUrl, setIcsUrl] = useState('');
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadSettings();
    }
  }, [open]);

  const loadSettings = async () => {
    try {
      const res = await api.ics.getSettings();
      setIcsUrl(res.data.ics_url || '');
      setSyncEnabled(res.data.sync_enabled || false);
      setLastSync(res.data.last_sync);
    } catch (err) {
      toast.error('Fehler beim Laden der ICS-Einstellungen');
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.ics.updateSettings({
        ics_url: icsUrl,
        sync_enabled: syncEnabled,
      });
      toast.success('ICS-Einstellungen gespeichert');
      onOpenChange(false);
    } catch (err) {
      toast.error('Fehler beim Speichern');
    } finally {
      setLoading(false);
    }
  };

  const formatLastSync = (dateStr) => {
    if (!dateStr) return 'Noch nie';
    return new Date(dateStr).toLocaleString('de-DE');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-600" />
            ICS-Kalender Synchronisation
          </DialogTitle>
          <DialogDescription>
            Externen Kalender per ICS-URL abonnieren. Termine werden täglich automatisch synchronisiert.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>ICS-URL</Label>
            <Input
              data-testid="ics-url-input"
              value={icsUrl}
              onChange={(e) => setIcsUrl(e.target.value)}
              placeholder="https://outlook.live.com/.../calendar.ics"
              className="h-12 rounded-xl border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
            />
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <Label>Automatische Synchronisation</Label>
              <p className="text-xs text-stone-400">Einmal täglich synchronisieren</p>
            </div>
            <Switch
              data-testid="ics-sync-toggle"
              checked={syncEnabled}
              onCheckedChange={setSyncEnabled}
            />
          </div>

          <div className="bg-stone-50 rounded-xl p-3">
            <p className="text-xs text-stone-500">
              Letzte Synchronisation: <strong>{formatLastSync(lastSync)}</strong>
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-11 px-6 rounded-full bg-white border border-stone-200 text-stone-700 hover:bg-stone-50"
          >
            Abbrechen
          </Button>
          <Button
            data-testid="save-ics-settings-button"
            onClick={handleSave}
            disabled={loading}
            className="h-11 px-8 rounded-full bg-blue-600 text-white font-medium hover:bg-blue-700 transition-transform active:scale-95"
          >
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ICSSettingsDialog;
