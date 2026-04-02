import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';
import { Users, Plus, Pencil, Trash2, QrCode, Archive, KeyRound, Eye, EyeOff } from 'lucide-react';
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

const ROLE_LABELS = {
  spiess: 'Spieß',
  vorstand: 'Vorstand',
  mitglied: 'Mitglied',
};

const Members = () => {
  const { canManageMembers, isAdmin, isSpiess } = useAuth();
  const canManageAccess = isAdmin || isSpiess || isVorstand;
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrMember, setQrMember] = useState(null);
  const [editingMember, setEditingMember] = useState(null);
  const [deletingMember, setDeletingMember] = useState(null);
  const [sortBy, setSortBy] = useState('name-asc');
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '', lastName: '', status: 'aktiv',
    appAccess: false, username: '', password: '', role: 'mitglied',
  });

  const getFullName = (member) => {
    if (member.firstName && member.lastName) return `${member.firstName} ${member.lastName}`;
    return member.name || 'Unbekannt';
  };

  useEffect(() => { loadMembers(); }, []);

  const loadMembers = async () => {
    try {
      const response = await api.members.getAll();
      setMembers(response.data);
    } catch (error) {
      if (error?.code !== 'ERR_CANCELED') toast.error('Fehler beim Laden der Mitglieder');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const memberPayload = { firstName: formData.firstName, lastName: formData.lastName, status: formData.status };

      if (editingMember) {
        // Mitglied aktualisieren
        await api.members.update(editingMember.id, memberPayload);

        // App-Zugang verwalten
        const hadAccess = !!editingMember.user_info;
        if (formData.appAccess && !hadAccess) {
          // Zugang aktivieren
          await api.members.enableAccess(editingMember.id, {
            username: formData.username, password: formData.password, role: formData.role,
          });
        } else if (!formData.appAccess && hadAccess) {
          // Zugang deaktivieren
          await api.members.disableAccess(editingMember.id);
        } else if (formData.appAccess && hadAccess) {
          // Zugang aktualisieren (nur wenn etwas geändert)
          const updates = {};
          if (formData.username !== editingMember.user_info.username) updates.username = formData.username;
          if (formData.role !== editingMember.user_info.role) updates.role = formData.role;
          if (formData.password) updates.password = formData.password;
          if (Object.keys(updates).length > 0) {
            await api.members.updateAccess(editingMember.id, updates);
          }
        }
        toast.success('Mitglied aktualisiert');
      } else {
        // Neues Mitglied erstellen
        const res = await api.members.create(memberPayload);
        const newMemberId = res.data.id;
        if (formData.appAccess && formData.username && formData.password) {
          await api.members.enableAccess(newMemberId, {
            username: formData.username, password: formData.password, role: formData.role,
          });
        }
        toast.success('Mitglied erstellt');
      }
      closeDialog();
      loadMembers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler beim Speichern');
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
      toast.error(error.response?.data?.detail || 'Fehler beim Löschen');
    }
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingMember(null);
    setShowPassword(false);
    setFormData({ firstName: '', lastName: '', status: 'aktiv', appAccess: false, username: '', password: '', role: 'mitglied' });
  };

  const openAddDialog = () => {
    setEditingMember(null);
    setShowPassword(false);
    setFormData({ firstName: '', lastName: '', status: 'aktiv', appAccess: false, username: '', password: '', role: 'mitglied' });
    setDialogOpen(true);
  };

  const openEditDialog = (member) => {
    setEditingMember(member);
    setShowPassword(false);
    setFormData({
      firstName: member.firstName || '',
      lastName: member.lastName || '',
      status: member.status || 'aktiv',
      appAccess: !!member.user_info,
      username: member.user_info?.username || '',
      password: '',
      role: member.user_info?.role || 'mitglied',
    });
    setDialogOpen(true);
  };

  const activeMembers = members.filter(m => m.status !== 'archiviert');
  const archivedMembers = members.filter(m => m.status === 'archiviert');

  const getSortedMembers = (list) => {
    const sorted = [...list];
    switch (sortBy) {
      case 'name-asc': return sorted.sort((a, b) => getFullName(a).localeCompare(getFullName(b)));
      case 'name-desc': return sorted.sort((a, b) => getFullName(b).localeCompare(getFullName(a)));
      case 'status-aktiv': return sorted.sort((a, b) => (a.status === 'aktiv' ? -1 : 1) || getFullName(a).localeCompare(getFullName(b)));
      case 'status-passiv': return sorted.sort((a, b) => (a.status === 'passiv' ? -1 : 1) || getFullName(a).localeCompare(getFullName(b)));
      case 'date-newest': return sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      case 'date-oldest': return sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      default: return sorted;
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="text-stone-500">Laden...</div></div>;

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">Benutzerverwaltung</h1>
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">Stammdaten und App-Zugang aller Vereinsmitglieder</p>
          </div>
          {canManageMembers && (
            <Button data-testid="add-member-button" onClick={openAddDialog} className="h-11 px-6 rounded-full bg-emerald-700 text-white font-medium hover:bg-emerald-800 transition-transform active:scale-95 shadow-lg shadow-emerald-700/20">
              <Plus className="w-5 h-5 mr-2" /><span className="hidden sm:inline">Mitglied</span><span className="sm:hidden">Neu</span>
            </Button>
          )}
        </div>

        <div className="mb-4">
          <Select value={sortBy} onValueChange={setSortBy}>
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

        <Card className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm p-4">
          <div className="flex items-center gap-3 mb-1">
            <Users className="w-5 h-5 text-emerald-700" />
            <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">Alle Mitglieder</h2>
            <span className="text-sm text-stone-500">({activeMembers.length})</span>
          </div>
          <p className="text-sm text-stone-500 mb-4 ml-8">Aktive und passive Vereinsmitglieder</p>

          <div className="space-y-2" data-testid="members-list">
            {activeMembers.length > 0 ? getSortedMembers(activeMembers).map((member) => (
              <div key={member.id} className="flex items-center justify-between p-4 rounded-xl border border-stone-100 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 transition-colors min-h-[72px]" data-testid={`member-item-${member.id}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-stone-900 dark:text-stone-100">{getFullName(member)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${member.status === 'aktiv' ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-stone-600'}`}>
                      {member.status === 'aktiv' ? 'Aktiv' : 'Passiv'}
                    </span>
                    {member.user_info && (
                      <Badge className="bg-blue-50 text-blue-700 border-0 text-xs gap-1">
                        <KeyRound className="w-3 h-3" />
                        {ROLE_LABELS[member.user_info.role] || member.user_info.role}
                      </Badge>
                    )}
                  </div>
                  {member.user_info && (
                    <p className="text-xs text-stone-400 mt-0.5">Login: {member.user_info.username}</p>
                  )}
                </div>
                {canManageMembers && (
                  <div className="flex gap-2 flex-shrink-0 ml-2">
                    <Button data-testid={`qr-member-${member.id}`} onClick={() => { setQrMember(member); setQrDialogOpen(true); }} className="h-10 w-10 p-0 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100" title="QR-Code">
                      <QrCode className="w-4 h-4" />
                    </Button>
                    <Button data-testid={`edit-member-${member.id}`} onClick={() => openEditDialog(member)} className="h-10 w-10 p-0 rounded-full bg-white border border-stone-200 text-stone-700 hover:bg-stone-50" title="Bearbeiten">
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            )) : (
              <p className="text-center text-stone-400 py-8">Noch keine Mitglieder</p>
            )}
          </div>
        </Card>

        {archivedMembers.length > 0 && (
          <Card className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 mt-6">
            <div className="flex items-center gap-3 mb-1">
              <Archive className="w-5 h-5 text-stone-500" />
              <h2 className="text-xl font-bold text-stone-900 tracking-tight">Archiv</h2>
              <span className="text-sm text-stone-500">({archivedMembers.length})</span>
            </div>
            <p className="text-sm text-stone-500 mb-4">Ausgetretene Mitglieder (erscheinen nicht in Rankings)</p>
            <div className="space-y-2" data-testid="archived-members-list">
              {archivedMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-4 rounded-xl border border-stone-100 bg-stone-100/50 min-h-[72px] opacity-75" data-testid={`archived-member-item-${member.id}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-stone-600">{getFullName(member)}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-stone-300 text-stone-600">Archiviert</span>
                    </div>
                  </div>
                  {canManageMembers && (
                    <div className="flex gap-2 flex-shrink-0 ml-2">
                      <Button data-testid={`edit-archived-member-${member.id}`} onClick={() => openEditDialog(member)} className="h-10 w-10 p-0 rounded-full bg-white border border-stone-200 text-stone-700 hover:bg-stone-50" title="Bearbeiten">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button data-testid={`delete-archived-member-${member.id}`} onClick={() => { setDeletingMember(member); setDeleteDialogOpen(true); }} className="h-10 w-10 p-0 rounded-full bg-red-50 border border-red-200 text-red-600 hover:bg-red-100" title="Endgültig löschen">
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

      {/* Mitglied Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingMember ? 'Mitglied bearbeiten' : 'Neues Mitglied'}</DialogTitle>
            <DialogDescription>{editingMember ? 'Stammdaten und App-Zugang verwalten' : 'Neues Mitglied mit optionalem App-Zugang'}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Vorname</Label>
                <Input data-testid="member-firstName-input" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} placeholder="Vorname" className="h-12 rounded-xl border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-base" required />
              </div>
              <div className="space-y-2">
                <Label>Nachname</Label>
                <Input data-testid="member-lastName-input" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} placeholder="Nachname" className="h-12 rounded-xl border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-base" required />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger data-testid="member-status-select" className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aktiv">Aktiv</SelectItem>
                    <SelectItem value="passiv">Passiv</SelectItem>
                    <SelectItem value="archiviert">Archiviert (Ausgetreten)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* App-Zugang */}
              {canManageAccess && formData.status !== 'archiviert' && (
                <>
                  <div className="border-t border-stone-200 pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-semibold">App-Zugang</Label>
                        <p className="text-xs text-stone-400">Mitglied kann sich in der App anmelden</p>
                      </div>
                      <Switch data-testid="member-access-toggle" checked={formData.appAccess} onCheckedChange={(checked) => setFormData({ ...formData, appAccess: checked })} />
                    </div>
                  </div>

                  {formData.appAccess && (
                    <div className="space-y-3 bg-stone-50 rounded-xl p-4">
                      <div className="space-y-2">
                        <Label>Benutzername</Label>
                        <Input data-testid="member-username-input" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} placeholder="z.B. vorname.nachname" className="h-11 rounded-xl border-stone-200 bg-white text-sm" required />
                      </div>
                      <div className="space-y-2">
                        <Label>{editingMember?.user_info ? 'Neues Passwort (leer = unverändert)' : 'Passwort'}</Label>
                        <div className="relative">
                          <Input data-testid="member-password-input" type={showPassword ? 'text' : 'password'} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder={editingMember?.user_info ? 'Nur bei Änderung eingeben' : 'Min. 8 Zeichen, 1 Zahl'} className="h-11 rounded-xl border-stone-200 bg-white text-sm pr-10" required={!editingMember?.user_info} />
                          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Rolle</Label>
                        <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                          <SelectTrigger data-testid="member-role-select" className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="mitglied">Mitglied</SelectItem>
                            <SelectItem value="vorstand">Vorstand</SelectItem>
                            <SelectItem value="spiess">Spieß</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <DialogFooter>
              <Button type="button" onClick={closeDialog} className="h-11 px-6 rounded-full bg-white border border-stone-200 text-stone-700 hover:bg-stone-50">Abbrechen</Button>
              <Button data-testid="submit-member-button" type="submit" className="h-11 px-8 rounded-full bg-emerald-700 text-white font-medium hover:bg-emerald-800 transition-transform active:scale-95 shadow-lg shadow-emerald-700/20">Speichern</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mitglied löschen?</AlertDialogTitle>
            <AlertDialogDescription>Möchten Sie {deletingMember ? getFullName(deletingMember) : ''} wirklich löschen? Alle zugehörigen Strafen werden ebenfalls gelöscht.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction data-testid="confirm-delete-member" onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <QRCodeDialog open={qrDialogOpen} onOpenChange={setQrDialogOpen} member={qrMember} />
    </div>
  );
};

export default Members;
