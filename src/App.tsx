import { useCallback, useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { QrCode, ClipboardList, Users, Cloud, Lock, UserCheck } from 'lucide-react';
import {
  ActiveTab,
  AttendanceRecord,
  AttendanceStatus,
  DriveFileItem,
  Member,
  ScanFeedback,
  ScanMethod,
  ScanMode,
  SessionConfig,
  UserAccessRole,
} from './types/attendance';
import {
  buildCsvString,
  exportRecordsToCsv,
  getLocalDateString,
  getLocalTimeString,
  loadConfig,
  loadMembers,
  loadRecords,
  saveConfig,
  saveMembers,
  saveRecords,
} from './utils/storage';
import { playScanTone, triggerHaptic } from './utils/audio';
import { hashPassword, verifyAdminPassword } from './utils/authCrypto';
import { getAccessToken, googleSignIn, initAuth, logout } from './services/googleAuth';
import {
  createOrUpdateTextFileInDrive,
  deleteDriveFile,
  listAppDriveFiles,
  uploadFacePhotoToDrive,
} from './services/googleDrive';
import { QrScannerView } from './components/QrScannerView';
import { AttendanceLogView } from './components/AttendanceLogView';
import { MembersView } from './components/MembersView';
import { ExportBackupView } from './components/ExportBackupView';
import { PersonalHistoryView } from './components/PersonalHistoryView';
import { AdminLoginModal } from './components/AdminLoginModal';

function extractMemberIdFromQr(rawCode: string): string {
  const trimmed = rawCode.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed.id === 'string' && parsed.id.trim()) {
        return parsed.id.trim().toUpperCase();
      }
    } catch {
      // Fallback to raw string
    }
  }
  return trimmed.toUpperCase();
}

export function App() {
  const [userRole, setUserRole] = useState<UserAccessRole>('member');
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null);
  const [adminLoginOpen, setAdminLoginOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>('scanner');
  const [members, setMembers] = useState<Member[]>(() => loadMembers());
  const [records, setRecords] = useState<AttendanceRecord[]>(() => loadRecords());
  const [config, setConfig] = useState<SessionConfig>(() => loadConfig());
  const [scanMode, setScanMode] = useState<ScanMode>('checkin');
  const [lastFeedback, setLastFeedback] = useState<ScanFeedback | null>(null);

  // Google Drive Auth & Sync State
  const [driveUser, setDriveUser] = useState<User | null>(null);
  const [driveToken, setDriveToken] = useState<string | null>(null);
  const [isSigningInDrive, setIsSigningInDrive] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [isLoadingDriveFiles, setIsLoadingDriveFiles] = useState(false);
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [driveSyncMessage, setDriveSyncMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const isAdmin = userRole === 'admin';

  useEffect(() => {
    saveMembers(members);
  }, [members]);

  useEffect(() => {
    saveRecords(records);
  }, [records]);

  useEffect(() => {
    saveConfig(config);
  }, [config]);

  const activeMember = useMemo(
    () =>
      activeMemberId
        ? members.find((m) => m.id.toUpperCase() === activeMemberId.toUpperCase()) ?? null
        : null,
    [members, activeMemberId]
  );

  const personalRecords = useMemo(() => {
    if (!activeMember) return [];
    return records
      .filter((r) => r.memberId.toUpperCase() === activeMember.id.toUpperCase())
      .sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return b.checkInTime.localeCompare(a.checkInTime);
      });
  }, [records, activeMember]);

  const refreshDriveFiles = useCallback(async (tokenOverride?: string) => {
    const token = tokenOverride ?? (await getAccessToken());
    if (!token) return;
    setIsLoadingDriveFiles(true);
    try {
      const result = await listAppDriveFiles(token);
      setDriveFiles(result.files);
    } catch (err) {
      setDriveSyncMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal memuat daftar file Google Drive.',
      });
    } finally {
      setIsLoadingDriveFiles(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setDriveUser(user);
        setDriveToken(token);
        refreshDriveFiles(token);
      },
      () => {
        setDriveUser(null);
        setDriveToken(null);
        setDriveFiles([]);
      }
    );
    return () => unsubscribe();
  }, [refreshDriveFiles]);

  const handleGoogleSignIn = async () => {
    setIsSigningInDrive(true);
    setDriveSyncMessage(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setDriveUser(res.user);
        setDriveToken(res.accessToken);
        await refreshDriveFiles(res.accessToken);
      }
    } catch (err) {
      setDriveSyncMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal masuk ke Google Drive.',
      });
    } finally {
      setIsSigningInDrive(false);
    }
  };

  const handleGoogleLogout = async () => {
    await logout();
    setDriveUser(null);
    setDriveToken(null);
    setDriveFiles([]);
    setDriveSyncMessage(null);
  };

  const todayDate = getLocalDateString();

  const todayRecords = useMemo(
    () =>
      records
        .filter((r) => r.date === todayDate)
        .sort((a, b) =>
          (b.checkOutTime ?? b.checkInTime).localeCompare(a.checkOutTime ?? a.checkInTime)
        ),
    [records, todayDate]
  );

  const notifyFeedback = useCallback(
    (feedback: ScanFeedback): ScanFeedback => {
      setLastFeedback(feedback);
      if (config.soundEnabled) {
        playScanTone(feedback.type);
      }
      if (config.vibrationEnabled) {
        triggerHaptic(feedback.type);
      }
      return feedback;
    },
    [config.soundEnabled, config.vibrationEnabled]
  );

  const uploadRecordPhoto = useCallback(
    async (recordId: string, photoDataUrl: string, fileName: string, tokenOverride?: string) => {
      const token = tokenOverride ?? (await getAccessToken());
      if (!token) return;

      setRecords((prev) =>
        prev.map((r) => (r.id === recordId ? { ...r, drivePhotoStatus: 'uploading' } : r))
      );

      try {
        const uploaded = await uploadFacePhotoToDrive(token, photoDataUrl, fileName);
        setRecords((prev) =>
          prev.map((r) =>
            r.id === recordId
              ? {
                  ...r,
                  drivePhotoId: uploaded.id,
                  drivePhotoUrl:
                    uploaded.webViewLink ?? `https://drive.google.com/file/d/${uploaded.id}/view`,
                  drivePhotoStatus: 'synced',
                }
              : r
          )
        );
        refreshDriveFiles(token);
      } catch {
        setRecords((prev) =>
          prev.map((r) => (r.id === recordId ? { ...r, drivePhotoStatus: 'error' } : r))
        );
      }
    },
    [refreshDriveFiles]
  );

  const handleScanSubmit = useCallback(
    (rawCode: string, method: ScanMethod, photoDataUrl?: string | null): ScanFeedback => {
      const targetId = extractMemberIdFromQr(rawCode);
      const now = new Date();
      const dateStr = getLocalDateString(now);
      const timeStr = getLocalTimeString(now);

      const member = members.find((m) => m.id.toUpperCase() === targetId);
      if (!member) {
        return notifyFeedback({
          type: 'error',
          title: 'Kode QR Tidak Terdaftar',
          detail: `ID "${targetId}" belum ada di daftar user. Hubungi admin untuk mendaftarkan akun.`,
          timestamp: timeStr,
        });
      }

      // Automatically set the scanned/photographed user as activeMember so they can see their own data
      setActiveMemberId(member.id);

      const existing = records.find(
        (r) => r.date === dateStr && r.memberId.toUpperCase() === member.id.toUpperCase()
      );

      const shouldUploadPhoto = Boolean(
        photoDataUrl && driveToken && config.autoUploadPhotoToDrive
      );

      if (scanMode === 'checkin') {
        if (existing) {
          return notifyFeedback({
            type: 'warning',
            title: `${member.name} Sudah Absen Masuk`,
            detail: `Tercatat masuk pada pukul ${existing.checkInTime} (${existing.sessionName}). Ubah mode ke Scan Pulang untuk mencatat jam keluar.`,
            timestamp: timeStr,
            photoDataUrl: existing.photoDataUrl ?? photoDataUrl ?? null,
          });
        }

        const status: AttendanceStatus = 'Hadir';
        const recordId = `${dateStr}-${member.id}-${Date.now()}`;
        const newRecord: AttendanceRecord = {
          id: recordId,
          memberId: member.id,
          memberName: member.name,
          division: member.division,
          date: dateStr,
          checkInTime: timeStr,
          checkOutTime: null,
          status,
          sessionName: config.sessionName,
          method,
          updatedAt: now.toISOString(),
          photoDataUrl: photoDataUrl ?? null,
          drivePhotoStatus: photoDataUrl
            ? shouldUploadPhoto
              ? 'uploading'
              : 'local'
            : 'none',
        };

        setRecords((prev) => [newRecord, ...prev]);

        if (photoDataUrl && shouldUploadPhoto && driveToken) {
          const safeTime = timeStr.replace(/:/g, '');
          const fileName = `foto-masuk-${member.id}-${dateStr}-${safeTime}.jpg`;
          void uploadRecordPhoto(recordId, photoDataUrl, fileName, driveToken);
        }

        const photoNote = photoDataUrl
          ? shouldUploadPhoto
            ? ' · Foto wajah disimpan ke Google Drive'
            : ' · Foto wajah tersimpan lokal'
          : '';

        return notifyFeedback({
          type: 'success',
          title: `${member.name} — Absen Masuk`,
          detail: `${member.id} · ${member.division} · ${config.sessionName} · ${timeStr}${photoNote}`,
          timestamp: timeStr,
          photoDataUrl: photoDataUrl ?? null,
        });
      } else {
        if (!existing) {
          return notifyFeedback({
            type: 'warning',
            title: `${member.name} Belum Scan Masuk`,
            detail: `Tidak ada catatan masuk hari ini (${dateStr}). Pindahkan mode ke Scan Masuk terlebih dahulu.`,
            timestamp: timeStr,
          });
        }

        if (existing.checkOutTime) {
          return notifyFeedback({
            type: 'warning',
            title: `${member.name} Sudah Scan Pulang`,
            detail: `Jam pulang sebelumnya sudah tercatat pada pukul ${existing.checkOutTime}.`,
            timestamp: timeStr,
            photoDataUrl: existing.photoDataUrl ?? null,
          });
        }

        const updatedPhoto = existing.photoDataUrl ?? photoDataUrl ?? null;
        setRecords((prev) =>
          prev.map((r) =>
            r.id === existing.id
              ? {
                  ...r,
                  checkOutTime: timeStr,
                  updatedAt: now.toISOString(),
                  photoDataUrl: updatedPhoto,
                }
              : r
          )
        );

        if (photoDataUrl && shouldUploadPhoto && driveToken) {
          const safeTime = timeStr.replace(/:/g, '');
          const fileName = `foto-pulang-${member.id}-${dateStr}-${safeTime}.jpg`;
          void uploadRecordPhoto(existing.id, photoDataUrl, fileName, driveToken);
        }

        return notifyFeedback({
          type: 'success',
          title: `${member.name} — Absen Pulang`,
          detail: `${member.id} · Masuk ${existing.checkInTime} · Pulang ${timeStr}`,
          timestamp: timeStr,
          photoDataUrl: updatedPhoto,
        });
      }
    },
    [
      members,
      records,
      scanMode,
      driveToken,
      config.autoUploadPhotoToDrive,
      config.sessionName,
      notifyFeedback,
      uploadRecordPhoto,
    ]
  );

  const handleManualUploadPhoto = (recordId: string) => {
    const target = records.find((r) => r.id === recordId);
    if (!target || !target.photoDataUrl || !driveToken) return;
    const safeTime = target.checkInTime.replace(/:/g, '');
    const fileName = `foto-${target.memberId}-${target.date}-${safeTime}.jpg`;
    void uploadRecordPhoto(target.id, target.photoDataUrl, fileName, driveToken);
  };

  const handleSyncCsvToDrive = async () => {
    const token = await getAccessToken();
    if (!token) return;
    setIsSyncingDrive(true);
    setDriveSyncMessage(null);
    try {
      const csvString = buildCsvString(todayRecords);
      const fileName = `rekap-absensi-${todayDate}.csv`;
      const saved = await createOrUpdateTextFileInDrive(
        token,
        fileName,
        csvString,
        'text/csv;charset=utf-8'
      );
      setDriveSyncMessage({
        type: 'success',
        text: `File "${saved.name}" berhasil disimpan ke folder HadirScan Absensi di Google Drive.`,
      });
      await refreshDriveFiles(token);
    } catch (err) {
      setDriveSyncMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menyimpan CSV ke Google Drive.',
      });
    } finally {
      setIsSyncingDrive(false);
    }
  };

  const handleSyncJsonToDrive = async () => {
    const token = await getAccessToken();
    if (!token) return;
    setIsSyncingDrive(true);
    setDriveSyncMessage(null);
    try {
      const payload = JSON.stringify(
        {
          app: 'HadirScan',
          syncedAt: new Date().toISOString(),
          config,
          members,
          records: records.map((r) => ({
            ...r,
            photoDataUrl: r.drivePhotoUrl ? null : r.photoDataUrl ?? null,
          })),
        },
        null,
        2
      );
      const saved = await createOrUpdateTextFileInDrive(
        token,
        'hadirscan-backup.json',
        payload,
        'application/json'
      );
      setDriveSyncMessage({
        type: 'success',
        text: `Backup "${saved.name}" berhasil diperbarui di Google Drive.`,
      });
      await refreshDriveFiles(token);
    } catch (err) {
      setDriveSyncMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menyimpan backup JSON ke Google Drive.',
      });
    } finally {
      setIsSyncingDrive(false);
    }
  };

  const handleDeleteDriveFile = async (fileId: string) => {
    const token = await getAccessToken();
    if (!token) return;
    try {
      await deleteDriveFile(token, fileId);
      setDriveSyncMessage({
        type: 'success',
        text: 'File berhasil dihapus dari Google Drive.',
      });
      await refreshDriveFiles(token);
    } catch (err) {
      setDriveSyncMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menghapus file dari Google Drive.',
      });
    }
  };

  // Admin Member CRUD
  const handleAddMember = (newMember: Omit<Member, 'createdAt'>) => {
    const duplicate = members.some((m) => m.id.toUpperCase() === newMember.id.toUpperCase());
    if (duplicate) {
      return { ok: false, error: `ID "${newMember.id}" sudah digunakan oleh user lain.` };
    }
    const created: Member = {
      ...newMember,
      createdAt: new Date().toISOString(),
    };
    setMembers((prev) => [created, ...prev]);
    return { ok: true };
  };

  const handleUpdateMember = (originalId: string, updated: Partial<Member>) => {
    const nextId = (updated.id ?? originalId).toUpperCase();
    if (
      nextId !== originalId.toUpperCase() &&
      members.some((m) => m.id.toUpperCase() === nextId)
    ) {
      return { ok: false, error: `ID "${nextId}" sudah digunakan oleh user lain.` };
    }

    setMembers((prev) =>
      prev.map((m) =>
        m.id.toUpperCase() === originalId.toUpperCase() ? { ...m, ...updated, id: nextId } : m
      )
    );

    // Sync updated name/id/division on attendance records if changed
    setRecords((prev) =>
      prev.map((r) =>
        r.memberId.toUpperCase() === originalId.toUpperCase()
          ? {
              ...r,
              memberId: nextId,
              memberName: updated.name ?? r.memberName,
              division: updated.division ?? r.division,
            }
          : r
      )
    );

    if (activeMemberId?.toUpperCase() === originalId.toUpperCase()) {
      setActiveMemberId(nextId);
    }

    return { ok: true };
  };

  const handleDeleteMember = (memberId: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    if (activeMemberId?.toUpperCase() === memberId.toUpperCase()) {
      setActiveMemberId(null);
    }
  };

  // Admin Attendance CRUD
  const handleAddManualRecord = (input: {
    memberId: string;
    date: string;
    checkInTime: string;
    checkOutTime: string | null;
    status: AttendanceStatus;
    sessionName: string;
  }) => {
    const member = members.find((m) => m.id.toUpperCase() === input.memberId.toUpperCase());
    if (!member) return;
    const nowIso = new Date().toISOString();
    const newRecord: AttendanceRecord = {
      id: `${input.date}-${member.id}-${Date.now()}`,
      memberId: member.id,
      memberName: member.name,
      division: member.division,
      date: input.date,
      checkInTime: input.checkInTime,
      checkOutTime: input.checkOutTime,
      status: input.status,
      sessionName: input.sessionName,
      method: 'Input Manual',
      updatedAt: nowIso,
      photoDataUrl: null,
      drivePhotoStatus: 'none',
    };
    setRecords((prev) => [newRecord, ...prev]);
  };

  const handleEditRecord = (
    recordId: string,
    updates: {
      date: string;
      checkInTime: string;
      checkOutTime: string | null;
      status: AttendanceStatus;
      sessionName: string;
    }
  ) => {
    setRecords((prev) =>
      prev.map((r) =>
        r.id === recordId
          ? {
              ...r,
              ...updates,
              updatedAt: new Date().toISOString(),
            }
          : r
      )
    );
  };

  const handleDeleteRecord = (recordId: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== recordId));
  };

  const handleImportBackup = (data: {
    members?: Member[];
    records?: AttendanceRecord[];
    config?: SessionConfig;
  }) => {
    if (data.members) setMembers(data.members);
    if (data.records) setRecords(data.records);
    if (data.config) setConfig(data.config);
  };

  const handleChangeAdminPassword = async (currentPassword: string, newPassword: string) => {
    const valid = await verifyAdminPassword(currentPassword, config.adminPasswordHash);
    if (!valid) {
      return { ok: false, error: 'Password admin saat ini salah.' };
    }
    const nextHash = await hashPassword(newPassword);
    setConfig((prev) => ({
      ...prev,
      adminPasswordHash: nextHash,
      isDefaultPassword: false,
    }));
    return { ok: true };
  };

  const handleLockAdmin = () => {
    setUserRole('member');
    if (activeTab === 'anggota' || activeTab === 'ekspor') {
      setActiveTab('scanner');
    }
  };

  const adminNavItems: { id: ActiveTab; label: string; icon: typeof QrCode }[] = [
    { id: 'scanner', label: 'Scanner', icon: QrCode },
    { id: 'rekap', label: 'Rekap', icon: ClipboardList },
    { id: 'anggota', label: 'Manajemen User', icon: Users },
    { id: 'ekspor', label: 'Drive', icon: Cloud },
  ];

  const memberNavItems: { id: ActiveTab; label: string; icon: typeof QrCode }[] = [
    { id: 'scanner', label: 'Scanner', icon: QrCode },
    { id: 'rekap', label: 'Data Saya', icon: UserCheck },
  ];

  const desktopNavItems = isAdmin ? adminNavItems : memberNavItems;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 md:pb-10">
      {/* Top Bar Contract: Single row, 3 zones on desktop */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md no-print">
        <div className="mx-auto flex h-12 md:h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
          {/* Zone 1: Single-element wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('scanner')}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            HadirScan
          </button>

          {/* Zone 2: Clean single-line text nav links (Desktop) */}
          <nav className="hidden md:flex items-center gap-7" aria-label="Navigasi utama">
            {desktopNavItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`relative py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active ? 'text-blue-600' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                  {active && (
                    <span className="absolute inset-x-0 -bottom-[17px] h-0.5 bg-blue-600" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center gap-2 shrink-0">
            {isAdmin ? (
              <button
                type="button"
                onClick={handleLockAdmin}
                className="min-h-[38px] md:min-h-[40px] rounded-xl border border-slate-200 bg-white px-3.5 md:px-4 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
              >
                Kunci Admin
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAdminLoginOpen(true)}
                className="min-h-[38px] md:min-h-[40px] rounded-xl bg-blue-600 px-3.5 md:px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
              >
                Login Admin
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        {activeTab === 'scanner' && (
          <QrScannerView
            isAdmin={isAdmin}
            activeMember={activeMember}
            members={members}
            todayRecords={todayRecords}
            personalRecords={personalRecords}
            config={config}
            scanMode={scanMode}
            driveConnected={Boolean(driveToken)}
            driveUserEmail={driveUser?.email}
            isSigningInDrive={isSigningInDrive}
            onGoogleSignIn={handleGoogleSignIn}
            onChangeScanMode={setScanMode}
            onChangeSessionName={(sessionName) =>
              setConfig((prev) => ({ ...prev, sessionName }))
            }
            onScanSubmit={handleScanSubmit}
            lastFeedback={lastFeedback}
            onOpenMembers={() => isAdmin && setActiveTab('anggota')}
            onOpenRekap={() => setActiveTab('rekap')}
          />
        )}

        {activeTab === 'rekap' &&
          (isAdmin ? (
            <AttendanceLogView
              members={members}
              records={records}
              defaultSessionName={config.sessionName}
              driveConnected={Boolean(driveToken)}
              onUploadPhotoToDrive={handleManualUploadPhoto}
              onAddManualRecord={handleAddManualRecord}
              onEditRecord={handleEditRecord}
              onDeleteRecord={handleDeleteRecord}
              onOpenScanner={() => setActiveTab('scanner')}
            />
          ) : (
            <PersonalHistoryView
              members={members}
              records={records}
              activeMember={activeMember}
              onSelectMember={(m) => setActiveMemberId(m ? m.id : null)}
              onOpenScanner={() => setActiveTab('scanner')}
            />
          ))}

        {activeTab === 'anggota' && isAdmin && (
          <MembersView
            members={members}
            onAddMember={handleAddMember}
            onUpdateMember={handleUpdateMember}
            onDeleteMember={handleDeleteMember}
            onChangeAdminPassword={handleChangeAdminPassword}
          />
        )}

        {activeTab === 'ekspor' && isAdmin && (
          <ExportBackupView
            members={members}
            records={records}
            config={config}
            driveConnected={Boolean(driveToken)}
            driveUserEmail={driveUser?.email}
            driveUserName={driveUser?.displayName}
            isSigningInDrive={isSigningInDrive}
            driveFiles={driveFiles}
            isLoadingDriveFiles={isLoadingDriveFiles}
            isSyncingDrive={isSyncingDrive}
            driveSyncMessage={driveSyncMessage}
            onGoogleSignIn={handleGoogleSignIn}
            onGoogleLogout={handleGoogleLogout}
            onRefreshDriveFiles={() => void refreshDriveFiles()}
            onSyncCsvToDrive={handleSyncCsvToDrive}
            onSyncJsonToDrive={handleSyncJsonToDrive}
            onDeleteDriveFile={handleDeleteDriveFile}
            onUpdateConfig={setConfig}
            onImportBackup={handleImportBackup}
            onClearAllRecords={() => setRecords([])}
          />
        )}
      </main>

      {/* Mobile Fixed Bottom Tab Bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md md:hidden no-print"
        aria-label="Navigasi bawah"
      >
        {isAdmin ? (
          <div className="grid h-14 grid-cols-4 items-center">
            {adminNavItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex h-full min-h-[44px] flex-col items-center justify-center gap-0.5 transition-colors ${
                    active ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[11px] font-medium tracking-tight">
                    {item.id === 'anggota' ? 'User' : item.label}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid h-14 grid-cols-3 items-center">
            {memberNavItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex h-full min-h-[44px] flex-col items-center justify-center gap-0.5 transition-colors ${
                    active ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[11px] font-medium tracking-tight">{item.label}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setAdminLoginOpen(true)}
              className="flex h-full min-h-[44px] flex-col items-center justify-center gap-0.5 text-slate-500 hover:text-slate-800 transition-colors"
            >
              <Lock className="h-5 w-5" />
              <span className="text-[11px] font-medium tracking-tight">Admin</span>
            </button>
          </div>
        )}
      </nav>

      {/* Admin Password Login Modal */}
      <AdminLoginModal
        open={adminLoginOpen}
        isDefaultPassword={config.isDefaultPassword !== false}
        onVerifyPassword={(pw) => verifyAdminPassword(pw, config.adminPasswordHash)}
        onSuccess={() => {
          setUserRole('admin');
          setAdminLoginOpen(false);
        }}
        onClose={() => setAdminLoginOpen(false)}
      />
    </div>
  );
}

export default App;
