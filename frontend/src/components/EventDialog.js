import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { toast } from 'sonner';

const EventDialog = ({ open, onOpenChange, event, onSuccess }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    location: '',
    fine_amount: '',
  });

  useEffect(() => {
    if (open) {
      if (event) {
        const d = new Date(event.date);
        setFormData({
          title: event.title || '',
          description: event.description || '',
          date: d.toISOString().split('T')[0],
          time: d.toTimeString().slice(0, 5),
          location: event.location || '',
          fine_amount: event.fine_amount > 0 ? String(event.fine_amount) : '',
        });
      } else {
        setFormData({ title: '', description: '', date: '', time: '', location: '', fine_amount: '' });
      }
    }
  }, [open, event]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.date || !formData.time) {
      toast.error('Titel, Datum und Uhrzeit sind Pflichtfelder');
      return;
    }

    const dateStr = `${formData.date}T${formData.time}:00`;
    const payload = {
      title: formData.title,
      description: formData.description || null,
      date: dateStr,
      location: formData.location || null,
      fine_amount: formData.fine_amount ? parseFloat(formData.fine_amount) : null,
    };

    try {
      if (event) {
        await api.events.update(event.id, payload);
        toast.success('Termin aktualisiert');
      } else {
        await api.events.create(payload);
        toast.success('Termin erstellt');
      }
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fehler beim Speichern');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{event ? 'Termin bearbeiten' : 'Neuer Termin'}</DialogTitle>
          <DialogDescription>
            {event ? 'Termin-Details anpassen' : 'Neuen Termin für alle Mitglieder erstellen'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Titel *</Label>
              <Input
                data-testid="event-title-input"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="z.B. Schützenfest, Übungsabend"
                className="h-12 rounded-xl border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-base"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Datum *</Label>
                <Input
                  data-testid="event-date-input"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="h-12 rounded-xl border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-base"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Uhrzeit *</Label>
                <Input
                  data-testid="event-time-input"
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  className="h-12 rounded-xl border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-base"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Ort</Label>
              <Input
                data-testid="event-location-input"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="z.B. Schützenhalle"
                className="h-12 rounded-xl border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-base"
              />
            </div>

            <div className="space-y-2">
              <Label>Beschreibung</Label>
              <Textarea
                data-testid="event-description-input"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Weitere Details zum Termin"
                className="rounded-xl border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-base"
              />
            </div>

            <div className="space-y-2">
              <Label>Strafe bei Nichtabsage (optional)</Label>
              <Input
                data-testid="event-fine-input"
                type="number"
                step="0.01"
                min="0"
                value={formData.fine_amount}
                onChange={(e) => setFormData({ ...formData, fine_amount: e.target.value })}
                placeholder="0.00"
                className="h-12 rounded-xl border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-base"
              />
              <p className="text-xs text-stone-400">Wird automatisch bei fehlender/verspäteter Rückmeldung zugewiesen</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-11 px-6 rounded-full bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 transition-colors"
            >
              Abbrechen
            </Button>
            <Button
              data-testid="submit-event-button"
              type="submit"
              className="h-11 px-8 rounded-full bg-emerald-700 text-white font-medium hover:bg-emerald-800 transition-transform active:scale-95 shadow-lg shadow-emerald-700/20"
            >
              {event ? 'Speichern' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EventDialog;
