import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Download, QrCode } from 'lucide-react';
import { useBranding } from '../contexts/BrandingContext';

const QRCodeDialog = ({ open, onOpenChange, member }) => {
  const qrRef = useRef(null);
  const { clubName } = useBranding();

  if (!member) return null;

  const qrValue = `SAUINDEX-${member.id}`;
  
  // Vollständiger Name
  const fullName = member.firstName && member.lastName 
    ? `${member.firstName} ${member.lastName}` 
    : member.name || 'Unbekannt';

  const handleDownload = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = 400;
      canvas.height = 480;
      
      // White background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw QR code centered
      ctx.drawImage(img, 50, 40, 300, 300);
      
      // Add member name
      ctx.fillStyle = '#1c1917';
      ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(fullName, canvas.width / 2, 380);
      
      // Add subtitle
      ctx.fillStyle = '#78716c';
      ctx.font = '16px system-ui, -apple-system, sans-serif';
      ctx.fillText(clubName, canvas.width / 2, 410);
      
      // Download
      const link = document.createElement('a');
      link.download = `qr-code-${fullName.toLowerCase().replace(/\s+/g, '-')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            QR-Code
          </DialogTitle>
          <DialogDescription>
            QR-Code für {fullName}
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-6">
          <div 
            ref={qrRef}
            className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl border border-stone-200"
          >
            <QRCodeSVG 
              value={qrValue}
              size={200}
              level="H"
              includeMargin={true}
              bgColor="#ffffff"
              fgColor="#1c1917"
            />
            <p className="mt-4 font-bold text-lg text-stone-900">{fullName}</p>
            <p className="text-sm text-stone-500">{clubName}</p>
          </div>
          
          <p className="mt-4 text-xs text-center text-stone-400">
            Diesen QR-Code ausdrucken oder auf dem Handy speichern
          </p>
        </div>
        
        <DialogFooter>
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-11 px-6 rounded-full bg-white border border-stone-200 text-stone-700 hover:bg-stone-50"
          >
            Schließen
          </Button>
          <Button
            onClick={handleDownload}
            className="h-11 px-6 rounded-full bg-emerald-700 text-white font-medium hover:bg-emerald-800"
          >
            <Download className="w-4 h-4 mr-2" />
            Herunterladen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QRCodeDialog;
