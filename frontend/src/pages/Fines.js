import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Pencil, Trash2, Plus, Calendar, Search } from 'lucide-react';
import { toast } from 'sonner';
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
import EditFineDialog from '../components/EditFineDialog';
import AddFineDialog from '../components/AddFineDialog';
import { formatCurrency, formatDate } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

const Fines = () => {
  const { canManageFines, isMitglied, isVorstand } = useAuth();
  const canCreateFines = canManageFines || isVorstand;
  const [fiscalYear, setFiscalYear] = useState('');
  const [fiscalYears, setFiscalYears] = useState([]);
  const [fines, setFines] = useState([]);
  const [createdByMeFines, setCreatedByMeFines] = useState([]);
  const [members, setMembers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingFine, setEditingFine] = useState(null);
  const [deletingFine, setDeletingFine] = useState(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (fiscalYear) {
      loadData();
    }
  }, [fiscalYear]);

  const loadInitialData = async () => {
    try {
      const yearsRes = await api.fiscalYears.getAll();
      const years = yearsRes.data?.fiscal_years || [];
      setFiscalYears(years);
      if (years.length > 0) {
        setFiscalYear(years[0]);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Geschäftsjahre:', error);
      if (error?.code !== 'ERR_CANCELED') {
        toast.error('Fehler beim Laden der Geschäftsjahre');
      }
    }
  };

  const loadData = async () => {
    if (!fiscalYear) return;
    setLoading(true);
    try {
      const [finesRes, membersRes] = await Promise.all([
        api.fines.getAll(fiscalYear),
        api.members.getAll(),
      ]);
      
      setFines(finesRes.data);
      setMembers(membersRes.data);
      
      // Vorstand: erstellte Strafen laden
      if (isVorstand) {
        try {
          const createdRes = await api.fines.getCreatedByMe(fiscalYear);
          setCreatedByMeFines(createdRes.data);
        } catch { setCreatedByMeFines([]); }
      }
    } catch (error) {
      console.error('Fehler beim Laden der Daten:', error);
      if (error?.code !== 'ERR_CANCELED') {
        toast.error('Fehler beim Laden der Daten');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.fines.delete(deletingFine.id);
      toast.success('Strafe gelöscht');
      setDeleteDialogOpen(false);
      setDeletingFine(null);
      loadData();
    } catch (error) {
      toast.error('Fehler beim Löschen');
    }
  };

  const openEditDialog = (fine) => {
    setEditingFine(fine);
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (fine) => {
    setDeletingFine(fine);
    setDeleteDialogOpen(true);
  };

  const getMemberName = (memberId) => {
    const member = members.find(m => m.id === memberId);
    if (!member) return 'Unbekannt';
    if (member.firstName && member.lastName) {
      return `${member.firstName} ${member.lastName}`;
    }
    return member.name || 'Unbekannt';
  };

  const filteredFines = fines.filter(fine => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = getMemberName(fine.member_id).toLowerCase();
    const type = (fine.fine_type_label || '').toLowerCase();
    return name.includes(q) || type.includes(q);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-stone-500">Laden...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl md:text-4xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">
              Strafenübersicht
            </h1>
            <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-full px-3 h-10 shadow-sm">
              <Calendar className="w-4 h-4 text-stone-400" />
              <select
                data-testid="fines-fiscal-year-selector"
                value={fiscalYear}
                onChange={(e) => setFiscalYear(e.target.value)}
                className="bg-transparent border-none outline-none text-stone-700 font-medium cursor-pointer text-base"
              >
                {fiscalYears.map(fy => (
                  <option key={fy} value={fy}>{fy}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-sm text-stone-500">
              {isMitglied ? 'Meine Strafeinträge' : isVorstand ? 'Meine Strafeinträge' : 'Alle Strafeinträge'}
            </p>
            {canCreateFines && (
              <Button
                data-testid="add-fine-button"
                onClick={() => setAddDialogOpen(true)}
                className="h-10 px-4 rounded-full bg-emerald-700 text-white font-medium hover:bg-emerald-800 shadow-sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Strafe
              </Button>
            )}
          </div>
          {/* Suchfeld für Admin und Spieß */}
          {canManageFines && (
            <div className="relative mt-3">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                data-testid="fines-search"
                type="text"
                placeholder="Suche nach Name oder Strafenart..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-9 pr-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
            </div>
          )}
        </div>

        <Card className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm p-4">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">
              Strafen {fiscalYear}
            </h2>
          </div>

          <div className="space-y-2" data-testid="fines-list">
            {filteredFines.length > 0 ? (
              filteredFines.map((fine) => (
                <div
                  key={fine.id}
                  className="flex items-start justify-between p-4 rounded-xl border border-stone-100 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 active:bg-stone-100 transition-colors"
                  data-testid={`fine-item-${fine.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-stone-900 truncate">
                        {getMemberName(fine.member_id)}
                      </p>
                      <span className="text-emerald-700 font-bold whitespace-nowrap">
                        {formatCurrency(fine.amount)}
                      </span>
                    </div>
                    <p className="text-sm text-stone-600 truncate">{fine.fine_type_label}</p>
                    <p className="text-xs text-stone-400 mt-1">
                      {formatDate(fine.date)}
                    </p>
                    {fine.notes && (
                      <p className="text-xs text-stone-500 mt-1 line-clamp-2">
                        Notiz: {fine.notes}
                      </p>
                    )}
                  </div>
                  {canManageFines && (
                    <div className="flex gap-2 flex-shrink-0 ml-2">
                      <Button
                        data-testid={`edit-fine-${fine.id}`}
                        onClick={() => openEditDialog(fine)}
                        className="h-10 w-10 p-0 rounded-full bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        data-testid={`delete-fine-${fine.id}`}
                        onClick={() => openDeleteDialog(fine)}
                        className="h-10 w-10 p-0 rounded-full bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-center text-stone-400 py-8">
                {searchQuery ? 'Keine Treffer' : `Noch keine Strafen für ${fiscalYear}`}
              </p>
            )}
          </div>
        </Card>

        {/* Vorstand: Von mir erstellte Strafen */}
        {isVorstand && createdByMeFines.length > 0 && (
          <Card className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm p-4 mt-4">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">
                Von mir erstellte Strafen
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">{createdByMeFines.length} Einträge im {fiscalYear}</p>
            </div>
            <div className="space-y-2" data-testid="created-by-me-fines-list">
              {createdByMeFines.map((fine) => (
                <div
                  key={fine.id}
                  className="flex items-start justify-between p-4 rounded-xl border border-stone-100 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                  data-testid={`created-fine-${fine.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-stone-900 truncate">
                        {fine.member_name || getMemberName(fine.member_id)}
                      </p>
                      <span className="text-emerald-700 font-bold whitespace-nowrap">
                        {formatCurrency(fine.amount)}
                      </span>
                    </div>
                    <p className="text-sm text-stone-600 truncate">{fine.fine_type_label}</p>
                    <p className="text-xs text-stone-400 mt-1">{formatDate(fine.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {editingFine && (
        <EditFineDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          fine={editingFine}
          onSuccess={() => {
            setEditDialogOpen(false);
            setEditingFine(null);
            loadData();
            toast.success('Strafe aktualisiert');
          }}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Strafe löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie diese Strafe wirklich löschen?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              data-testid="confirm-delete-fine"
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddFineDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        preselectedMemberId={null}
        showDateField={true}
        useEligibleMembers={true}
        onSuccess={() => {
          setAddDialogOpen(false);
          loadData();
          toast.success('Strafe hinzugefügt');
        }}
      />
    </div>
  );
};

export default Fines;