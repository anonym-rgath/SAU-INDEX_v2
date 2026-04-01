import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Users, Plus, Pencil, Trash2, QrCode, Archive } from 'lucide-react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { useAuth } from '../contexts/AuthContext';
import QRCodeDialog from '../components/QRCodeDialog';

const Members = () => {
  const { canManageMembers } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrMember, setQrMember] = useState(null);
  const [editingMember, setEditingMember] = useState(null);
  const [deletingMember, setDeletingMember] = useState(null);
  const [formData, setFormData] = useState({ firstName: '', lastName: '', status: 'aktiv' });
  const [sortBy, setSortBy] = useState('name-asc');

  // Hilfsfunktion: Vollständiger Name
  const getFullName = (member) => {
    if (member.firstName && member.lastName) {
      return `${member.firstName} ${member.lastName}`;
    }
    return member.name || 'Unbekannt';
  };

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      const response = await api.members.getAll();
      setMembers(response.data);
    } catch (error) {
      console.error('Fehler beim Laden der Mitglieder:', error);
      if (error?.code !== 'ERR_CANCELED') {
        toast.error('Fehler beim Laden der Mitglieder');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingMember) {
        await api.members.update(editingMember.id, formData);
        toast.success('Mitglied aktualisiert');
      } else {
        await api.members.create(formData);
        toast.success('Mitglied erstellt');
      }
      setDialogOpen(false);
      setEditingMember(null);
      setFormData({ firstName: '', lastName: '', status: 'aktiv' });
      loadMembers();
    } catch (error) {
      toast.error('Fehler beim Speichern');
    }
  };

  const handleDelete = async () => {
    try {
      await api.members.delete(deletingMember.id);
      toast.success('Mitglied gelöscht');
      setDeleteDialogOpen(false);
      setDeletingMember(null);
      loadMembers();
    } catch (error) {
      toast.error('Fehler beim Löschen');
    }
  };

  const openAddDialog = () => {
    setEditingMember(null);
    setFormData({ firstName: '', lastName: '', status: 'aktiv' });
    setDialogOpen(true);
  };

  const openEditDialog = (member) => {
    setEditingMember(member);
    setFormData({ 
      firstName: member.firstName || '', 
      lastName: member.lastName || '', 
      status: member.status || 'aktiv' 
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = (member) => {
    setDeletingMember(member);
    setDeleteDialogOpen(true);
  };

  const openQRDialog = (member) => {
    setQrMember(member);
    setQrDialogOpen(true);
  };

  // Aktive Mitglieder (nicht archiviert)
  const activeMembers = members.filter(m => m.status !== 'archiviert');
  // Archivierte Mitglieder
  const archivedMembers = members.filter(m => m.status === 'archiviert');

  const getSortedMembers = (memberList) => {
    const sorted = [...memberList];
    
    switch (sortBy) {
      case 'name-asc':
        return sorted.sort((a, b) => getFullName(a).localeCompare(getFullName(b)));
      case 'name-desc':
        return sorted.sort((a, b) => getFullName(b).localeCompare(getFullName(a)));
      case 'status-aktiv':
        return sorted.sort((a, b) => {
          if (a.status === 'aktiv' && b.status !== 'aktiv') return -1;
          if (a.status !== 'aktiv' && b.status === 'aktiv') return 1;
          return getFullName(a).localeCompare(getFullName(b));
        });
      case 'status-passiv':
        return sorted.sort((a, b) => {
          if (a.status === 'passiv' && b.status !== 'passiv') return -1;
          if (a.status !== 'passiv' && b.status === 'passiv') return 1;
          return getFullName(a).localeCompare(getFullName(b));
        });
      case 'date-newest':
        return sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      case 'date-oldest':
        return sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      default:
        return sorted;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-stone-500">Laden...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-stone-900 tracking-tight">
              Mitgliederverwaltung
            </h1>
            <p className="text-sm text-stone-500 mt-1">
              Stammdaten aller Vereinsmitglieder pflegen
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canManageMembers && (
              <Button
                data-testid="add-member-button"
                onClick={openAddDialog}
                className="h-11 px-6 rounded-full bg-emerald-700 text-white font-medium hover:bg-emerald-800 transition-transform active:scale-95 shadow-lg shadow-emerald-700/20"
              >
                <Plus className="w-5 h-5 mr-2" />
                <span className="hidden sm:inline">Mitglied</span>
                <span className="sm:hidden">Neu</span>
              </Button>
            )}
          </div>
        </div>

        <div className="mb-4">
          <Select
            value={sortBy}
            onValueChange={setSortBy}
          >
            <SelectTrigger data-testid="sort-members-select" className="h-11 rounded-xl max-w-xs">
              <SelectValue placeholder="Sortieren nach..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name-asc">Name (A-Z)</SelectItem>
              <SelectItem value="name-desc">Name (Z-A)</SelectItem>
              <SelectItem value="status-aktiv">Status: Aktiv zuerst</SelectItem>
              <SelectItem value="status-passiv">Status: Passiv zuerst</SelectItem>
              <SelectItem value="date-newest">Neueste zuerst</SelectItem>
              <SelectItem value="date-oldest">Älteste zuerst</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4">
          <div className="flex items-center gap-3 mb-4">
            <Users className="w-5 h-5 text-emerald-700" />
            <h2 className="text-xl font-bold text-stone-900 tracking-tight">
              Alle Mitglieder
            </h2>
            <span className="text-sm text-stone-500">({activeMembers.length})</span>
          </div>

          <div className="space-y-2" data-testid="members-list">
            {activeMembers.length > 0 ? (
              getSortedMembers(activeMembers).map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 rounded-xl border border-stone-100 bg-stone-50 active:bg-stone-100 transition-colors min-h-[72px]"
                  data-testid={`member-item-${member.id}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-stone-900 truncate">{getFullName(member)}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        member.status === 'aktiv' 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : 'bg-stone-200 text-stone-600'
                      }`}>
                        {member.status === 'aktiv' ? 'Aktiv' : 'Passiv'}
                      </span>
                    </div>
                  </div>
                  {canManageMembers && (
                    <div className="flex gap-2 flex-shrink-0 ml-2">
                      <Button
                        data-testid={`qr-member-${member.id}`}
                        onClick={() => openQRDialog(member)}
                        className="h-10 w-10 p-0 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors"
                        title="QR-Code anzeigen"
                      >
                        <QrCode className="w-4 h-4" />
                      </Button>
                      <Button
                        data-testid={`edit-member-${member.id}`}
                        onClick={() => openEditDialog(member)}
                        className="h-10 w-10 p-0 rounded-full bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-center text-stone-400 py-8">
                Noch keine Mitglieder
              </p>
            )}
          </div>
        </Card>

        {/* Archiv */}
        {archivedMembers.length > 0 && (
          <Card className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 mt-6">
            <div className="flex items-center gap-3 mb-4">
              <Archive className="w-5 h-5 text-stone-500" />
              <h2 className="text-xl font-bold text-stone-900 tracking-tight">
                Archiv
              </h2>
              <span className="text-sm text-stone-500">({archivedMembers.length})</span>
            </div>
            <p className="text-sm text-stone-500 mb-4">
              Ausgetretene Mitglieder (erscheinen nicht in Rankings)
            </p>

            <div className="space-y-2" data-testid="archived-members-list">
              {archivedMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 rounded-xl border border-stone-100 bg-stone-100/50 transition-colors min-h-[72px] opacity-75"
                  data-testid={`archived-member-item-${member.id}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-stone-600 truncate">{getFullName(member)}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-stone-300 text-stone-600">
                        Archiviert
                      </span>
                    </div>
                  </div>
                  {canManageMembers && (
                    <div className="flex gap-2 flex-shrink-0 ml-2">
                      <Button
                        data-testid={`edit-archived-member-${member.id}`}
                        onClick={() => openEditDialog(member)}
                        className="h-10 w-10 p-0 rounded-full bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 transition-colors"
                        title="Bearbeiten"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        data-testid={`delete-archived-member-${member.id}`}
                        onClick={() => openDeleteDialog(member)}
                        className="h-10 w-10 p-0 rounded-full bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-colors"
                        title="Endgültig löschen"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingMember ? 'Mitglied bearbeiten' : 'Neues Mitglied'}
            </DialogTitle>
            <DialogDescription>
              {editingMember ? 'Daten des Mitglieds ändern' : 'Neues Mitglied hinzufügen'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Vorname</Label>
                <Input
                  data-testid="member-firstName-input"
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  placeholder="Vorname"
                  className="h-12 rounded-xl border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-base"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nachname</Label>
                <Input
                  data-testid="member-lastName-input"
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  placeholder="Nachname"
                  className="h-12 rounded-xl border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-base"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger data-testid="member-status-select" className="h-12 rounded-xl">
                    <SelectValue placeholder="Status wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aktiv">Aktiv</SelectItem>
                    <SelectItem value="passiv">Passiv</SelectItem>
                    <SelectItem value="archiviert">Archiviert (Ausgetreten)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="h-11 px-6 rounded-full bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 transition-colors"
              >
                Abbrechen
              </Button>
              <Button
                data-testid="submit-member-button"
                type="submit"
                className="h-11 px-8 rounded-full bg-emerald-700 text-white font-medium hover:bg-emerald-800 transition-transform active:scale-95 shadow-lg shadow-emerald-700/20"
              >
                Speichern
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mitglied löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie das Mitglied "{deletingMember?.name}" wirklich löschen?
              Alle zugehörigen Strafen werden ebenfalls gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              data-testid="confirm-delete-member"
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <QRCodeDialog
        open={qrDialogOpen}
        onOpenChange={setQrDialogOpen}
        member={qrMember}
      />
    </div>
  );
};

export default Members;