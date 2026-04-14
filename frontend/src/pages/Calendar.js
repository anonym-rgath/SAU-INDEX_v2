import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { CalendarDays, List, Plus, MapPin, Clock, ChevronLeft, ChevronRight, Users, AlertTriangle, Check, X, Info, Globe, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '../lib/utils';
import EventDialog from '../components/EventDialog';
import EventDetailDialog from '../components/EventDetailDialog';

const CalendarPage = () => {
  const { isAdmin, isMitglied, isVorstand, canManageEvents, canSeeFineInfo, user } = useAuth();
  const canSeeResponses = canManageEvents;

  const [events, setEvents] = useState([]);
  const [view, setView] = useState('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [detailEvent, setDetailEvent] = useState(null);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const res = await api.events.getAll();
      setEvents(res.data);
    } catch (err) {
      toast.error('Fehler beim Laden der Termine');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (eventId) => {
    if (!window.confirm('Termin wirklich löschen?')) return;
    try {
      await api.events.delete(eventId);
      toast.success('Termin gelöscht');
      loadEvents();
    } catch (err) {
      toast.error('Fehler beim Löschen');
    }
  };

  const handleRespond = async (eventId, response) => {
    try {
      await api.events.respond(eventId, { response });
      toast.success(response === 'zugesagt' ? 'Zusage gespeichert' : 'Absage gespeichert');
      loadEvents();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fehler bei der Rückmeldung');
    }
  };

  const handleToggleFine = async (eventId, data) => {
    try {
      const res = await api.events.toggleFine(eventId, data);
      toast.success(res.data.message);
      loadEvents();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fehler beim Umschalten der Straflogik');
    }
  };

  // Calendar grid helpers
  const daysInMonth = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7; // Monday-start
    const days = [];
    
    for (let i = 0; i < startOffset; i++) {
      const d = new Date(year, month, -startOffset + i + 1);
      days.push({ date: d, isCurrentMonth: false });
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
      }
    }
    return days;
  }, [currentMonth]);

  const eventsByDate = useMemo(() => {
    const map = {};
    events.forEach(e => {
      const key = new Date(e.date).toDateString();
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return map;
  }, [events]);

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return events.filter(e => new Date(e.date) >= now);
  }, [events]);

  const pastEvents = useMemo(() => {
    const now = new Date();
    return events.filter(e => new Date(e.date) < now).reverse();
  }, [events]);

  const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  const getResponseBadge = (response) => {
    if (response === 'zugesagt') return <Badge data-testid="badge-zugesagt" className="bg-emerald-100 text-emerald-700 border-0">Zugesagt</Badge>;
    if (response === 'abgesagt') return <Badge data-testid="badge-abgesagt" className="bg-red-100 text-red-700 border-0">Abgesagt</Badge>;
    return <Badge data-testid="badge-offen" className="bg-amber-100 text-amber-700 border-0">Offen</Badge>;
  };

  const EventCard = ({ event, isPast = false }) => {
    const eventDate = new Date(event.date);
    const isToday = new Date().toDateString() === eventDate.toDateString();

    return (
      <Card
        data-testid={`event-card-${event.id}`}
        className={`bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm transition-all hover:shadow-md cursor-pointer ${isPast ? 'opacity-60' : ''} ${isToday ? 'ring-2 ring-emerald-500/30' : ''}`}
        onClick={() => setDetailEvent(event)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-stone-900 dark:text-stone-100 truncate">{event.title}</h3>
                {isToday && <Badge className="bg-emerald-600 text-white border-0 text-xs">Heute</Badge>}
                {event.source === 'ics' && <Badge className="bg-blue-100 text-blue-700 border-0 text-xs"><Globe className="w-3 h-3 mr-0.5" />ICS</Badge>}
                {canSeeFineInfo && event.fine_enabled && <Badge className="bg-amber-100 text-amber-700 border-0 text-xs"><Shield className="w-3 h-3 mr-0.5" />Strafe</Badge>}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-500 dark:text-stone-400">
                <span className="flex items-center gap-1">
                  <CalendarDays className="w-3.5 h-3.5" />
                  {formatDate(event.date)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {formatTime(event.date)}
                </span>
                {event.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {event.location}
                  </span>
                )}
              </div>
              {canSeeFineInfo && event.fine_amount > 0 && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Strafe bei Nichtabsage: {formatCurrency(event.fine_amount)}
                </p>
              )}
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              {/* Eigene Rückmeldung */}
              {user?.member_id && !isPast && (
                <div>{getResponseBadge(event.my_response)}</div>
              )}
              {/* Antwort-Übersicht für Admin/Spieß/Vorstand */}
              {canSeeResponses && event.response_stats && (
                <div className="flex items-center gap-1 text-xs text-stone-400">
                  <Users className="w-3 h-3" />
                  <span className="text-emerald-600">{event.response_stats.zugesagt}</span>
                  <span>/</span>
                  <span className="text-red-600">{event.response_stats.abgesagt}</span>
                  <span>/</span>
                  <span className="text-amber-600">{event.response_stats.keine_antwort}</span>
                </div>
              )}
            </div>
          </div>

          {/* RSVP Buttons */}
          {user?.member_id && event.response_open && !isPast && (
            <div className="flex gap-2 mt-3 pt-3 border-t border-stone-100 dark:border-stone-700">
              <Button
                data-testid={`btn-zusagen-${event.id}`}
                size="sm"
                onClick={(e) => { e.stopPropagation(); handleRespond(event.id, 'zugesagt'); }}
                className={`flex-1 h-9 rounded-full text-sm ${event.my_response === 'zugesagt' ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'}`}
              >
                <Check className="w-4 h-4 mr-1" /> Zusagen
              </Button>
              <Button
                data-testid={`btn-absagen-${event.id}`}
                size="sm"
                onClick={(e) => { e.stopPropagation(); handleRespond(event.id, 'abgesagt'); }}
                className={`flex-1 h-9 rounded-full text-sm ${event.my_response === 'abgesagt' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'}`}
              >
                <X className="w-4 h-4 mr-1" /> Absagen
              </Button>
            </div>
          )}

          {/* Info when response not yet open */}
          {user?.member_id && !event.response_open && !event.response_deadline_passed && !isPast && (
            <p className="text-xs text-stone-400 mt-2 flex items-center gap-1">
              <Info className="w-3 h-3" />
              Rückmeldung ab {formatDate(new Date(new Date(event.date).getTime() - 30 * 24 * 60 * 60 * 1000).toISOString())} möglich
            </p>
          )}

          {event.response_deadline_passed && !isPast && user?.member_id && (
            <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Rückmeldefrist abgelaufen
            </p>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><div className="text-stone-400 dark:text-stone-500">Laden...</div></div>;
  }

  return (
    <div data-testid="calendar-page" className="min-h-screen bg-stone-50 dark:bg-stone-950">
      <div className="max-w-4xl lg:max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">Termine</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">Veranstaltungen und Rückmeldungen</p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={setView}>
            <TabsList className="h-9">
              <TabsTrigger data-testid="view-list" value="list" className="text-xs px-3"><List className="w-4 h-4" /></TabsTrigger>
              <TabsTrigger data-testid="view-calendar" value="calendar" className="text-xs px-3"><CalendarDays className="w-4 h-4" /></TabsTrigger>
            </TabsList>
          </Tabs>
          {canManageEvents && (
            <Button
              data-testid="create-event-button"
              onClick={() => { setEditingEvent(null); setEventDialogOpen(true); }}
              className="h-9 px-4 rounded-full bg-emerald-700 text-white text-sm hover:bg-emerald-800"
            >
              <Plus className="w-4 h-4 mr-1" /> Termin
            </Button>
          )}
        </div>
      </div>

      {/* Calendar View */}
      {view === 'calendar' && (
        <Card className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <h2 className="font-semibold text-stone-900 dark:text-stone-100">
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-px bg-stone-200 dark:bg-stone-700 rounded-lg overflow-hidden">
              {dayNames.map(d => (
                <div key={d} className="bg-stone-50 dark:bg-stone-800 p-2 text-center text-xs font-medium text-stone-500 dark:text-stone-400">{d}</div>
              ))}
              {daysInMonth.map((day, i) => {
                const key = day.date.toDateString();
                const dayEvents = eventsByDate[key] || [];
                const isToday = new Date().toDateString() === key;

                return (
                  <div
                    key={day.date.toISOString()}
                    className={`bg-white dark:bg-stone-900 p-1.5 min-h-[70px] sm:min-h-[90px] ${!day.isCurrentMonth ? 'opacity-30' : ''} ${isToday ? 'ring-2 ring-inset ring-emerald-500' : ''}`}
                  >
                    <div className={`text-xs font-medium mb-1 ${isToday ? 'text-emerald-700 dark:text-emerald-400' : 'text-stone-600 dark:text-stone-400'}`}>
                      {day.date.getDate()}
                    </div>
                    {dayEvents.slice(0, 2).map(e => (
                      <div
                        key={e.id}
                        onClick={() => setDetailEvent(e)}
                        className="text-xs px-1.5 py-0.5 mb-0.5 rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 truncate cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
                      >
                        {e.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-xs text-stone-400 dark:text-stone-500 px-1">+{dayEvents.length - 2}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="space-y-6">
          {/* Upcoming */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Anstehende Termine ({upcomingEvents.length})</h2>
            {upcomingEvents.length === 0 ? (
              <p className="text-stone-400 dark:text-stone-500 text-sm py-8 text-center">Keine anstehenden Termine</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {upcomingEvents.map(e => <EventCard key={e.id} event={e} />)}
              </div>
            )}
          </div>

          {/* Past */}
          {pastEvents.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Vergangene Termine ({pastEvents.length})</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {pastEvents.map(e => <EventCard key={e.id} event={e} isPast />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Event Dialog */}
      <EventDialog
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        event={editingEvent}
        onSuccess={() => { setEventDialogOpen(false); loadEvents(); }}
      />

      {/* Event Detail Dialog */}
      {detailEvent && (
        <EventDetailDialog
          event={detailEvent}
          open={!!detailEvent}
          onOpenChange={(open) => { if (!open) setDetailEvent(null); }}
          onRespond={handleRespond}
          onEdit={canManageEvents ? (e) => { setDetailEvent(null); setEditingEvent(e); setEventDialogOpen(true); } : null}
          onDelete={canManageEvents ? (id) => { setDetailEvent(null); handleDelete(id); } : null}
          onToggleFine={canSeeResponses ? handleToggleFine : null}
          canSeeResponses={canSeeResponses}
          canSeeFineInfo={canSeeFineInfo}
          userMemberId={user?.member_id}
        />
      )}

    </div>
    </div>
  );
};

export default CalendarPage;
