import React, { useRef, useState } from 'react';
import {
  Download,
  Upload,
  Settings,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileJson,
  FileSpreadsheet,
  Cloud,
  RefreshCw,
  ExternalLink,
  LogOut,
} from 'lucide-react';
import {
  AttendanceRecord,
  DriveFileItem,
  Member,
  SessionConfig,
} from '../types/attendance';
import {
  exportFullBackupJson,
  exportRecordsToCsv,
  getLocalDateString,
} from '../utils/storage';
import { ConfirmDialog } from './ConfirmDialog';
import { GoogleSignInButton } from './GoogleSignInButton';

interface ExportBackupViewProps {
  members: Member[];
  records: AttendanceRecord[];
  config: SessionConfig;
  driveConnected: boolean;
  driveUserEmail?: string | null;
  driveUserName?: string | null;
  isSigningInDrive: boolean;
  driveFiles: DriveFileItem[];
  isLoadingDriveFiles: boolean;
  isSyncingDrive: boolean;
  driveSyncMessage: { type: 'success' | 'error'; text: string } | null;
  onGoogleSignIn: () => void;
  onGoogleLogout: () => void;
  onRefreshDriveFiles: () => void;
  onSyncCsvToDrive: () => Promise<void>;
  onSyncJsonToDrive: () => Promise<void>;
  onDeleteDriveFile: (fileId: string) => Promise<void>;
  onUpdateConfig: (next: SessionConfig) => void;
  onImportBackup: (data: {
    members?: Member[];
    records?: AttendanceRecord[];
    config?: SessionConfig;
  }) => void;
  onClearAllRecords: () => void;
}

export const ExportBackupView: React.FC<ExportBackupViewProps> = ({
  members,
  records,
  config,
  driveConnected,
  driveUserEmail,
  driveUserName,
  isSigningInDrive,
  driveFiles,
  isLoadingDriveFiles,
  isSyncingDrive,
  driveSyncMessage,
  onGoogleSignIn,
  onGoogleLogout,
  onRefreshDriveFiles,
  onSyncCsvToDrive,
  onSyncJsonToDrive,
  onDeleteDriveFile,
  onUpdateConfig,
  onImportBackup,
  onClearAllRecords,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importStatus, setImportStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [pendingDriveAction, setPendingDriveAction] = useState<
    | { type: 'sync-csv' }
    | { type: 'sync-json' }
    | { type: 'delete-file'; file: DriveFileItem }
    | null
  >(null);

  const today = getLocalDateString();
  const todayCount = records.filter((r) => r.date === today).length;

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || (!Array.isArray(parsed.records) && !Array.isArray(parsed.members))) {
        throw new Error('Format file backup tidak valid.');
      }
      onImportBackup({
        members: Array.isArray(parsed.members) ? parsed.members : undefined,
        records: Array.isArray(parsed.records) ? parsed.records : undefined,
        config: parsed.config ? { ...config, ...parsed.config } : undefined,
      });
      setImportStatus({
        type: 'success',
        message: `Berhasil memulihkan ${parsed.records?.length ?? 0} catatan absensi dan ${
          parsed.members?.length ?? 0
        } anggota.`,
      });
    } catch {
      setImportStatus({
        type: 'error',
        message: 'File gagal dibaca. Pastikan Anda memilih file backup .json dari HadirScan.',
      });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleConfirmDriveAction = async () => {
    if (!pendingDriveAction) return;
    const action = pendingDriveAction;
    setPendingDriveAction(null);

    if (action.type === 'sync-csv') {
      await onSyncCsvToDrive();
    } else if (action.type === 'sync-json') {
      await onSyncJsonToDrive();
    } else if (action.type === 'delete-file') {
      await onDeleteDriveFile(action.file.id);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
      {/* Left: Google Drive & Local Export */}
      <div className="lg:col-span-7 space-y-5">
        {/* Google Drive Sync Panel */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  driveConnected ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                }`}
              >
                <Cloud className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-slate-900">Penyimpanan Google Drive</h1>
                <p className="text-xs text-slate-500">
                  {driveConnected
                    ? `Terhubung sebagai ${driveUserName ?? driveUserEmail ?? 'Pengguna Google'}`
                    : 'Hubungkan akun Google untuk menyimpan foto wajah dan rekap CSV ke Drive'}
                </p>
              </div>
            </div>

            {driveConnected ? (
              <button
                type="button"
                onClick={onGoogleLogout}
                className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Putuskan Akun</span>
              </button>
            ) : (
              <GoogleSignInButton onClick={onGoogleSignIn} loading={isSigningInDrive} />
            )}
          </div>

          {driveConnected && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={isSyncingDrive || todayCount === 0}
                  onClick={() => setPendingDriveAction({ type: 'sync-csv' })}
                  className="flex min-h-[56px] items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left hover:border-blue-400 hover:bg-blue-50/40 disabled:opacity-45 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      Simpan CSV ke Drive
                    </p>
                    <p className="text-xs text-slate-500 font-mono tabular-nums">
                      rekap-absensi-{today}.csv
                    </p>
                  </div>
                  <FileSpreadsheet className="h-5 w-5 shrink-0 text-blue-600" />
                </button>

                <button
                  type="button"
                  disabled={isSyncingDrive}
                  onClick={() => setPendingDriveAction({ type: 'sync-json' })}
                  className="flex min-h-[56px] items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left hover:border-blue-400 hover:bg-blue-50/40 disabled:opacity-45 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      Simpan Backup ke Drive
                    </p>
                    <p className="text-xs text-slate-500 font-mono">hadirscan-backup.json</p>
                  </div>
                  <FileJson className="h-5 w-5 shrink-0 text-emerald-600" />
                </button>
              </div>

              {driveSyncMessage && (
                <div
                  className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs ${
                    driveSyncMessage.type === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                      : 'border-red-200 bg-red-50 text-red-900'
                  }`}
                >
                  {driveSyncMessage.type === 'success' ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                  )}
                  <span>{driveSyncMessage.text}</span>
                </div>
              )}

              {/* Files in Drive */}
              <div className="pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      File di Folder &ldquo;HadirScan Absensi&rdquo;
                    </h2>
                    <p className="text-xs text-slate-500">
                      Foto wajah dan file rekap yang tersimpan di Google Drive Anda
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onRefreshDriveFiles}
                    disabled={isLoadingDriveFiles}
                    className="flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${isLoadingDriveFiles ? 'animate-spin' : ''}`}
                    />
                    <span>Muat Ulang</span>
                  </button>
                </div>

                {driveFiles.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-xs text-slate-500">
                    {isLoadingDriveFiles
                      ? 'Memuat daftar file dari Google Drive...'
                      : 'Belum ada file di folder HadirScan Absensi.'}
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                    {driveFiles.map((file) => (
                      <li
                        key={file.id}
                        className="flex items-center justify-between gap-3 py-2.5 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">{file.name}</p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            {file.modifiedTime
                              ? new Date(file.modifiedTime).toLocaleString('id-ID')
                              : file.mimeType}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {file.webViewLink && (
                            <a
                              href={file.webViewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
                            >
                              <span>Buka</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => setPendingDriveAction({ type: 'delete-file', file })}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                            aria-label={`Hapus ${file.name} dari Google Drive`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Local Export & Backup */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="text-base font-semibold text-slate-900">Unduh File Lokal (CSV / JSON)</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Simpan salinan file langsung ke perangkat Anda untuk arsip offline atau dibuka di Excel.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={todayCount === 0}
              onClick={() =>
                exportRecordsToCsv(
                  records.filter((r) => r.date === today),
                  `absensi-harian-${today}.csv`
                )
              }
              className="flex min-h-[54px] items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left hover:border-blue-400 hover:bg-blue-50/40 disabled:opacity-45 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">Unduh CSV Hari Ini</p>
                <p className="text-xs text-slate-500 font-mono tabular-nums">
                  {todayCount} baris · {today}
                </p>
              </div>
              <Download className="h-4 w-4 shrink-0 text-blue-600" />
            </button>

            <button
              type="button"
              disabled={records.length === 0}
              onClick={() => exportRecordsToCsv(records, `semua-absensi-${today}.csv`)}
              className="flex min-h-[54px] items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left hover:border-blue-400 hover:bg-blue-50/40 disabled:opacity-45 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">Unduh Semua CSV</p>
                <p className="text-xs text-slate-500 font-mono tabular-nums">
                  {records.length} total baris
                </p>
              </div>
              <Download className="h-4 w-4 shrink-0 text-emerald-600" />
            </button>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => exportFullBackupJson(members, records, config)}
              className="flex min-h-[44px] items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <FileJson className="h-4 w-4" />
              <span>Unduh Backup JSON</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportFile}
              className="hidden"
              id="backup-json-input"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              <Upload className="h-4 w-4" />
              <span>Pulihkan dari JSON</span>
            </button>
          </div>

          {importStatus && (
            <div
              className={`mt-4 flex items-start gap-2.5 rounded-xl border p-3 text-xs ${
                importStatus.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-red-200 bg-red-50 text-red-900'
              }`}
            >
              {importStatus.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              )}
              <span>{importStatus.message}</span>
            </div>
          )}
        </div>
      </div>

      {/* Right: Session Settings & Danger Zone */}
      <div className="lg:col-span-5 space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Settings className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-900">Pengaturan Sesi & Foto</h2>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="session-name-input"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Shift / Sesi Aktif
              </label>
              <div className="mb-2 flex items-center gap-1.5">
                {(['Shift 1', 'Shift 2', 'Shift 3'] as const).map((shift) => (
                  <button
                    key={shift}
                    type="button"
                    onClick={() => onUpdateConfig({ ...config, sessionName: shift })}
                    className={`min-h-[36px] flex-1 rounded-lg border text-xs font-semibold transition-colors ${
                      config.sessionName === shift
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {shift}
                  </button>
                ))}
              </div>
              <input
                id="session-name-input"
                type="text"
                value={config.sessionName}
                onChange={(e) => onUpdateConfig({ ...config, sessionName: e.target.value })}
                placeholder="Atau ketik nama shift/sesi khusus"
                className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>

            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <label className="flex items-center justify-between gap-3 py-1 cursor-pointer">
                <span className="text-xs font-medium text-slate-700">
                  Ambil foto wajah otomatis saat scan QR
                </span>
                <input
                  type="checkbox"
                  checked={config.autoCapturePhoto}
                  onChange={(e) =>
                    onUpdateConfig({ ...config, autoCapturePhoto: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                />
              </label>

              <label className="flex items-center justify-between gap-3 py-1 cursor-pointer">
                <span className="text-xs font-medium text-slate-700">
                  Langsung unggah foto wajah ke Google Drive
                </span>
                <input
                  type="checkbox"
                  checked={config.autoUploadPhotoToDrive}
                  onChange={(e) =>
                    onUpdateConfig({ ...config, autoUploadPhotoToDrive: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                />
              </label>

              <label className="flex items-center justify-between gap-3 py-1 cursor-pointer">
                <span className="text-xs font-medium text-slate-700">Suara bip saat scan</span>
                <input
                  type="checkbox"
                  checked={config.soundEnabled}
                  onChange={(e) => onUpdateConfig({ ...config, soundEnabled: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                />
              </label>

              <label className="flex items-center justify-between gap-3 py-1 cursor-pointer">
                <span className="text-xs font-medium text-slate-700">Getar HP saat scan</span>
                <input
                  type="checkbox"
                  checked={config.vibrationEnabled}
                  onChange={(e) =>
                    onUpdateConfig({ ...config, vibrationEnabled: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Bersihkan Riwayat Lokal</h2>
          <p className="mt-1 text-xs text-slate-500">
            Menghapus catatan absensi dari browser perangkat ini (file yang sudah tersimpan di
            Google Drive tidak ikut terhapus).
          </p>
          <button
            type="button"
            disabled={records.length === 0}
            onClick={() => setConfirmClearOpen(true)}
            className="mt-4 flex min-h-[44px] items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-45 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            <span>Hapus Riwayat Lokal ({records.length})</span>
          </button>
        </div>
      </div>

      {/* Confirm Local Clear */}
      <ConfirmDialog
        open={confirmClearOpen}
        title="Hapus Semua Riwayat Lokal?"
        description={`Sebanyak ${records.length} catatan kehadiran akan dihapus dari browser perangkat ini.`}
        confirmLabel="Hapus Semua"
        destructive
        onCancel={() => setConfirmClearOpen(false)}
        onConfirm={() => {
          onClearAllRecords();
          setConfirmClearOpen(false);
        }}
      />

      {/* Confirm Google Drive Mutations */}
      <ConfirmDialog
        open={pendingDriveAction !== null}
        title={
          pendingDriveAction?.type === 'delete-file'
            ? 'Hapus File dari Google Drive?'
            : 'Perbarui Data di Google Drive?'
        }
        description={
          pendingDriveAction?.type === 'sync-csv'
            ? `Aplikasi akan membuat atau memperbarui file "rekap-absensi-${today}.csv" (${todayCount} baris) di dalam folder "HadirScan Absensi" pada Google Drive Anda.`
            : pendingDriveAction?.type === 'sync-json'
            ? `Aplikasi akan membuat atau memperbarui file "hadirscan-backup.json" (${records.length} catatan & ${members.length} anggota) di dalam folder "HadirScan Absensi" pada Google Drive Anda.`
            : pendingDriveAction?.type === 'delete-file'
            ? `File "${pendingDriveAction.file.name}" akan dihapus permanen dari Google Drive Anda.`
            : ''
        }
        confirmLabel={
          pendingDriveAction?.type === 'delete-file' ? 'Hapus dari Drive' : 'Simpan ke Drive'
        }
        destructive={pendingDriveAction?.type === 'delete-file'}
        onCancel={() => setPendingDriveAction(null)}
        onConfirm={handleConfirmDriveAction}
      />
    </div>
  );
};
