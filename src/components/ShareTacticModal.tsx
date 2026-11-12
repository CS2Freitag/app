import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import JSZip from 'jszip';
import jsQR from 'jsqr';
import LZString from 'lz-string';
import { decodeCompactTactic } from '../utils/tacticCodec';
import { 
  X, 
  Copy, 
  Check, 
  Save, 
  QrCode, 
  Share2, 
  FileCode, 
  Archive, 
  Camera, 
  Upload, 
  ArrowRight,
  RefreshCw,
  FolderOpen,
  Image as ImageIcon,
  Download
} from 'lucide-react';
import { generateTacticSheetPng } from '../utils/tacticSheetExport';
import { Language, MapData, TacticalDrawingLine, UtilityMarker, PlayerToken } from '../types';

interface ShareTacticModalProps {
  isOpen: boolean;
  onClose: () => void;
  mapData: MapData;
  shareUrl: string;
  defaultTitle: string;
  tacticState: {
    drawings: TacticalDrawingLine[];
    utilities: UtilityMarker[];
    players: PlayerToken[];
  };
  onSaveAsMyTactic: (tacticTitle: string) => void;
  onLoadTacticState?: (tacticState: { drawings: TacticalDrawingLine[]; utilities: UtilityMarker[]; players: PlayerToken[] }, tacticTitle?: string) => void;
  lang: Language;
}

export const ShareTacticModal: React.FC<ShareTacticModalProps> = ({
  isOpen,
  onClose,
  mapData,
  shareUrl,
  defaultTitle,
  tacticState,
  onSaveAsMyTactic,
  onLoadTacticState,
  lang,
}) => {
  const isDe = lang === 'de';
  const [activeTab, setActiveTab] = useState<'share' | 'load'>('share');
  const [copied, setCopied] = useState(false);
  const [tacticName, setTacticName] = useState(defaultTitle);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [isExportingPng, setIsExportingPng] = useState(false);

  const handleExportPngSheet = async () => {
    try {
      setIsExportingPng(true);
      const title = tacticName.trim() || defaultTitle || mapData.name;
      const dataUrl = await generateTacticSheetPng(mapData, tacticState, title);
      const a = document.createElement('a');
      a.href = dataUrl;
      const safeName = title.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      a.download = `CS2Freitag_${safeName}_TacticSheet.png`;
      a.click();
    } catch (err) {
      console.error('PNG export error:', err);
      alert(isDe ? 'Fehler beim Erstellen des Taktik-Bildes.' : 'Error generating tactic image.');
    } finally {
      setIsExportingPng(false);
    }
  };

  // Load / Import state
  const [manualCodeInput, setManualCodeInput] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadSuccess, setLoadSuccess] = useState<string | null>(null);

  // Scanner state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const qrImageInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setTacticName(defaultTitle);
    setCopied(false);
    setSavedSuccess(false);
    setLoadError(null);
    setLoadSuccess(null);
    setManualCodeInput('');
  }, [defaultTitle, isOpen]);

  // Stop camera on modal close or tab switch
  useEffect(() => {
    if (!isOpen || activeTab !== 'load') {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab]);

  useEffect(() => {
    if (shareUrl && isOpen) {
      // Use ErrorCorrectionLevel 'L' (Low) to make the QR matrix as coarse, clear, and easy to scan as possible!
      QRCode.toDataURL(shareUrl, {
        width: 260,
        margin: 1,
        errorCorrectionLevel: 'L',
        color: {
          dark: '#09090b',
          light: '#ffffff',
        },
      })
        .then((url) => setQrCodeDataUrl(url))
        .catch((err) => console.error('QR code generation error:', err));
    }
  }, [shareUrl, isOpen]);

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          isDe
            ? 'Kamerazugriff wird in diesem Browserkontext nicht unterstützt. Bitte nutze "QR-Bild wählen" oder füge den Link/Code ein.'
            : 'Camera access is not supported in this browser context. Please use "Upload QR image" or paste the link/code.'
        );
        return;
      }

      setIsCameraActive(true);

      // Try environment camera first, then fall back to any available video input
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
        });
      } catch (firstErr) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
      }

      if (stream) {
        let attempts = 0;
        const attachStream = async () => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.setAttribute('playsinline', 'true');
            try {
              await videoRef.current.play();
              scanVideoFrame();
            } catch (playErr) {
              console.warn('Video play error:', playErr);
            }
          } else if (attempts < 20) {
            attempts++;
            setTimeout(attachStream, 50);
          }
        };
        attachStream();
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      const isDenied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
      setCameraError(
        isDenied
          ? isDe
            ? 'Kamerazugriff wurde verweigert. Tipp: Erlaube die Kamera in den Browser-Einstellungen (Schloss-Symbol in der Adresszeile) oder nutze unten direkt "QR-Bild wählen" bzw. die Code-Eingabe.'
            : 'Camera permission was denied. Tip: Allow camera in browser settings (lock icon in address bar) or use "Upload QR image" / code input below.'
          : isDe
          ? 'Kamera konnte nicht gestartet werden. Nutze stattdessen "QR-Bild wählen" oder den Link/Code.'
          : 'Could not start camera. Use "Upload QR image" or link/code instead.'
      );
      setIsCameraActive(false);
    }
  };

  const scanVideoFrame = () => {
    if (!videoRef.current || !canvasRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(scanVideoFrame);
      return;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (ctx) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data) {
        stopCamera();
        applyExtractedTactic(code.data);
        return;
      }
    }

    animationFrameRef.current = requestAnimationFrame(scanVideoFrame);
  };

  // Scan QR code from an uploaded image file
  const handleScanQrFromImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            applyExtractedTactic(code.data);
          } else {
            setLoadError(isDe ? 'Kein QR-Code im Bild erkannt.' : 'No QR code found in image.');
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Process and apply extracted string (URL, compressed code, or raw JSON)
  const applyExtractedTactic = (rawString: string) => {
    setLoadError(null);
    setLoadSuccess(null);

    const decoded = decodeCompactTactic(rawString);

    if (!decoded) {
      setLoadError(
        isDe
          ? 'Ungültiger Taktik-Code oder nicht lesbar.'
          : 'Invalid or unreadable tactic code.'
      );
      return;
    }

    const loadedDrawings = decoded.drawings;
    const loadedUtilities = decoded.utilities;
    const loadedPlayers = decoded.players;
    const title = decoded.name || `${mapData.name} - Geladene Taktik`;

    if (onLoadTacticState) {
      onLoadTacticState(
        {
          drawings: loadedDrawings,
          utilities: loadedUtilities,
          players: loadedPlayers,
        },
        title
      );
      setLoadSuccess(
        isDe
          ? `Taktik "${title}" erfolgreich geladen!`
          : `Tactic "${title}" loaded successfully!`
      );
      setTimeout(() => {
        onClose();
      }, 1200);
    } else {
      setLoadError(isDe ? 'Lade-Funktion nicht verfügbar.' : 'Load function unavailable.');
    }
  };

  // Load from single map JSON or ZIP file
  const handleLoadFromFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (file.name.endsWith('.zip') || file.type.includes('zip')) {
        const zip = new JSZip();
        const loaded = await zip.loadAsync(file);
        const jsonEntry =
          loaded.file('map.json') ||
          loaded.file('backup.json') ||
          Object.values(loaded.files).find((f) => f.name.endsWith('.json'));

        if (!jsonEntry) {
          setLoadError(isDe ? 'Keine Kartendatei im ZIP-Archiv gefunden.' : 'No map file in ZIP.');
          return;
        }

        const text = await jsonEntry.async('text');
        const parsed = JSON.parse(text);
        const mapObj = parsed?.map || (parsed?.callouts ? parsed : undefined);
        if (mapObj && mapObj.tacticData) {
          applyExtractedTactic(JSON.stringify(mapObj.tacticData));
        } else {
          setLoadError(isDe ? 'Keine Taktik-Zeichnungen in dieser Datei gefunden.' : 'No tactics found in file.');
        }
      } else {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const mapObj = parsed?.map || (parsed?.callouts ? parsed : undefined);
        if (mapObj && mapObj.tacticData) {
          applyExtractedTactic(JSON.stringify(mapObj.tacticData));
        } else if (parsed?.drawings || parsed?.d) {
          applyExtractedTactic(text);
        } else {
          setLoadError(isDe ? 'Keine Taktikdaten in der JSON-Datei.' : 'No tactic data in JSON.');
        }
      }
    } catch (err) {
      console.error('File load error:', err);
      setLoadError(isDe ? 'Fehler beim Lesen der Datei.' : 'Error reading file.');
    }
    e.target.value = '';
  };

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = shareUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy share link:', err);
    }
  };

  const handleSave = () => {
    if (!tacticName.trim()) return;
    onSaveAsMyTactic(tacticName.trim());
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  // Export current map & tactical state as JSON file
  const handleExportJson = () => {
    const mapWithTactics: MapData = {
      ...mapData,
      name: tacticName.trim() || mapData.name,
      tacticData: tacticState,
      updatedAt: Date.now(),
    };
    const exportPayload = {
      type: 'cs2freitag_single_map',
      version: 1,
      exportedAt: new Date().toISOString(),
      map: mapWithTactics,
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = (tacticName.trim() || mapData.name).toLowerCase().replace(/[^a-z0-9]+/g, '_');
    a.download = `CS2Freitag_${safeName}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export current map & tactical state as ZIP file with radar images
  const handleExportZip = async () => {
    try {
      setIsExportingZip(true);
      const zip = new JSZip();
      const mapWithTactics: MapData = {
        ...mapData,
        name: tacticName.trim() || mapData.name,
        tacticData: tacticState,
        updatedAt: Date.now(),
      };
      const exportPayload = {
        type: 'cs2freitag_single_map',
        version: 1,
        exportedAt: new Date().toISOString(),
        map: mapWithTactics,
      };
      zip.file('map.json', JSON.stringify(exportPayload, null, 2));

      const imgFolder = zip.folder('radar_images');
      if (imgFolder) {
        if (mapData.image) {
          try {
            if (mapData.image.startsWith('data:')) {
              const base64Data = mapData.image.split(',')[1];
              imgFolder.file(`${mapData.id}_upper.png`, base64Data, { base64: true });
            } else {
              const res = await fetch(mapData.image);
              const blob = await res.blob();
              imgFolder.file(`${mapData.id}_upper.png`, blob);
            }
          } catch (e) {
            console.warn('Could not bundle upper image:', e);
          }
        }
        if (mapData.lowerImage) {
          try {
            if (mapData.lowerImage.startsWith('data:')) {
              const base64Data = mapData.lowerImage.split(',')[1];
              imgFolder.file(`${mapData.id}_lower.png`, base64Data, { base64: true });
            } else {
              const res = await fetch(mapData.lowerImage);
              const blob = await res.blob();
              imgFolder.file(`${mapData.id}_lower.png`, blob);
            }
          } catch (e) {
            console.warn('Could not bundle lower image:', e);
          }
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (tacticName.trim() || mapData.name).toLowerCase().replace(/[^a-z0-9]+/g, '_');
      a.download = `CS2Freitag_${safeName}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('ZIP export error:', err);
      alert(isDe ? 'Fehler beim Erstellen des ZIP-Archivs.' : 'Error creating ZIP archive.');
    } finally {
      setIsExportingZip(false);
    }
  };

  return (
    <div
      data-no-map-click="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-zinc-900 border border-zinc-700/80 rounded-2xl p-5 sm:p-6 shadow-2xl text-zinc-100 relative my-auto max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hidden File Inputs */}
        <input
          type="file"
          ref={fileInputRef}
          accept=".json,.zip,application/json,application/zip"
          onChange={handleLoadFromFile}
          className="hidden"
        />
        <input
          type="file"
          ref={qrImageInputRef}
          accept="image/*"
          onChange={handleScanQrFromImage}
          className="hidden"
        />

        {/* Header with Navigation Tabs */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
          <div className="flex items-center gap-1.5 p-1 bg-zinc-950 rounded-xl border border-zinc-800">
            <button
              type="button"
              onClick={() => {
                stopCamera();
                setActiveTab('share');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'share'
                  ? 'bg-zinc-800 text-white shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Share2 className="w-3.5 h-3.5 text-sky-400" />
              <span>{isDe ? 'Teilen & Exportieren' : 'Share & Export'}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('load')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'load'
                  ? 'bg-zinc-800 text-white shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
              <span>{isDe ? 'Laden & Scannen' : 'Load & Scan'}</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback messages */}
        {loadError && (
          <div className="mb-3 p-2.5 rounded-xl bg-red-950/80 border border-red-700/80 text-xs text-red-200">
            {loadError}
          </div>
        )}
        {loadSuccess && (
          <div className="mb-3 p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-700/80 text-xs text-emerald-200 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{loadSuccess}</span>
          </div>
        )}

        {/* TAB 1: TEILEN & EXPORTIEREN */}
        {activeTab === 'share' ? (
          <div className="space-y-4">
            {/* 1. Link Section with Copy Button */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                {isDe ? '1. Taktik-Link (funktioniert auch komplett offline):' : '1. Tactic Link (works offline):'}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-zinc-300 select-all focus:outline-none focus:border-sky-400 truncate"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all shrink-0 cursor-pointer ${
                    copied
                      ? 'bg-emerald-500 text-zinc-950'
                      : 'bg-sky-500 hover:bg-sky-400 text-zinc-950'
                  }`}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? (isDe ? 'Kopiert!' : 'Copied!') : (isDe ? 'Kopieren' : 'Copy')}</span>
                </button>
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">
                {isDe
                  ? 'Enthält Karte, Callouts, Zeichnungen & Aufstellungen komprimiert im Link für Discord.'
                  : 'Contains map, callouts, drawings & utility compressed in URL.'}
              </p>
            </div>

            {/* 2. QR Code Section */}
            <div className="flex flex-col items-center justify-center p-3 bg-zinc-950/80 rounded-xl border border-zinc-800">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300 mb-2">
                <QrCode className="w-4 h-4 text-amber-400" />
                <span>{isDe ? '2. QR-Code für Handykamera' : '2. QR code for smartphone'}</span>
              </div>
              {qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt="Tactic QR Code"
                  className="w-36 h-36 sm:w-40 sm:h-40 rounded-lg bg-white p-2 shadow-md"
                />
              ) : (
                <div className="w-36 h-36 flex items-center justify-center bg-zinc-900 rounded-lg text-xs text-zinc-500">
                  {isDe ? 'Erstelle QR-Code...' : 'Generating QR code...'}
                </div>
              )}
              <span className="text-[10px] text-zinc-400 mt-1.5 text-center">
                {isDe ? 'Mit dem Handy scannen und direkt loslegen' : 'Scan with phone camera to load'}
              </span>
            </div>

            {/* 3. Save to "Eigene Taktiken" Section */}
            <div className="p-3.5 bg-zinc-950/80 rounded-xl border border-zinc-800">
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                {isDe ? '3. Als "Eigene Taktik" in der App speichern:' : '3. Save to "My Tactics" in app:'}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={tacticName}
                  onChange={(e) => setTacticName(e.target.value)}
                  placeholder={isDe ? 'Taktik Name (z.B. A-Rush Smoke)' : 'Tactic name'}
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!tacticName.trim() || savedSuccess}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all shrink-0 cursor-pointer ${
                    savedSuccess
                      ? 'bg-emerald-500 text-zinc-950'
                      : 'bg-amber-400 hover:bg-amber-300 text-zinc-950 disabled:opacity-50'
                  }`}
                >
                  {savedSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  <span>{savedSuccess ? (isDe ? 'Gespeichert!' : 'Saved!') : (isDe ? 'Speichern' : 'Save')}</span>
                </button>
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">
                {isDe
                  ? 'Wird dauerhaft im Ordner "Eigene Taktiken" auf der Startseite abgelegt.'
                  : 'Stored permanently in "My Tactics" folder.'}
              </p>
            </div>

            {/* 4. Export Tactic Sheet as PNG Image (for Discord/Teams) */}
            <div className="p-3.5 bg-zinc-950/80 rounded-xl border border-amber-500/40 space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-amber-400" />
                <span>{isDe ? '4. Taktik-Sheet als PNG-Bild exportieren:' : '4. Export Tactic Sheet as PNG Image:'}</span>
              </label>
              <button
                type="button"
                onClick={handleExportPngSheet}
                disabled={isExportingPng}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-black transition-all shadow-lg active:scale-[0.98] cursor-pointer disabled:opacity-50 uppercase tracking-wider"
              >
                <Download className="w-4 h-4" />
                <span>
                  {isExportingPng
                    ? isDe ? 'Erstelle PNG-Bild...' : 'Generating PNG...'
                    : isDe ? 'Taktik-Sheet als PNG herunterladen' : 'Download Tactic Sheet as PNG'}
                </span>
              </button>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                {isDe
                  ? 'Generiert ein hochauflösendes Bild deiner Karte inklusive aller Callouts, Aufstellungen und Zeichnungen – perfekt zum Teilen auf Discord.'
                  : 'Generates a high-res image of your map with all callouts, utilities & drawings – perfect for Discord.'}
              </p>
            </div>

            {/* 5. Export as JSON or ZIP Section */}
            <div className="p-3.5 bg-zinc-950/80 rounded-xl border border-zinc-800">
              <label className="block text-xs font-semibold text-zinc-300 mb-2">
                {isDe ? '5. Datei-Export (JSON oder ZIP-Archiv):' : '5. File Export (JSON or ZIP archive):'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleExportJson}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sky-300 hover:text-sky-200 border border-zinc-700 text-xs font-semibold transition-all cursor-pointer"
                  title={isDe ? 'Als schlanke JSON-Datei herunterladen' : 'Download as JSON file'}
                >
                  <FileCode className="w-4 h-4 text-sky-400" />
                  <span>{isDe ? 'JSON herunterladen' : 'Download JSON'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportZip}
                  disabled={isExportingZip}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-emerald-300 hover:text-emerald-200 border border-zinc-700 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
                  title={isDe ? 'Komplettes ZIP-Archiv inkl. Radar-Bildern' : 'Download ZIP archive with radar images'}
                >
                  <Archive className="w-4 h-4 text-emerald-400" />
                  <span>{isExportingZip ? (isDe ? 'Erstelle ZIP...' : 'Creating ZIP...') : (isDe ? 'ZIP herunterladen' : 'Download ZIP')}</span>
                </button>
              </div>
              <p className="text-[11px] text-zinc-400 mt-1.5">
                {isDe
                  ? 'JSON enthält die Kartendaten & Taktiken. ZIP enthält zusätzlich die Radar-Bilder.'
                  : 'JSON includes map data & tactics. ZIP additionally includes radar images.'}
              </p>
            </div>
          </div>
        ) : (
          /* TAB 2: LADEN & QR-CODE SCANNEN */
          <div className="space-y-4 animate-in fade-in duration-100">
            {/* Live Camera Scanner Trigger & Full-Screen Foreground Viewfinder */}
            <div className="p-3.5 bg-zinc-950/80 rounded-xl border border-zinc-800">
              <label className="block text-xs font-semibold text-zinc-300 mb-2">
                {isDe ? 'QR-Code mit Kamera scannen:' : 'Scan QR code with camera:'}
              </label>

              <div className="flex flex-col sm:flex-row items-center gap-2">
                <button
                  type="button"
                  onClick={startCamera}
                  className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>{isDe ? 'Kamera-Scanner starten (Vollbild)' : 'Start camera scanner (Fullscreen)'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => qrImageInputRef.current?.click()}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 text-xs font-semibold transition-all cursor-pointer"
                  title={isDe ? 'QR-Code Bild hochladen' : 'Upload QR code image'}
                >
                  <QrCode className="w-4 h-4 text-amber-400" />
                  <span>{isDe ? 'QR-Bild wählen' : 'Upload QR image'}</span>
                </button>
              </div>

              {cameraError && (
                <p className="text-[11px] text-amber-400/90 mt-2 leading-relaxed">
                  {cameraError}
                </p>
              )}
            </div>

            {/* FULLSCREEN CAMERA VIEWFINDER OVERLAY */}
            {isCameraActive && (
              <div className="fixed inset-0 z-[120] bg-black text-white flex flex-col justify-between items-center select-none overflow-hidden animate-in fade-in duration-200">
                {/* Background Video Stream */}
                <video
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Top Header Floating Bar */}
                <div className="relative z-20 w-full p-4 sm:p-6 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent">
                  <div className="flex items-center gap-2 bg-zinc-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-zinc-700/80">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-amber-400" />
                      {isDe ? 'QR-Code Scanner' : 'QR Code Scanner'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={stopCamera}
                    className="p-2.5 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-white border border-zinc-700/80 transition-colors cursor-pointer"
                    title={isDe ? 'Kamera Schließen' : 'Close camera'}
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Center Illuminated Viewfinder Target Frame */}
                <div className="relative z-10 my-auto flex flex-col items-center justify-center p-4">
                  <div className="w-64 h-64 sm:w-80 sm:h-80 rounded-2xl border-2 border-amber-400 relative shadow-[0_0_0_9999px_rgba(0,0,0,0.75)] flex items-center justify-center overflow-hidden pointer-events-none">
                    {/* Animated Laser Scan Beam */}
                    <div className="absolute left-1 right-1 h-1 bg-gradient-to-r from-amber-500/10 via-amber-400 to-amber-500/10 shadow-[0_0_15px_#f59e0b] animate-scan-line pointer-events-none" />

                    {/* Corner Bracket Accents */}
                    <div className="absolute -top-1 -left-1 w-7 h-7 border-t-4 border-l-4 border-amber-400 rounded-tl-xl" />
                    <div className="absolute -top-1 -right-1 w-7 h-7 border-t-4 border-r-4 border-amber-400 rounded-tr-xl" />
                    <div className="absolute -bottom-1 -left-1 w-7 h-7 border-b-4 border-l-4 border-amber-400 rounded-bl-xl" />
                    <div className="absolute -bottom-1 -right-1 w-7 h-7 border-b-4 border-r-4 border-amber-400 rounded-br-xl" />
                  </div>

                  <p className="text-xs font-semibold text-amber-300 mt-4 px-4 py-1.5 rounded-full bg-black/60 border border-amber-500/30 backdrop-blur-xs text-center shadow-md">
                    {isDe ? 'Taktik QR-Code im Rahmen ausrichten' : 'Align tactic QR code in frame'}
                  </p>
                </div>

                {/* Bottom Action Bar */}
                <div className="relative z-20 w-full p-6 pb-8 flex items-center justify-center gap-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                  <button
                    type="button"
                    onClick={() => qrImageInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-100 border border-zinc-700/80 text-xs font-bold transition-all backdrop-blur-md cursor-pointer"
                  >
                    <QrCode className="w-4 h-4 text-amber-400" />
                    <span>{isDe ? 'QR-Bild aus Galerie wählen' : 'Select QR image from gallery'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-4 py-2.5 rounded-xl bg-red-600/90 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                  >
                    <span>{isDe ? 'Kamera beenden' : 'Stop camera'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Code / Link Paste */}
            <div className="p-3.5 bg-zinc-950/80 rounded-xl border border-zinc-800">
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                {isDe ? 'Taktik-Code oder URL einfügen:' : 'Paste Tactic Code or URL:'}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={manualCodeInput}
                  onChange={(e) => setManualCodeInput(e.target.value)}
                  placeholder={isDe ? 'Link oder Code hier einfügen...' : 'Paste link or code here...'}
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-sky-400 font-mono truncate"
                />
                <button
                  type="button"
                  onClick={() => applyExtractedTactic(manualCodeInput)}
                  disabled={!manualCodeInput.trim()}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-sky-500 hover:bg-sky-400 text-zinc-950 disabled:opacity-50 transition-all shrink-0 cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>{isDe ? 'Laden' : 'Load'}</span>
                </button>
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">
                {isDe
                  ? 'Füge hier den empfangenen Discord-Link oder komprimierten Taktik-Code ein.'
                  : 'Paste a shared Discord link or compressed tactic code here.'}
              </p>
            </div>

            {/* Load from File (JSON or ZIP) */}
            <div className="p-3.5 bg-zinc-950/80 rounded-xl border border-zinc-800">
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                {isDe ? 'Aus Kartendatei laden (JSON oder ZIP):' : 'Load from map file (JSON or ZIP):'}
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs font-semibold transition-all cursor-pointer"
              >
                <Upload className="w-4 h-4 text-sky-400" />
                <span>{isDe ? 'JSON- oder ZIP-Datei auswählen' : 'Select JSON or ZIP file'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
