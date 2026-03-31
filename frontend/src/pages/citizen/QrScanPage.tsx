import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import { AlertCircle, QrCode } from 'lucide-react';
import api from '../../services/api';
import type { QrScanResult } from '../../types';

type ScanState = 'scanning' | 'loading' | 'error';

export function QrScanPage() {
  const navigate = useNavigate();
  const [state, setState]       = useState<ScanState>('scanning');
  const [errorMsg, setErrorMsg] = useState('');
  const hasScanned = useRef(false);

  const onScanSuccess = useCallback(async (decodedText: string) => {
    if (hasScanned.current) return;
    hasScanned.current = true;

    const match  = decodedText.match(/\/scan\/([^/?#\s]+)/);
    const qrCode = match?.[1] ?? decodedText;

    setState('loading');

    try {
      const result = await api.get<QrScanResult>(`/api/qr/scan/${encodeURIComponent(qrCode)}`);

      if (!result.active_trip) {
        setErrorMsg('Este vehículo no tiene un viaje activo en este momento.');
        setState('error');
        return;
      }

      navigate(`/citizen/trip/${result.active_trip.id}`, {
        state: { scanResult: result, qrCode },
      });
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'QR no válido o no reconocido.';
      setErrorMsg(msg);
      setState('error');
    }
  }, [navigate]);

  // Create/destroy scanner whenever state returns to 'scanning'
  useEffect(() => {
    if (state !== 'scanning') return;
    // Guard: div must exist in DOM (it renders only in 'scanning' state)
    if (!document.getElementById('qr-reader')) return;

    hasScanned.current = false;

    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      {
        fps: 10,
        qrbox: { width: 260, height: 260 },
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
        rememberLastUsedCamera: true,
      },
      /* verbose */ false,
    );

    scanner.render(
      onScanSuccess,
      () => { /* ignore per-frame scan errors */ },
    );

    return () => {
      scanner.clear().catch(() => {});
    };
  }, [state, onScanSuccess]);

  function retry() {
    setErrorMsg('');
    setState('scanning'); // triggers the useEffect above after DOM update
  }

  return (
    <div className="flex flex-col items-center px-4 py-6 max-w-md mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <QrCode className="h-6 w-6 text-[#1B4F72]" />
        <h1 className="text-xl font-bold text-gray-900">Escanear QR del vehículo</h1>
      </div>

      {state === 'scanning' && (
        <>
          <p className="text-sm text-gray-500 mb-5 text-center">
            Apunta la cámara al código QR ubicado en el interior del vehículo
          </p>
          {/* html5-qrcode renders into this div */}
          <div id="qr-reader" className="w-full rounded-2xl overflow-hidden shadow-lg" />
          <p className="text-xs text-gray-400 mt-4 text-center">
            El escaneo es automático al detectar el código
          </p>
        </>
      )}

      {state === 'loading' && (
        <div className="flex flex-col items-center gap-4 py-16">
          <div className="h-14 w-14 rounded-full border-4 border-[#1B4F72] border-t-transparent animate-spin" />
          <p className="text-gray-600 font-medium">Verificando QR…</p>
        </div>
      )}

      {state === 'error' && (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-lg">QR no válido</p>
            <p className="text-gray-500 text-sm mt-1">{errorMsg}</p>
          </div>
          <button
            onClick={retry}
            className="mt-2 px-6 py-3 bg-[#1B4F72] text-white rounded-xl font-medium hover:bg-[#154060] transition-colors"
          >
            Intentar de nuevo
          </button>
        </div>
      )}
    </div>
  );
}
