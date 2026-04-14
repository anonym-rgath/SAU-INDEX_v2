import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { api } from '../lib/api';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { QrCode, Camera, CameraOff, UserCheck, AlertCircle } from 'lucide-react';

const QRScanDialog = ({ open, onOpenChange, onScanComplete }) => {
  const [members, setMembers] = useState([]);
  const [scannedMember, setScannedMember] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [manualMode, setManualMode] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  useEffect(() => {
    if (open) {
      loadMembers();
      setScannedMember(null);
      setAvatarUrl(null);
      setError(null);
      
      // Kamera funktioniert nur über HTTPS oder localhost
      const isSecure = window.location.protocol === 'https:' || 
                       window.location.hostname === 'localhost' ||
                       window.location.hostname === '127.0.0.1';
      
      if (!isSecure) {
        setManualMode(true);
        setError("Kamera benötigt HTTPS. Bitte Mitglied manuell auswählen.");
      } else {
        setManualMode(false);
      }
    } else {
      stopScanner();
    }
    
    return () => {
      stopScanner();
    };
  }, [open]);

  const loadMembers = async () => {
    try {
      const response = await api.members.getAll();
      setMembers(response.data);
    } catch (error) {
      console.error('Fehler beim Laden der Mitglieder', error);
    }
  };

  const startScanner = async () => {
    if (!scannerRef.current) return;
    
    setError(null);
    setScanning(true);
    
    try {
      html5QrCodeRef.current = new Html5Qrcode("qr-reader");
      
      await html5QrCodeRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        onScanSuccess,
        onScanFailure
      );
    } catch (err) {
      console.error("Scanner error:", err);
      setError("Kamera konnte nicht gestartet werden. Bitte Berechtigung erteilen oder manuell auswählen.");
      setScanning(false);
      setManualMode(true);
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current = null;
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
    }
    setScanning(false);
  };

  const loadAvatar = async (path) => {
    try {
      const res = await api.get(`/profile/avatar/${path}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      setAvatarUrl(url);
    } catch {
      setAvatarUrl(null);
    }
  };

  const selectMember = (member) => {
    setScannedMember(member);
    setAvatarUrl(null);
    if (member.avatar_path) loadAvatar(member.avatar_path);
  };

  const onScanSuccess = (decodedText) => {
    // Expected format: SAUINDEX-{memberId}
    const match = decodedText.match(/^SAUINDEX-(.+)$/);
    
    if (match) {
      const memberId = match[1];
      const member = members.find(m => m.id === memberId || m.qr_code === decodedText);
      
      if (member) {
        selectMember(member);
        stopScanner();
      } else {
        setError("Mitglied nicht gefunden. QR-Code ungültig.");
      }
    } else {
      // Try direct member ID match
      const member = members.find(m => m.id === decodedText || m.qr_code === decodedText);
      if (member) {
        selectMember(member);
        stopScanner();
      }
    }
  };

  const onScanFailure = (error) => {
    // Ignore scan failures (no QR code in frame)
  };

  const handleManualSelect = (memberId) => {
    const member = members.find(m => m.id === memberId);
    if (member) {
      selectMember(member);
    }
  };

  const handleContinue = () => {
    if (scannedMember) {
      onScanComplete(scannedMember.id);
    }
  };

  const handleClose = () => {
    stopScanner();
    if (avatarUrl) URL.revokeObjectURL(avatarUrl);
    setAvatarUrl(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            QR-Code Scanner
          </DialogTitle>
          <DialogDescription>
            Scanne den QR-Code eines Mitglieds
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          {scannedMember ? (
            <div className="text-center">
              <div className="flex justify-center mb-4">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profilbild" className="w-24 h-24 rounded-2xl object-cover border-2 border-emerald-200" />
                ) : (
                  <div className="bg-emerald-100 p-6 rounded-2xl">
                    <UserCheck className="w-12 h-12 text-emerald-700" />
                  </div>
                )}
              </div>
              <p className="text-stone-900 font-semibold text-lg mb-2">
                Mitglied erkannt
              </p>
              <p className="text-2xl font-bold text-emerald-700 mb-2">
                {scannedMember.firstName && scannedMember.lastName 
                  ? `${scannedMember.firstName} ${scannedMember.lastName}` 
                  : scannedMember.name || 'Unbekannt'}
              </p>
              <p className="text-sm text-stone-500">
                {scannedMember.status === 'aktiv' ? 'Aktives Mitglied' : 'Passives Mitglied'}
              </p>
            </div>
          ) : manualMode ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error || "Kamera nicht verfügbar. Bitte Mitglied manuell auswählen."}</span>
              </div>
              
              <div className="max-h-64 overflow-y-auto space-y-2">
                {members
                  .filter(m => m.status !== 'archiviert')
                  .map(member => (
                    <button
                      key={member.id}
                      onClick={() => handleManualSelect(member.id)}
                      className="w-full p-3 rounded-xl border border-stone-200 hover:bg-stone-50 active:bg-stone-100 transition-colors text-left flex items-center gap-3"
                    >
                      <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                        {(member.firstName || member.name || '?').charAt(0)}
                      </div>
                      <span className="font-medium text-stone-900">
                        {member.firstName && member.lastName 
                          ? `${member.firstName} ${member.lastName}` 
                          : member.name}
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div 
                id="qr-reader" 
                ref={scannerRef}
                className="w-full aspect-square bg-stone-100 rounded-xl overflow-hidden"
              />
              
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              
              <div className="flex gap-2">
                {!scanning ? (
                  <Button
                    onClick={startScanner}
                    className="flex-1 h-11 rounded-full bg-emerald-700 text-white font-medium hover:bg-emerald-800"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Kamera starten
                  </Button>
                ) : (
                  <Button
                    onClick={stopScanner}
                    className="flex-1 h-11 rounded-full bg-stone-200 text-stone-700 font-medium hover:bg-stone-300"
                  >
                    <CameraOff className="w-4 h-4 mr-2" />
                    Kamera stoppen
                  </Button>
                )}
                
                <Button
                  onClick={() => setManualMode(true)}
                  variant="outline"
                  className="h-11 px-4 rounded-full"
                >
                  Manuell
                </Button>
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button
            type="button"
            onClick={handleClose}
            className="h-11 px-6 rounded-full bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 transition-colors"
          >
            Abbrechen
          </Button>
          {scannedMember && (
            <Button
              data-testid="scan-continue-button"
              onClick={handleContinue}
              className="h-11 px-8 rounded-full bg-emerald-700 text-white font-medium hover:bg-emerald-800 transition-transform active:scale-95 shadow-lg shadow-emerald-700/20"
            >
              Strafe buchen
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QRScanDialog;
