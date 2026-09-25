import { useEffect, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera } from "lucide-react";
import { toast } from "sonner";

function ScannerInner({ onResult }) {
  useEffect(() => {
    const elId = "camera-reader-region";
    const scanner = new Html5Qrcode(elId);
    let cancelled = false;
    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 260, height: 160 } },
        (decoded) => {
          if (!cancelled) {
            cancelled = true;
            onResult(decoded);
          }
        },
        () => {}
      )
      .catch(() => {
        if (!cancelled) toast.error("Tidak dapat mengakses kamera. Izinkan akses atau gunakan input manual.");
      });
    return () => {
      cancelled = true;
      try {
        const st = scanner.getState ? scanner.getState() : 0;
        if (st === 2 || st === 3) {
          scanner.stop().then(() => { try { scanner.clear(); } catch (_) {} }).catch(() => {});
        } else {
          try { scanner.clear(); } catch (_) {}
        }
      } catch (_) {}
    };
  }, [onResult]);
  return <div id="camera-reader-region" className="overflow-hidden rounded-lg" style={{ width: "100%" }} />;
}

export function CameraScanButton({ onScan, testid = "camera-scan-btn", label = "Kamera" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" className="gap-1.5" data-testid={testid} onClick={() => setOpen(true)}>
        <Camera className="h-4 w-4" /> {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="camera-scanner-dialog">
          <DialogHeader><DialogTitle>Scan Barcode via Kamera</DialogTitle></DialogHeader>
          {open && <ScannerInner onResult={(c) => { setOpen(false); onScan(c); }} />}
          <p className="text-xs text-slate-500">Arahkan barcode ke kamera. Izinkan akses kamera bila diminta.</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
