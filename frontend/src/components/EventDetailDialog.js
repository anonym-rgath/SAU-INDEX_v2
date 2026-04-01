import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { CalendarDays, Clock, MapPin, AlertTriangle, Check, X, Pencil, Trash2, Users, Globe, Shield } from 'lucide-react';
import { formatCurrency } from '../lib/utils';

const EventDetailDialog = ({ event, open, onOpenChange, onRespond, onEdit, onDelete, onToggleFine, canSeeResponses, userMemberId }) => {
  const [fineTypes, setFineTypes] = useState([]);
  const [selectedFineType, setSelectedFineType] = useState('');
  const [showFineSelect, setShowFineSelect] = useState(false);

  useEffect(() => {
    if (open && onToggleFine && !event?.fine_enabled) {
      loadFineTypes();
    }
    setShowFineSelect(false);
    setSelectedFineType('');
  }, [open, event, onToggleFine]);

  const loadFineTypes = async () => {
    try {
      const res = await api.fineTypes.getAll();
      // Nur Strafenarten ohne event_id (keine auto-erstellten)
      setFineTypes(res.data.filter(ft => !ft.event_id));
    } catch (err) {
      // ignore
    }
  };

  if (!event) return null;

  const eventDate = new Date(event.date);
  const isPast = eventDate < new Date();

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr';
  };

  const handleToggleFine = () => {
    if (event.fine_enabled) {
      // Deaktivieren - kein fine_type_id nötig
      onToggleFine(event.id, null);
    } else {
      // Aktivieren - Strafenart-Auswahl zeigen
      setShowFineSelect(true);
    }
  };

  const handleConfirmFine = () => {
    if (!selectedFineType) return;
    onToggleFine(event.id, { fine_type_id: selectedFineType });
    setShowFineSelect(false);
    setSelectedFineType('');
  };

  const stats = event.response_stats;
  const selectedFt = fineTypes.find(ft => ft.id === selectedFineType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            {event.title}
            {event.source === 'ics' && <Badge className="bg-blue-100 text-blue-700 border-0 text-xs"><Globe className="w-3 h-3 mr-0.5" />ICS</Badge>}
          </DialogTitle>
          <p className="text-sm text-stone-500 sr-only">Termindetails und Rückmeldung</p>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-5 pb-4">
            {/* Details */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-stone-600">
                <CalendarDays className="w-4 h-4 text-stone-400" />
                <span className="text-sm">{formatDate(event.date)}</span>
              </div>
              <div className="flex items-center gap-2 text-stone-600">
                <Clock className="w-4 h-4 text-stone-400" />
                <span className="text-sm">{formatTime(event.date)}</span>
              </div>
              {event.location && (
                <div className="flex items-center gap-2 text-stone-600">
                  <MapPin className="w-4 h-4 text-stone-400" />
                  <span className="text-sm">{event.location}</span>
                </div>
              )}
            </div>

            {event.description && (
              <p className="text-sm text-stone-600 bg-stone-50 rounded-xl p-3">{event.description}</p>
            )}

            {/* Fine status */}
            {event.fine_enabled && event.fine_amount > 0 && (
              <div className="flex items-center gap-2 text-amber-600 bg-amber-50 rounded-xl p-3">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="text-sm">Strafe bei fehlender/verspäteter Rückmeldung: <strong>{formatCurrency(event.fine_amount)}</strong></span>
              </div>
            )}

            {/* Own response status */}
            {userMemberId && (
              <div className="bg-stone-50 rounded-xl p-3">
                <p className="text-xs text-stone-500 mb-1">Meine Rückmeldung</p>
                {event.my_response === 'zugesagt' && <Badge className="bg-emerald-100 text-emerald-700 border-0">Zugesagt</Badge>}
                {event.my_response === 'abgesagt' && <Badge className="bg-red-100 text-red-700 border-0">Abgesagt</Badge>}
                {!event.my_response && <Badge className="bg-amber-100 text-amber-700 border-0">Noch keine Rückmeldung</Badge>}
              </div>
            )}

            {/* RSVP Buttons */}
            {userMemberId && event.response_open && !isPast && (
              <div className="flex gap-2">
                <Button
                  data-testid="detail-btn-zusagen"
                  onClick={() => onRespond(event.id, 'zugesagt')}
                  className={`flex-1 h-11 rounded-full ${event.my_response === 'zugesagt' ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'}`}
                >
                  <Check className="w-4 h-4 mr-2" /> Zusagen
                </Button>
                <Button
                  data-testid="detail-btn-absagen"
                  onClick={() => onRespond(event.id, 'abgesagt')}
                  className={`flex-1 h-11 rounded-full ${event.my_response === 'abgesagt' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'}`}
                >
                  <X className="w-4 h-4 mr-2" /> Absagen
                </Button>
              </div>
            )}

            {/* Response Overview for Admin/Spiess/Vorstand */}
            {canSeeResponses && event.responses && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-stone-400" />
                  <h3 className="font-semibold text-stone-900 text-sm">Rückmeldungen</h3>
                </div>

                {stats && (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-emerald-50 rounded-lg p-2">
                      <div className="text-lg font-bold text-emerald-700">{stats.zugesagt}</div>
                      <div className="text-xs text-emerald-600">Zugesagt</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-2">
                      <div className="text-lg font-bold text-red-700">{stats.abgesagt}</div>
                      <div className="text-xs text-red-600">Abgesagt</div>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-2">
                      <div className="text-lg font-bold text-amber-700">{stats.keine_antwort}</div>
                      <div className="text-xs text-amber-600">Offen</div>
                    </div>
                  </div>
                )}

                {/* Response List */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {event.responses.map((r, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-stone-50">
                      <span className="text-sm text-stone-700">{r.member_name}</span>
                      {r.response === 'zugesagt'
                        ? <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Zugesagt</Badge>
                        : <Badge className="bg-red-100 text-red-700 border-0 text-xs">Abgesagt</Badge>
                      }
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fine Type Select (when activating) */}
            {showFineSelect && (
              <div className="space-y-3 bg-amber-50 rounded-xl p-4">
                <p className="text-sm font-medium text-amber-800">Strafenart zuweisen</p>
                <Select value={selectedFineType} onValueChange={setSelectedFineType}>
                  <SelectTrigger data-testid="fine-type-select" className="bg-white">
                    <SelectValue placeholder="Strafenart wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {fineTypes.map(ft => (
                      <SelectItem key={ft.id} value={ft.id}>
                        {ft.label} ({formatCurrency(ft.amount)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedFt && (
                  <p className="text-xs text-amber-600">Strafe: {formatCurrency(selectedFt.amount)} pro Verstoß</p>
                )}
                <div className="flex gap-2">
                  <Button
                    data-testid="confirm-fine-button"
                    onClick={handleConfirmFine}
                    disabled={!selectedFineType}
                    className="flex-1 h-9 rounded-full bg-amber-600 text-white text-sm hover:bg-amber-700"
                  >
                    <Check className="w-4 h-4 mr-1" /> Zuweisen
                  </Button>
                  <Button
                    onClick={() => setShowFineSelect(false)}
                    variant="outline"
                    className="h-9 rounded-full text-sm"
                  >
                    Abbrechen
                  </Button>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Admin Actions */}
        {(onEdit || onDelete || onToggleFine) && (
          <div className="flex gap-2 pt-3 border-t border-stone-100">
            {onToggleFine && !showFineSelect && (
              <Button
                data-testid="toggle-fine-button"
                onClick={handleToggleFine}
                variant="outline"
                className={`flex-1 h-10 rounded-full text-sm ${event.fine_enabled ? 'text-amber-700 border-amber-200 bg-amber-50' : 'text-stone-500'}`}
              >
                <Shield className="w-4 h-4 mr-1" /> {event.fine_enabled ? 'Strafe deaktivieren' : 'Strafe zuweisen'}
              </Button>
            )}
            {onEdit && (
              <Button
                data-testid="edit-event-button"
                onClick={() => onEdit(event)}
                variant="outline"
                className="flex-1 h-10 rounded-full text-sm"
              >
                <Pencil className="w-4 h-4 mr-1" /> Bearbeiten
              </Button>
            )}
            {onDelete && (
              <Button
                data-testid="delete-event-button"
                onClick={() => onDelete(event.id)}
                variant="outline"
                className="h-10 rounded-full text-sm text-red-600 border-red-200 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EventDetailDialog;
