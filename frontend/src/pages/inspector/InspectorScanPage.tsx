import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import { QrCode, AlertCircle, Keyboard, Search } from 'lucide-react';
import { inspectorApi } from '../../services/inspectorApi';

type ScanState = 'scanning' | 'loading' | 'error';

export function InspectorScanPage() {
  const navigate = useNavigate();
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [state, setState]       = useState<ScanState>('scanning');
  const [errorMsg, setErrorMsg] = useState('');
  const [manualPlate, setManualPlate] = useState('');
  const [manualMode, setManualMode]   = useState(false);
  const [manualLoading, setManualLoading] = useState(false);
  const hasScanned = useRef(false);

  async function handleQrContent(content: string) {
    if (hasScanned.current) return;
    hasScanned.current = true;
    setState('loading');
    await scannerRef.current?.clear().catch(() => {});

    try {
      const result = await inspectorApi.scanQr(content);
      if (!result.qr_valido) {
        setErrorMsg(result.motivo ?? 'QR no válido o no reconocido');
        setState('error');
        return;
      }
      navigate(`/inspector/scan/result/${result.inspection_id}`, { state: { scanResult: result } });
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message ?? 'Error al verificar QR');
      setState('error');
    }
  }

  useEffect(() => {
    if (manualMode || !document.getElementById('inspector-qr-reader')) return;

    const scanner = new Html5QrcodeScanner(
      'inspector-qr-reader',
      {
        fps: 10,
        qrbox: { width: 260, height: 260 },
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
        rememberLastUsedCamera: true,
      },
      false,
    );

    scannerRef.current = scanner;

    scanner.render(
      (decoded) => handleQrContent(decoded),
      () => {},
    );

    return () => { scanner.clear().catch(() => {}); };
  }, [manualMode]);

  async function handleManualSearch() {
    const p = manualPlate.trim().toUpperCase();
    if (!p) return;
    setManualLoading(true);
    try {
      const result = await inspectorApi.lookupVehicle(p);
      navigate(`/inspector/lookup/vehicle`, { state: { vehicleResult: result } });
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message ?? `Vehículo ${p} no encontrado`);
    } finally {
      setManualLoading(false);
    }
  }

  function retry() {
    hasScanned.current = false;
    setErrorMsg('');
    setState('scanning');
  }

  return (
    <div className="max-w-lg mx-auto space-y-5 p-4">
      <div className="flex items-center gap-2">
        <QrCode className="h-6 w-6 text-blue-600" />
        <h1 className="text-xl font-bold text-gray-900">Escanear QR de Vehículo</h1>
      </div>

      {/* Toggle */}
      <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm font-medium">
        <button
          onClick={() => { setManualMode(false); retry(); }}
          className={`flex-1 py-2 flex items-center justify-center gap-2 transition-colors ${!manualMode ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
          <QrCode className="h-4 w-4" /> Cámara
        </button>
        <button
          onClick={() => setManualMode(true)}
          className={`flex-1 py-2 flex items-center justify-center gap-2 transition-colors ${manualMode ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
          <Keyboard className="h-4 w-4" /> Manual
        </button>
      </div>

      {/* Camera Scanner */}
      {!manualMode && (
        <>
          {state === 'scanning' && (
            <>
              <p className="text-sm text-gray-500 text-center">
                Apunta la cámara al QR pegado en el vehículo
              </p>
              <div id="inspector-qr-reader" className="w-full rounded-2xl overflow-hidden shadow-lg" />
              <p className="text-xs text-gray-400 text-center">El escaneo es automático</p>
            </>
          )}

          {state === 'loading' && (
            <div className="flex flex-col items-center gap-4 py-16">
              <div className="h-14 w-14 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
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
              <button onClick={retry}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700">
                Intentar de nuevo
              </button>
            </div>
          )}
        </>
      )}

      {/* Manual Input */}
      {manualMode && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <p className="text-sm text-gray-600">Ingresa la placa del vehículo para buscar su información</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualPlate}
              onChange={e => setManualPlate(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleManualSearch()}
              placeholder="Ej: ABC-123"
              className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-blue-500 outline-none"
              maxLength={10}
            />
            <button
              onClick={handleManualSearch}
              disabled={manualLoading || !manualPlate.trim()}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
              {manualLoading
                ? <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Search className="h-4 w-4" />}
              Buscar
            </button>
          </div>
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
              <p className="text-sm text-red-700">{errorMsg}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
