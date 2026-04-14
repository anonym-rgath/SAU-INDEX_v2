import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tag, Plus, Pencil, Trash2 } from 'lucide-react';
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
import { formatCurrency } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

const FineTypes = () => {
  const { canManageFineTypes } = useAuth();
  const [fineTypes, setFineTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingFineType, setEditingFineType] = useState(null);
  const [deletingFineType, setDeletingFineType] = useState(null);
  const [formData, setFormData] = useState({ label: '', amount: '' });

  useEffect(() => {
    loadFineTypes();
  }, []);

  const loadFineTypes = async () => {
    try {
      const response = await api.fineTypes.getAll();
      setFineTypes(response.data);
    } catch (error) {
      console.error('Fehler beim Laden der Strafenarten:', error);
      if (error?.code !== 'ERR_CANCELED') {
        toast.error('Fehler beim Laden der Strafenarten');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        label: formData.label,
        amount: formData.amount ? parseFloat(formData.amount) : null,
      };
      
      if (editingFineType) {
        await api.fineTypes.update(editingFineType.id, data);
        toast.success('Strafenart aktualisiert');
      } else {
        await api.fineTypes.create(data);
        toast.success('Strafenart erstellt');
      }
      setDialogOpen(false);
      setEditingFineType(null);
      setFormData({ label: '', amount: '' });
      loadFineTypes();
    } catch (error) {
      toast.error('Fehler beim Speichern');
    }
  };

  const handleDelete = async () => {
    try {
      await api.fineTypes.delete(deletingFineType.id);
      toast.success('Strafenart gelöscht');
      setDeleteDialogOpen(false);
      setDeletingFineType(null);
      loadFineTypes();
    } catch (error) {
      toast.error('Fehler beim Löschen');
    }
  };

  const openAddDialog = () => {
    setEditingFineType(null);
    setFormData({ label: '', amount: '' });
    setDialogOpen(true);
  };

  const openEditDialog = (fineType) => {
    setEditingFineType(fineType);
    setFormData({
      label: fineType.label,
      amount: fineType.amount !== null ? String(fineType.amount) : '',
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = (fineType) => {
    setDeletingFineType(fineType);
    setDeleteDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-stone-500 dark:text-stone-400">Laden...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950">
      <div className="max-w-2xl lg:max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3">
              <Tag className="w-7 h-7 text-emerald-700 dark:text-emerald-400" />
              <h1 className="text-3xl md:text-4xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">
                Strafenkatalog
              </h1>
            </div>
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
              Alle verfügbaren Strafenarten
            </p>
          </div>
          {canManageFineTypes && (
            <Button
              data-testid="add-finetype-button"
              onClick={openAddDialog}
              className="h-11 px-6 rounded-full bg-emerald-700 text-white font-medium hover:bg-emerald-800 transition-transform active:scale-95 shadow-lg shadow-emerald-700/20"
            >
              <Plus className="w-5 h-5 mr-2" />
              <span className="hidden sm:inline">Strafenart</span>
              <span className="sm:hidden">Neu</span>
            </Button>
          )}
        </div>

        <Card className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm p-4">
          <div className="space-y-2" data-testid="finetypes-list">
            {fineTypes.length > 0 ? (
              fineTypes.map((fineType) => (
                <div
                  key={fineType.id}
                  className="flex items-center justify-between p-4 rounded-xl border border-stone-100 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 active:bg-stone-100 dark:active:bg-stone-700 transition-colors min-h-[72px]"
                  data-testid={`finetype-item-${fineType.id}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-stone-900 dark:text-stone-100 truncate">{fineType.label}</p>
                    <p className="text-sm text-stone-500 dark:text-stone-400">
                      {fineType.amount !== null ? formatCurrency(fineType.amount) : 'Variabel'}
                    </p>
                  </div>
                  {canManageFineTypes && (
                    <div className="flex gap-2 flex-shrink-0 ml-2">
                      <Button
                        data-testid={`edit-finetype-${fineType.id}`}
                        onClick={() => openEditDialog(fineType)}
                        className="h-10 w-10 p-0 rounded-full bg-white dark:bg-stone-700 border border-stone-200 dark:border-stone-600 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-600 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        data-testid={`delete-finetype-${fineType.id}`}
                        onClick={() => openDeleteDialog(fineType)}
                        className="h-10 w-10 p-0 rounded-full bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-center text-stone-400 dark:text-stone-500 py-8">
                Noch keine Strafenarten
              </p>
            )}
          </div>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingFineType ? 'Strafenart bearbeiten' : 'Neue Strafenart'}
            </DialogTitle>
            <DialogDescription>
              {editingFineType ? 'Strafenart anpassen' : 'Neue Strafenart erstellen'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="label">Bezeichnung</Label>
                <Input
                  data-testid="finetype-label-input"
                  id="label"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  placeholder="z.B. Zu spät"
                  className="h-12 rounded-xl border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-800 focus:bg-white dark:focus:bg-stone-700 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-base"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Betrag (EUR)</Label>
                <Input
                  data-testid="finetype-amount-input"
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="Leer lassen für variablen Betrag"
                  className="h-12 rounded-xl border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-800 focus:bg-white dark:focus:bg-stone-700 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-base"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="h-11 px-6 rounded-full bg-white dark:bg-stone-700 border border-stone-200 dark:border-stone-600 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-600 transition-colors"
              >
                Abbrechen
              </Button>
              <Button
                data-testid="submit-finetype-button"
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
            <AlertDialogTitle>Strafenart löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie die Strafenart "{deletingFineType?.label}" wirklich löschen?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              data-testid="confirm-delete-finetype"
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FineTypes;
