import React, { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import {
  Camera,
  CameraOff,
  CheckCircle2,
  Flashlight,
  FlashlightOff,
  Keyboard,
  QrCode,
  RefreshCw,
  AlertCircle,
  Clock,
  ArrowRight,
  Users,
  Cloud,
  UserCheck,
  User,
} from 'lucide-react';
import {
  AttendanceRecord,
  Member,
  ScanFeedback,
  ScanMethod,
  ScanMode,
  SessionConfig,
} from '../types/attendance';
import { GoogleSignInButton } from './GoogleSignInButton';

interface QrScannerViewProps {
  isAdmin: boolean;
  activeMember: Member | null;
  members: Member[];
  todayRecords: AttendanceRecord[];
  personalRecords: AttendanceRecord[];
  config: SessionConfig;
  scanMode: ScanMode;
  driveConnected: boolean;
  driveUserEmail?: string | null;
  isSigningInDrive: boolean;
  onGoogleSignIn: () => void;
  onChangeScanMode: (mode: ScanMode) => void;
  onChangeSessionName: (sessionName: string) => void;
  onScanSubmit: (
    rawCode: string,
    method: ScanMethod,
    photoDataUrl?: string | null
  ) => ScanFeedback;
  lastFeedback: ScanFeedback | null;
  onOpenMembers: () => void;
  onOpenRekap: () => void;
}

export const QrScannerView: React.FC<QrScannerViewProps> = ({
  isAdmin,
  activeMember,
  members,
  todayRecords,
  personalRecords,
  config,
  scanMode,
  driveConnected,
  driveUserEmail,
  isSigningInDrive,
  onGoogleSignIn,
  onChangeScanMode,
  onChangeSessionName,
  onScanSubmit,
  lastFeedback,
  onOpenMembers,
  onOpenRekap,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scanCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const photoCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastScannedRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });
  const onScanSubmitRef = useRef(onScanSubmit);
  const autoCaptureRef = useRef(config.autoCapturePhoto);
  const facingModeRef = useRef<'environment' | 'user'>('user');

  useEffect(() => {
    onScanSubmitRef.current = onScanSubmit;
  }, [onScanSubmit]);

  useEffect(() => {
    autoCaptureRef.current = config.autoCapturePhoto;
  }, [config.autoCapturePhoto]);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('user');
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [selectedQuickMemberId, setSelectedQuickMemberId] = useState<string>(
    members[0]?.id ?? ''
  );
  const [scanPulse, setScanPulse] = useState(false);

  useEffect(() => {
    facingModeRef.current = facingMode;
  }, [facingMode]);

  useEffect(() => {
    if (!selectedQuickMemberId && members.length > 0) {
      setSelectedQuickMemberId(members[0].id);
    }
  }, [members, selectedQuickMemberId]);

  const capturePhotoFromVideo = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0) return null;

    if (!photoCanvasRef.current) {
      photoCanvasRef.current = document.createElement('canvas');
    }
    const canvas = photoCanvasRef.current;
    const maxWidth = 480;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    canvas.width = Math.floor(video.videoWidth * scale);
    canvas.height = Math.floor(video.videoHeight * scale);

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.save();
    if (facingModeRef.current === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    return canvas.toDataURL('image/jpeg', 0.82);
  }, []);

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setTorchOn(false);
    setTorchSupported(false);
  }, []);

  const startCamera = useCallback(
    async (targetFacing: 'environment' | 'user') => {
      stopCamera();
      setCameraError(null);
      setCameraStarting(true);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraStarting(false);
        setCameraError(
          'Browser atau perangkat ini tidak mendukung akses kamera langsung. Gunakan input ID manual di bawah.'
        );
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: targetFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        streamRef.current = stream;

        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack && typeof videoTrack.getCapabilities === 'function') {
          const capabilities = videoTrack.getCapabilities() as MediaTrackCapabilities & {
            torch?: boolean;
          };
          setTorchSupported(Boolean(capabilities.torch));
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setCameraActive(true);
        setCameraStarting(false);

        let lastFrameCheck = 0;
        const scanLoop = (timestamp: number) => {
          if (!streamRef.current || !videoRef.current) return;

          if (timestamp - lastFrameCheck >= 110) {
            lastFrameCheck = timestamp;
            const video = videoRef.current;

            if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
              if (!scanCanvasRef.current) {
                scanCanvasRef.current = document.createElement('canvas');
              }
              const canvas = scanCanvasRef.current;
              const scale = Math.min(1, 640 / video.videoWidth);
              canvas.width = Math.floor(video.videoWidth * scale);
              canvas.height = Math.floor(video.videoHeight * scale);

              const ctx = canvas.getContext('2d', { willReadFrequently: true });
              if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
                  inversionAttempts: 'dontInvert',
                });

                if (decoded && decoded.data) {
                  const now = Date.now();
                  const normalized = decoded.data.trim();
                  if (
                    normalized &&
                    (lastScannedRef.current.code !== normalized ||
                      now - lastScannedRef.current.time > 2500)
                  ) {
                    lastScannedRef.current = { code: normalized, time: now };
                    const snapshot = autoCaptureRef.current ? capturePhotoFromVideo() : null;
                    onScanSubmitRef.current(normalized, 'QR Kamera', snapshot);
                    setScanPulse(true);
                    setTimeout(() => setScanPulse(false), 350);
                  }
                }
              }
            }
          }

          rafRef.current = requestAnimationFrame(scanLoop);
        };

        rafRef.current = requestAnimationFrame(scanLoop);
      } catch (err) {
        setCameraStarting(false);
        const errorName = err instanceof Error ? err.name : '';
        if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
          setCameraError(
            'Izin kamera ditolak. Izinkan akses kamera di pengaturan browser Anda, atau gunakan input ID manual.'
          );
        } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
          setCameraError(
            'Perangkat kamera tidak ditemukan. Gunakan input ID manual di bawah.'
          );
        } else {
          setCameraError(
            'Kamera sedang digunakan aplikasi lain atau gagal dibuka. Silakan coba lagi atau input ID manual.'
          );
        }
      }
    },
    [capturePhotoFromVideo, stopCamera]
  );

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const handleSwitchCamera = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    if (cameraActive) {
      startCamera(next);
    }
  };

  const handleToggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextTorch = !torchOn;
      await track.applyConstraints({
        advanced: [{ torch: nextTorch } as MediaTrackConstraintSet],
      });
      setTorchOn(nextTorch);
    } catch {
      setTorchSupported(false);
    }
  };

  const handleDirectFaceCapture = () => {
    if (!selectedQuickMemberId) return;
    const snapshot = cameraActive ? capturePhotoFromVideo() : null;
    onScanSubmit(selectedQuickMemberId, cameraActive ? 'Foto Wajah' : 'Input Manual', snapshot);
    if (cameraActive) {
      setScanPulse(true);
      setTimeout(() => setScanPulse(false), 350);
    }
  };

  const handleManualFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    const snapshot = cameraActive && config.autoCapturePhoto ? capturePhotoFromVideo() : null;
    onScanSubmit(manualCode.trim(), 'Input Manual', snapshot);
    setManualCode('');
  };

  const checkInCount = todayRecords.filter((r) => Boolean(r.checkInTime)).length;
  const checkOutCount = todayRecords.filter((r) => r.checkOutTime !== null).length;
  const pendingOutCount = Math.max(0, checkInCount - checkOutCount);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
      {/* Left Column: Camera Viewfinder & Capture */}
      <div className="lg:col-span-7 space-y-5">
        {/* Google Drive Connection Bar (Full control for Admin; clean status indicator for User) */}
        {isAdmin ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  driveConnected ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Cloud className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  {driveConnected ? 'Google Drive Terhubung' : 'Hubungkan Google Drive'}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {driveConnected
                    ? `Foto wajah & data tersimpan otomatis ke ${driveUserEmail ?? 'Google Drive Anda'}`
                    : 'Masuk dengan Google agar foto wajah hasil scan langsung tersimpan ke Google Drive'}
                </p>
              </div>
            </div>

            {!driveConnected && (
              <GoogleSignInButton onClick={onGoogleSignIn} loading={isSigningInDrive} />
            )}
          </div>
        ) : (
          driveConnected && (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex items-center gap-2.5 text-xs text-slate-600">
              <Cloud className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Foto wajah & kehadiran otomatis tersimpan ke Google Drive</span>
            </div>
          )
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          {/* Top Controls: Mode Segmented Switch & 3-Shift Selector */}
          <div className="flex flex-col gap-3 pb-4 border-b border-slate-100">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-lg font-semibold text-slate-900">Scanner & Foto Wajah</h1>
                <p className="mt-0.5 text-xs text-slate-500">
                  {config.sessionName}
                  {config.autoCapturePhoto ? ' · Auto foto wajah aktif' : ''}
                </p>
              </div>

              <div
                className="inline-flex items-center rounded-xl bg-slate-100 p-1 self-start sm:self-auto"
                role="group"
                aria-label="Mode absensi"
              >
                <button
                  type="button"
                  onClick={() => onChangeScanMode('checkin')}
                  className={`min-h-[40px] rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    scanMode === 'checkin'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Scan Masuk
                </button>
                <button
                  type="button"
                  onClick={() => onChangeScanMode('checkout')}
                  className={`min-h-[40px] rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    scanMode === 'checkout'
                      ? 'bg-white text-indigo-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Scan Pulang
                </button>
              </div>
            </div>

            {/* 3-Shift Quick Selector */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Pilih Shift:</span>
              <div className="inline-flex items-center rounded-xl bg-slate-100 p-1">
                {(['Shift 1', 'Shift 2', 'Shift 3'] as const).map((shift) => (
                  <button
                    key={shift}
                    type="button"
                    onClick={() => onChangeSessionName(shift)}
                    className={`min-h-[34px] rounded-lg px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      config.sessionName === shift
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {shift}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Camera Viewport */}
          <div className="mt-4 relative overflow-hidden rounded-2xl bg-slate-950 aspect-[4/3] sm:aspect-[16/10] flex items-center justify-center">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className={`h-full w-full object-cover ${
                facingMode === 'user' ? 'scale-x-[-1]' : ''
              } ${cameraActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            />

            {cameraActive && (
              <>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div
                    className={`relative h-52 w-52 sm:h-60 sm:w-60 transition-transform duration-150 ${
                      scanPulse ? 'scale-105' : 'scale-100'
                    }`}
                  >
                    <span
                      className={`absolute left-0 top-0 h-8 w-8 rounded-tl-xl border-l-4 border-t-4 transition-colors ${
                        scanPulse ? 'border-emerald-400' : 'border-white'
                      }`}
                    />
                    <span
                      className={`absolute right-0 top-0 h-8 w-8 rounded-tr-xl border-r-4 border-t-4 transition-colors ${
                        scanPulse ? 'border-emerald-400' : 'border-white'
                      }`}
                    />
                    <span
                      className={`absolute bottom-0 left-0 h-8 w-8 rounded-bl-xl border-b-4 border-l-4 transition-colors ${
                        scanPulse ? 'border-emerald-400' : 'border-white'
                      }`}
                    />
                    <span
                      className={`absolute bottom-0 right-0 h-8 w-8 rounded-br-xl border-b-4 border-r-4 transition-colors ${
                        scanPulse ? 'border-emerald-400' : 'border-white'
                      }`}
                    />
                  </div>
                </div>

                <div className="pointer-events-none absolute top-3 left-3 right-3 flex items-center justify-between">
                  <span className="rounded-lg bg-slate-950/70 backdrop-blur-sm px-2.5 py-1 text-xs font-medium text-white">
                    {scanMode === 'checkin' ? 'Mode: Masuk' : 'Mode: Pulang'} ·{' '}
                    {facingMode === 'user' ? 'Kamera Depan (Wajah + QR)' : 'Kamera Belakang (QR)'}
                  </span>
                </div>

                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSwitchCamera}
                      className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-slate-900/80 backdrop-blur-sm px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                    >
                      <RefreshCw className="h-4 w-4" />
                      <span>{facingMode === 'user' ? 'Pakai Belakang' : 'Pakai Depan'}</span>
                    </button>
                    {torchSupported && (
                      <button
                        type="button"
                        onClick={handleToggleTorch}
                        className={`flex min-h-[44px] items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium backdrop-blur-sm transition-colors whitespace-nowrap shrink-0 ${
                          torchOn
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-900/80 text-white hover:bg-slate-800'
                        }`}
                      >
                        {torchOn ? (
                          <Flashlight className="h-4 w-4" />
                        ) : (
                          <FlashlightOff className="h-4 w-4" />
                        )}
                        <span>Lampu</span>
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={stopCamera}
                    className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-red-600/90 backdrop-blur-sm px-3.5 py-2 text-xs font-medium text-white hover:bg-red-700 transition-colors whitespace-nowrap shrink-0"
                  >
                    <CameraOff className="h-4 w-4" />
                    <span>Matikan</span>
                  </button>
                </div>
              </>
            )}

            {!cameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-slate-200 border border-slate-800">
                  <QrCode className="h-7 w-7" />
                </div>
                <h2 className="mt-4 text-base font-semibold text-white">
                  {cameraStarting ? 'Membuka Kamera...' : 'Kamera Scanner & Foto Wajah Siap'}
                </h2>
                <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-slate-400">
                  {cameraError
                    ? cameraError
                    : 'Scan kartu QR atau foto wajah langsung menggunakan kamera HP. Setelah absen, Anda dapat langsung melihat data kehadiran sendiri.'}
                </p>

                <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    disabled={cameraStarting}
                    onClick={() => startCamera(facingMode)}
                    className="flex min-h-[48px] items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Camera className="h-4 w-4" />
                    <span>{cameraStarting ? 'Menghubungkan...' : 'Aktifkan Kamera HP'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Direct Face Photo Attendance Bar */}
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <label
                htmlFor="quick-face-member"
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-800"
              >
                <UserCheck className="h-4 w-4 text-blue-600" />
                <span>Absen Foto Wajah Langsung (Tanpa Kartu QR)</span>
              </label>
              <span className="text-[11px] text-slate-500">
                {cameraActive ? 'Kamera siap memotret' : 'Aktifkan kamera untuk ambil foto'}
              </span>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                id="quick-face-member"
                value={selectedQuickMemberId}
                onChange={(e) => setSelectedQuickMemberId(e.target.value)}
                className="min-h-[44px] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                {members.length === 0 ? (
                  <option value="">Belum ada user terdaftar</option>
                ) : (
                  members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.id} · {m.division})
                    </option>
                  ))
                )}
              </select>

              <button
                type="button"
                disabled={!selectedQuickMemberId}
                onClick={handleDirectFaceCapture}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-45 transition-colors whitespace-nowrap shrink-0"
              >
                <Camera className="h-4 w-4" />
                <span>{cameraActive ? 'Foto Wajah & Catat' : 'Catat Kehadiran'}</span>
              </button>
            </div>
          </div>

          {/* Manual ID Entry */}
          <form onSubmit={handleManualFormSubmit} className="mt-4 pt-4 border-t border-slate-100">
            <label
              htmlFor="manual-id-input"
              className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-2"
            >
              <Keyboard className="h-3.5 w-3.5 text-slate-400" />
              <span>Input ID Anggota Manual</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                id="manual-id-input"
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Ketik ID anggota, contoh: ANG-001"
                className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
              <button
                type="submit"
                className="min-h-[44px] rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                Catat
              </button>
            </div>
          </form>
        </div>

        {/* Admin-only Quick Tap Strip */}
        {isAdmin && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Tap Cepat Anggota (Admin)</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Klik nama untuk mencatat absensi cepat
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenMembers}
                className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap shrink-0"
              >
                <span>Manajemen User</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {members.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-4 text-center">
                <p className="text-xs text-slate-500">Belum ada user terdaftar.</p>
                <button
                  type="button"
                  onClick={onOpenMembers}
                  className="mt-2 text-xs font-semibold text-blue-600 hover:underline"
                >
                  Tambah User Pertama
                </button>
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {members.slice(0, 6).map((member) => {
                  const record = todayRecords.find((r) => r.memberId === member.id);
                  const isDone =
                    scanMode === 'checkin' ? Boolean(record) : Boolean(record?.checkOutTime);
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => {
                        const snapshot =
                          cameraActive && config.autoCapturePhoto
                            ? capturePhotoFromVideo()
                            : null;
                        onScanSubmit(member.id, snapshot ? 'Foto Wajah' : 'Input Manual', snapshot);
                      }}
                      className={`flex min-h-[48px] flex-col items-start justify-center rounded-xl border px-3 py-2 text-left transition-colors ${
                        isDone
                          ? 'border-emerald-200 bg-emerald-50/60 text-slate-900'
                          : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/30 text-slate-900'
                      }`}
                    >
                      <span className="w-full truncate text-xs font-semibold">{member.name}</span>
                      <span className="mt-0.5 text-[11px] font-mono tabular-nums text-slate-500">
                        {member.id}
                        {record ? (record.checkOutTime ? ' · Pulang' : ` · ${record.status}`) : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Column: Role-Scoped Feedback & Activity */}
      <div className="lg:col-span-5 space-y-5">
        {lastFeedback && (
          <div
            className={`rounded-2xl border p-4 sm:p-5 transition-all ${
              lastFeedback.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                : lastFeedback.type === 'warning'
                ? 'border-amber-200 bg-amber-50 text-amber-950'
                : 'border-red-200 bg-red-50 text-red-950'
            }`}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              {lastFeedback.photoDataUrl ? (
                <img
                  src={lastFeedback.photoDataUrl}
                  alt="Foto wajah tersimpan"
                  className="h-14 w-14 shrink-0 rounded-xl object-cover border border-black/10"
                />
              ) : (
                <>
                  {lastFeedback.type === 'success' && (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
                  )}
                  {lastFeedback.type === 'warning' && (
                    <Clock className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                  )}
                  {lastFeedback.type === 'error' && (
                    <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
                  )}
                </>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{lastFeedback.title}</p>
                  <span className="font-mono text-xs tabular-nums opacity-75">
                    {lastFeedback.timestamp}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed opacity-90">{lastFeedback.detail}</p>
              </div>
            </div>
          </div>
        )}

        {isAdmin ? (
          <>
            {/* Admin Summary */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-900">Ringkasan Hari Ini (Admin)</h2>
                <span className="text-xs text-slate-500 tabular-nums">
                  {todayRecords.length} / {members.length} user
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 divide-x divide-slate-100">
                <div className="pr-3">
                  <p className="text-xs text-slate-500">Absen Jam Masuk</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-600 tabular-nums">
                    {checkInCount}
                  </p>
                </div>
                <div className="px-3">
                  <p className="text-xs text-slate-500">Absen Jam Pulang</p>
                  <p className="mt-1 text-2xl font-bold text-indigo-600 tabular-nums">
                    {checkOutCount}
                  </p>
                </div>
                <div className="pl-3">
                  <p className="text-xs text-slate-500">Belum Pulang</p>
                  <p className="mt-1 text-2xl font-bold text-slate-700 tabular-nums">
                    {pendingOutCount}
                  </p>
                </div>
              </div>
            </div>

            {/* Admin Recent Feed (All Users) */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-900">Log Scan & Foto Terbaru</h2>
                <button
                  type="button"
                  onClick={onOpenRekap}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap shrink-0"
                >
                  Semua Rekap
                </button>
              </div>

              {todayRecords.length === 0 ? (
                <div className="py-10 text-center">
                  <Users className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2.5 text-sm font-medium text-slate-700">
                    Belum ada absensi hari ini
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Aktifkan kamera HP untuk memindai QR atau mengambil foto wajah anggota.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 mt-1">
                  {todayRecords.slice(0, 7).map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {item.photoDataUrl ? (
                          <img
                            src={item.photoDataUrl}
                            alt={`Foto ${item.memberName}`}
                            className="h-10 w-10 shrink-0 rounded-lg object-cover border border-slate-200"
                          />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-500">
                            {item.memberName.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {item.memberName}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            <span className="font-mono">{item.memberId}</span> · {item.method}
                            {item.drivePhotoStatus === 'synced' && ' · Drive OK'}
                            {item.drivePhotoStatus === 'uploading' && ' · Mengunggah...'}
                            {item.drivePhotoStatus === 'error' && ' · Gagal unggah Drive'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p
                          className={`text-xs font-semibold ${
                            item.checkOutTime
                              ? 'text-indigo-600'
                              : item.status === 'Hadir'
                              ? 'text-emerald-600'
                              : 'text-amber-600'
                          }`}
                        >
                          {item.checkOutTime ? 'Pulang' : 'Masuk'}
                        </p>
                        <p className="mt-0.5 font-mono text-xs tabular-nums text-slate-500">
                          {item.checkOutTime ?? item.checkInTime}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : (
          /* User Mode: Shows ONLY the active user's own data! */
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  {activeMember ? `Data Saya — ${activeMember.name}` : 'Data Kehadiran Saya'}
                </h2>
                <p className="text-xs text-slate-500">
                  {activeMember
                    ? `${activeMember.id} · ${activeMember.division}`
                    : 'Scan QR atau foto wajah untuk melihat riwayat milik Anda'}
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenRekap}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap shrink-0"
              >
                Buka Data Saya
              </button>
            </div>

            {!activeMember ? (
              <div className="py-10 text-center">
                <User className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2.5 text-sm font-medium text-slate-700">
                  Belum ada data user aktif
                </p>
                <p className="mt-1 text-xs text-slate-500 max-w-xs mx-auto">
                  Setelah melakukan scan QR atau foto wajah, riwayat absensi Anda sendiri akan
                  langsung tampil di sini.
                </p>
                <button
                  type="button"
                  onClick={onOpenRekap}
                  className="mt-4 min-h-[40px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Pilih / Cek Data Saya
                </button>
              </div>
            ) : personalRecords.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm font-medium text-slate-700">Belum ada riwayat absen</p>
                <p className="mt-1 text-xs text-slate-500">
                  Lakukan scan masuk untuk mencatat kehadiran Anda hari ini.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 mt-1">
                {personalRecords.slice(0, 5).map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {item.photoDataUrl ? (
                        <img
                          src={item.photoDataUrl}
                          alt={`Foto ${item.memberName}`}
                          className="h-10 w-10 shrink-0 rounded-lg object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-500">
                          {item.memberName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{item.date}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {item.method}
                          {item.drivePhotoStatus === 'synced' && ' · Drive OK'}
                          {item.drivePhotoStatus === 'uploading' && ' · Mengunggah...'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className={`text-xs font-semibold ${
                          item.checkOutTime
                            ? 'text-indigo-600'
                            : item.status === 'Hadir'
                            ? 'text-emerald-600'
                            : 'text-amber-600'
                        }`}
                      >
                        {item.checkOutTime ? 'Pulang' : 'Masuk'}
                      </p>
                      <p className="mt-0.5 font-mono text-xs tabular-nums text-slate-500">
                        {item.checkOutTime ?? item.checkInTime}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
