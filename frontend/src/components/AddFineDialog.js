import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { toast } from 'sonner';

const AddFineDialog = ({ open, onOpenChange, onSuccess, preselectedMemberId = null, showDateField = false, useEligibleMembers = false }) => {
  const [members, setMembers] = useState([]);
  const [fineTypes, setFineTypes] = useState([]);
  const [formData, setFormData] = useState({
    member_id: preselectedMemberId || '',
    fine_type_id: '',
    amount: '',
    date: '',
    notes: '',
  });

  useEffect(() => {
    if (open) {
      loadData();
      if (preselectedMemberId) {
        setFormData(prev => ({ ...prev, member_id: preselectedMemberId }));
      }
    }
  }, [open, preselectedMemberId]);

  const loadData = async () => {
    try {
      const [membersRes, fineTypesRes] = await Promise.all([
        useEligibleMembers ? api.fines.getEligibleMembers() : api.members.getAll(),
        api.fineTypes.getAll(),
      ]);
      setMembers(membersRes.data);
      setFineTypes(fineTypesRes.data);
    } catch (error) {
      toast.error('Fehler beim Laden der Daten');
    }
  };

  const handleFineTypeChange = (fineTypeId) => {
    const fineType = fineTypes.find(ft => ft.id === fineTypeId);
    setFormData({
      ...formData,
      fine_type_id: fineTypeId,
      amount: fineType?.amount !== null ? String(fineType.amount) : formData.amount,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.member_id || !formData.fine_type_id || !formData.amount) {
      toast.error('Bitte alle Pflichtfelder ausfüllen');
      return;
    }

    try {
      await api.fines.create({
        member_id: formData.member_id,
        fine_type_id: formData.fine_type_id,
        amount: parseFloat(formData.amount),
        date: formData.date || null,
        notes: formData.notes || null,
      });
      setFormData({ member_id: '', fine_type_id: '', amount: '', date: '', notes: '' });
      onSuccess();
    } catch (error) {
      toast.error('Fehler beim Erstellen der Strafe');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Strafe eintragen</DialogTitle>
          <DialogDescription>
            Erfassen Sie eine neue Strafe für ein Mitglied
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="member">Mitglied *</Label>
              <Select
                value={formData.member_id}
                onValueChange={(value) => setFormData({ ...formData, member_id: value })}
              >
                <SelectTrigger data-testid="select-member" className="h-12 rounded-xl">
                  <SelectValue placeholder="Mitglied wählen" />
                </SelectTrigger>
                <SelectContent>
                  {members
                    .filter(member => member.status !== 'archiviert')
                    .map(member => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.firstName && member.lastName 
                        ? `${member.firstName} ${member.lastName}` 
                        : member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fineType">Strafenart *</Label>
              <Select
                value={formData.fine_type_id}
                onValueChange={handleFineTypeChange}
              >
                <SelectTrigger data-testid="select-finetype" className="h-12 rounded-xl">
                  <SelectValue placeholder="Strafenart wählen" />
                </SelectTrigger>
                <SelectContent>
                  {fineTypes.map(ft => (
                    <SelectItem key={ft.id} value={ft.id}>
                      {ft.label} {ft.amount !== null ? `(${ft.amount}€)` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Betrag (€) *</Label>
              <Input
                data-testid="fine-amount-input"
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                className="h-12 rounded-xl border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-base"
                required
              />
            </div>

            {showDateField && (
              <div className="space-y-2">
                <Label htmlFor="date">Datum (optional)</Label>
                <Input
                  data-testid="fine-date-input"
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="h-12 rounded-xl border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-base"
                />
                <p className="text-xs text-stone-400">Leer lassen für heutiges Datum</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Notiz (optional)</Label>
              <Textarea
                data-testid="fine-notes-input"
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Zusätzliche Informationen"
                className="rounded-xl border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-base"
              />
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
              data-testid="submit-fine-button"
              type="submit"
              className="h-11 px-8 rounded-full bg-emerald-700 text-white font-medium hover:bg-emerald-800 transition-transform active:scale-95 shadow-lg shadow-emerald-700/20"
            >
              Speichern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddFineDialog;