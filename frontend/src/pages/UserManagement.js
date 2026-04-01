import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Users, Plus, Trash2, Shield, UserCog, Eye, KeyRound, User, Pencil } from 'lucide-react';
import { toast } from 'sonner';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'vorstand',
    member_id: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, membersRes] = await Promise.all([
        api.users.getAll(),
        api.members.getAll(),
      ]);
      setUsers(usersRes.data);
      setMembers(membersRes.data);
    } catch (error) {
      console.error('Fehler beim Laden:', error);
      if (error?.code !== 'ERR_CANCELED') {
        toast.error('Fehler beim Laden der Daten');
      }
    } finally {
      setLoading(false);
    }
  };

  // Mitglieder ohne Benutzeraccount (oder mit aktuellem Benutzer)
  const getAvailableMembers = (currentUserId = null) => {
    return members.filter(m => {
      if (m.status === 'archiviert') return false;
      const existingUser = users.find(u => u.member_id === m.id);
      if (!existingUser) return true;
      if (currentUserId && existingUser.id === currentUserId) return true;
      return false;
    });
  };

  const getMemberName = (memberId) => {
    const member = members.find(m => m.id === memberId);
    if (!member) return 'Unbekannt';
    return `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.name || 'Unbekannt';
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    
    if (!formData.username || !formData.password) {
      toast.error('Bitte alle Felder ausfüllen');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Passwort muss mindestens 6 Zeichen lang sein');
      return;
    }

    if (formData.role === 'mitglied' && !formData.member_id) {
      toast.error('Bitte ein Mitglied auswählen');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        username: formData.username,
        password: formData.password,
        role: formData.role,
      };
      if ((formData.role === 'mitglied' || formData.role === 'vorstand' || formData.role === 'spiess') && formData.member_id && formData.member_id !== 'none') {
        payload.member_id = formData.member_id;
      }
      await api.users.create(payload);
      toast.success('Benutzer erstellt');
      setAddDialogOpen(false);
      setFormData({ username: '', password: '', role: 'vorstand', member_id: '' });
      loadData();
    } catch (error) {
      const message = error.response?.data?.detail || 'Fehler beim Erstellen';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    
    if (!formData.username) {
      toast.error('Benutzername darf nicht leer sein');
      return;
    }

    if (formData.role === 'mitglied' && (!formData.member_id || formData.member_id === 'none')) {
      toast.error('Mitglied-Benutzer müssen mit einem Mitglied verknüpft sein');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        username: formData.username,
        role: formData.role,
        member_id: (formData.role === 'mitglied' || formData.role === 'vorstand' || formData.role === 'spiess') 
          ? (formData.member_id === 'none' ? '' : formData.member_id) 
          : null,
      };
      await api.users.update(selectedUser.id, payload);
      toast.success('Benutzer aktualisiert');
      setEditDialogOpen(false);
      setSelectedUser(null);
      loadData();
    } catch (error) {
      const message = error.response?.data?.detail || 'Fehler beim Bearbeiten';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.users.delete(selectedUser.id);
      toast.success('Benutzer gelöscht');
      setDeleteDialogOpen(false);
      setSelectedUser(null);
      loadData();
    } catch (error) {
      const message = error.response?.data?.detail || 'Fehler beim Löschen';
      toast.error(message);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword) {
      toast.error('Bitte ein neues Passwort eingeben');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Passwort muss mindestens 6 Zeichen lang sein');
      return;
    }

    setSubmitting(true);
    try {
      await api.users.resetPassword(selectedUser.id, { new_password: newPassword });
      toast.success(`Passwort für ${selectedUser.username} zurückgesetzt`);
      setResetPasswordDialogOpen(false);
      setSelectedUser(null);
      setNewPassword('');
    } catch (error) {
      const message = error.response?.data?.detail || 'Fehler beim Zurücksetzen';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const openEditDialog = (user) => {
    setSelectedUser(user);
    setFormData({
      username: user.username,
      password: '',
      role: user.role,
      member_id: user.member_id || '',
    });
    setEditDialogOpen(true);
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'spiess': return 'Spieß';
      case 'vorstand': return 'Vorstand';
      case 'mitglied': return 'Mitglied';
      default: return role;
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin': return <Shield className="w-4 h-4 text-red-500" />;
      case 'spiess': return <UserCog className="w-4 h-4 text-emerald-600" />;
      case 'vorstand': return <Eye className="w-4 h-4 text-blue-500" />;
      case 'mitglied': return <User className="w-4 h-4 text-stone-500" />;
      default: return null;
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
              Benutzerverwaltung
            </h1>
            <p className="text-sm text-stone-500 mt-1">
              Zugänge und Rollen für die App-Anmeldung verwalten
            </p>
          </div>
          
          <Button
            data-testid="add-user-button"
            onClick={() => {
              setFormData({ username: '', password: '', role: 'vorstand', member_id: '' });
              setAddDialogOpen(true);
            }}
            className="h-10 px-4 rounded-full bg-emerald-700 text-white font-medium hover:bg-emerald-800 shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Benutzer
          </Button>
        </div>

        <Card className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4">
          <div className="flex items-center gap-3 mb-4">
            <Users className="w-5 h-5 text-emerald-700" />
            <h2 className="text-xl font-bold text-stone-900 tracking-tight">
              Alle Benutzer
            </h2>
          </div>

          <div className="space-y-2" data-testid="users-list">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 rounded-xl border border-stone-100 bg-stone-50"
                data-testid={`user-item-${user.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                    {getRoleIcon(user.role)}
                  </div>
                  <div>
                    <p className="font-semibold text-stone-900">{user.username}</p>
                    <p className="text-sm text-stone-500">
                      {getRoleLabel(user.role)}
                      {(user.role === 'mitglied' || user.role === 'vorstand' || user.role === 'spiess') && user.member_id && (
                        <span className="text-stone-400 ml-1">
                          ({getMemberName(user.member_id)})
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    data-testid={`edit-user-${user.id}`}
                    onClick={() => openEditDialog(user)}
                    className="h-10 w-10 p-0 rounded-full bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 transition-colors"
                    title="Benutzer bearbeiten"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    data-testid={`reset-password-${user.id}`}
                    onClick={() => {
                      setSelectedUser(user);
                      setNewPassword('');
                      setResetPasswordDialogOpen(true);
                    }}
                    className="h-10 w-10 p-0 rounded-full bg-amber-50 border border-amber-200 text-amber-600 hover:bg-amber-100 transition-colors"
                    title="Passwort zurücksetzen"
                  >
                    <KeyRound className="w-4 h-4" />
                  </Button>
                  <Button
                    data-testid={`delete-user-${user.id}`}
                    onClick={() => {
                      setSelectedUser(user);
                      setDeleteDialogOpen(true);
                    }}
                    className="h-10 w-10 p-0 rounded-full bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-colors"
                    title="Benutzer löschen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Benutzer erstellen Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Neuer Benutzer</DialogTitle>
            <DialogDescription>
              Erstellen Sie ein neues Benutzerkonto
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="username">Benutzername</Label>
                <Input
                  data-testid="new-user-username"
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="z.B. max.mustermann"
                  className="h-12 rounded-xl"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Passwort</Label>
                <Input
                  data-testid="new-user-password"
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Mindestens 6 Zeichen"
                  className="h-12 rounded-xl"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Rolle</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value, member_id: '' })}
                >
                  <SelectTrigger data-testid="new-user-role" className="h-12 rounded-xl">
                    <SelectValue placeholder="Rolle wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="mitglied">Mitglied</SelectItem>
                    <SelectItem value="spiess">Spieß</SelectItem>
                    <SelectItem value="vorstand">Vorstand</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(formData.role === 'mitglied' || formData.role === 'vorstand' || formData.role === 'spiess') && (
                <div className="space-y-2">
                  <Label htmlFor="member">
                    Verknüpftes Mitglied
                    {(formData.role === 'vorstand' || formData.role === 'spiess') && <span className="text-stone-400 font-normal"> (optional)</span>}
                  </Label>
                  <Select
                    value={formData.member_id || 'none'}
                    onValueChange={(value) => setFormData({ ...formData, member_id: value === 'none' ? '' : value })}
                  >
                    <SelectTrigger data-testid="new-user-member" className="h-12 rounded-xl">
                      <SelectValue placeholder="Mitglied wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {(formData.role === 'vorstand' || formData.role === 'spiess') && (
                        <SelectItem value="none">Kein Mitglied</SelectItem>
                      )}
                      {getAvailableMembers().map(member => (
                        <SelectItem key={member.id} value={member.id}>
                          {`${member.firstName || ''} ${member.lastName || ''}`.trim() || member.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-stone-500">
                    {formData.role === 'mitglied' 
                      ? 'Pflichtfeld: Mitglied muss verknüpft werden'
                      : 'Optional: Eigene Strafen im Dashboard sehen'}
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                onClick={() => setAddDialogOpen(false)}
                className="h-11 px-6 rounded-full bg-white border border-stone-200 text-stone-700 hover:bg-stone-50"
              >
                Abbrechen
              </Button>
              <Button
                data-testid="submit-new-user"
                type="submit"
                disabled={submitting || (formData.role === 'mitglied' && !formData.member_id)}
                className="h-11 px-8 rounded-full bg-emerald-700 text-white font-medium hover:bg-emerald-800"
              >
                {submitting ? 'Erstellen...' : 'Erstellen'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Benutzer bearbeiten Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        setEditDialogOpen(open);
        if (!open) setSelectedUser(null);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Benutzer bearbeiten</DialogTitle>
            <DialogDescription>
              Bearbeiten Sie das Benutzerkonto
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-username">Benutzername</Label>
                <Input
                  data-testid="edit-user-username"
                  id="edit-username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="h-12 rounded-xl"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-role">Rolle</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger data-testid="edit-user-role" className="h-12 rounded-xl">
                    <SelectValue placeholder="Rolle wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="mitglied">Mitglied</SelectItem>
                    <SelectItem value="spiess">Spieß</SelectItem>
                    <SelectItem value="vorstand">Vorstand</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(formData.role === 'mitglied' || formData.role === 'vorstand' || formData.role === 'spiess') && (
                <div className="space-y-2">
                  <Label htmlFor="edit-member">
                    Verknüpftes Mitglied
                    {(formData.role === 'vorstand' || formData.role === 'spiess') && <span className="text-stone-400 font-normal"> (optional)</span>}
                  </Label>
                  <Select
                    value={formData.member_id || 'none'}
                    onValueChange={(value) => setFormData({ ...formData, member_id: value === 'none' ? '' : value })}
                  >
                    <SelectTrigger data-testid="edit-user-member" className="h-12 rounded-xl">
                      <SelectValue placeholder="Mitglied wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {(formData.role === 'vorstand' || formData.role === 'spiess') && (
                        <SelectItem value="none">Kein Mitglied</SelectItem>
                      )}
                      {getAvailableMembers(selectedUser?.id).map(member => (
                        <SelectItem key={member.id} value={member.id}>
                          {`${member.firstName || ''} ${member.lastName || ''}`.trim() || member.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                onClick={() => setEditDialogOpen(false)}
                className="h-11 px-6 rounded-full bg-white border border-stone-200 text-stone-700 hover:bg-stone-50"
              >
                Abbrechen
              </Button>
              <Button
                data-testid="submit-edit-user"
                type="submit"
                disabled={submitting || (formData.role === 'mitglied' && (!formData.member_id || formData.member_id === 'none'))}
                className="h-11 px-8 rounded-full bg-emerald-700 text-white font-medium hover:bg-emerald-800"
              >
                {submitting ? 'Speichern...' : 'Speichern'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Löschen Bestätigung */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Benutzer löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie den Benutzer "{selectedUser?.username}" wirklich löschen? 
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              data-testid="confirm-delete-user"
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Passwort zurücksetzen Dialog */}
      <Dialog open={resetPasswordDialogOpen} onOpenChange={(open) => {
        setResetPasswordDialogOpen(open);
        if (!open) {
          setNewPassword('');
          setSelectedUser(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-amber-600" />
              Passwort zurücksetzen
            </DialogTitle>
            <DialogDescription>
              Setzen Sie ein neues Passwort für <strong>{selectedUser?.username}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Neues Passwort</Label>
              <Input
                data-testid="reset-password-input"
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mindestens 6 Zeichen"
                className="h-12 rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => setResetPasswordDialogOpen(false)}
              className="h-11 px-6 rounded-full bg-white border border-stone-200 text-stone-700 hover:bg-stone-50"
            >
              Abbrechen
            </Button>
            <Button
              data-testid="confirm-reset-password"
              onClick={handleResetPassword}
              disabled={submitting}
              className="h-11 px-8 rounded-full bg-amber-500 text-white font-medium hover:bg-amber-600"
            >
              {submitting ? 'Zurücksetzen...' : 'Zurücksetzen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;
