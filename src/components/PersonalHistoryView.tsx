import React, { useMemo, useState } from 'react';
import {
  User,
  ExternalLink,
  Image as ImageIcon,
  QrCode,
  KeyRound,
  X,
  LogOut,
} from 'lucide-react';
import { AttendanceRecord, Member } from '../types/attendance';

interface PersonalHistoryViewProps {
  members: Member[];
  records: AttendanceRecord[];
  activeMember: Member | null;
  onSelectMember: (member: Member | null) => void;
  onOpenScanner: () => void;
}

export const PersonalHistoryView: React.FC<PersonalHistoryViewProps> = ({
  members,
  records,
  activeMember,
  onSelectMember,
  onOpenScanner,
}) => {
  const [selectedId, setSelectedId] = useState(members[0]?.id ?? '');
  const [pinInput, setPinInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [inspectRecord, setInspectRecord] = useState<AttendanceRecord | null>(null);

  const selectedCandidate = members.find((m) => m.id === selectedId) ?? null;

  const personalRecords = useMemo(() => {
    if (!activeMember) return [];
    return records
      .filter((r) => r.memberId.toUpperCase() === activeMember.id.toUpperCase())
      .sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return b.checkInTime.localeCompare(a.checkInTime);
      });
  }, [records, activeMember]);

  const handleOpenMyData = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!selectedCandidate) {
      setAuthError('Pilih nama atau ID anggota Anda terlebih dahulu.');
      return;
    }

    if (selectedCandidate.pin && selectedCandidate.pin.trim() !== '') {
      if (pinInput.trim() !== selectedCandidate.pin.trim()) {
        setAuthError('PIN pribadi salah. Hubungi admin jika lupa PIN Anda.');
        return;
      }
    }

    setPinInput('');
    onSelectMember(selectedCandidate);
  };

  if (!activeMember) {
    return (
      <div className="mx-auto max-w-lg">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex items-start gap-3 pb-4 border-b border-slate-100">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Lihat Data Kehadiran Saya</h1>
              <p className="mt-0.5 text-xs text-slate-500">
                Anda hanya dapat melihat riwayat absensi dan foto wajah milik Anda sendiri.
              </p>
            </div>
          </div>

          <form onSubmit={handleOpenMyData} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="personal-member-select"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Pilih Nama / ID Anggota
              </label>
              <select
                id="personal-member-select"
                value={selectedId}
                onChange={(e) => {
                  setSelectedId(e.target.value);
                  setAuthError(null);
                  setPinInput('');
                }}
                className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
              >
                {members.length === 0 ? (
                  <option value="">Belum ada anggota terdaftar</option>
                ) : (
                  members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.id} · {m.division})
                    </option>
                  ))
                )}
              </select>
            </div>

            {selectedCandidate?.pin && (
              <div>
                <label
                  htmlFor="personal-pin-input"
                  className="flex items-center gap-1.5 text-xs font-medium text-slate-700 mb-1.5"
                >
                  <KeyRound className="h-3.5 w-3.5 text-slate-400" />
                  <span>PIN Pribadi</span>
                </label>
                <input
                  id="personal-pin-input"
                  type="password"
                  inputMode="numeric"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Masukkan PIN pribadi Anda"
                  className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-mono text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                />
              </div>
            )}

            {authError && <p className="text-xs font-medium text-red-600">{authError}</p>}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-2">
              <button
                type="button"
                onClick={onOpenScanner}
                className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <QrCode className="h-4 w-4" />
                <span>Scan / Foto Dulu</span>
              </button>

              <button
                type="submit"
                disabled={!selectedCandidate}
                className="min-h-[44px] rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-45"
              >
                Lihat Data Saya
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const checkInCount = personalRecords.filter((r) => Boolean(r.checkInTime)).length;
  const checkOutCount = personalRecords.filter((r) => r.checkOutTime !== null).length;
  const photoCount = personalRecords.filter((r) => Boolean(r.photoDataUrl || r.drivePhotoUrl)).length;

  return (
    <div className="space-y-5">
      {/* Personal Profile & Summary */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{activeMember.name}</h1>
            <p className="mt-0.5 text-xs text-slate-500">
              <span className="font-mono font-medium text-slate-700">{activeMember.id}</span> ·{' '}
              {activeMember.division}
              {activeMember.position ? ` · ${activeMember.position}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenScanner}
              className="min-h-[40px] rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 whitespace-nowrap"
            >
              Scan / Foto Lagi
            </button>
            <button
              type="button"
              onClick={() => onSelectMember(null)}
              className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Ganti Akun</span>
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 gap-y-3">
          <div className="sm:pr-4">
            <p className="text-xs text-slate-500">Total Absen</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
              {personalRecords.length}
            </p>
          </div>
          <div className="sm:px-4">
            <p className="text-xs text-slate-500">Absen Jam Masuk</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600 tabular-nums">{checkInCount}</p>
          </div>
          <div className="sm:px-4">
            <p className="text-xs text-slate-500">Absen Jam Pulang</p>
            <p className="mt-1 text-2xl font-bold text-indigo-600 tabular-nums">{checkOutCount}</p>
          </div>
          <div className="sm:pl-4">
            <p className="text-xs text-slate-500">Foto Tersimpan</p>
            <p className="mt-1 text-2xl font-bold text-blue-600 tabular-nums">{photoCount}</p>
          </div>
        </div>
      </div>

      {/* Personal Attendance Records Table */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="pb-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">Riwayat Kehadiran Saya</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Hanya menampilkan catatan dan foto wajah milik {activeMember.name}
          </p>
        </div>

        {personalRecords.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-medium text-slate-700">Belum ada catatan kehadiran</p>
            <p className="mt-1 text-xs text-slate-500">
              Lakukan scan QR atau ambil foto wajah di halaman Scanner untuk mencatat kehadiran
              Anda.
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-3 pr-4">Foto</th>
                  <th className="py-3 px-3">Tanggal</th>
                  <th className="py-3 px-3">Sesi</th>
                  <th className="py-3 px-3 text-right">Masuk</th>
                  <th className="py-3 px-3 text-right">Pulang</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 pl-3 text-right">Google Drive</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {personalRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 pr-4">
                      {record.photoDataUrl ? (
                        <button
                          type="button"
                          onClick={() => setInspectRecord(record)}
                          className="h-11 w-11 overflow-hidden rounded-lg border border-slate-200 hover:border-blue-500"
                          aria-label={`Lihat foto ${record.date}`}
                        >
                          <img
                            src={record.photoDataUrl}
                            alt={`Foto ${record.memberName}`}
                            className="h-full w-full object-cover"
                          />
                        </button>
                      ) : (
                        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                          <ImageIcon className="h-4 w-4" />
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-xs tabular-nums text-slate-800">
                      {record.date}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-slate-600">
                      {record.sessionName} · {record.method}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-xs tabular-nums text-slate-900">
                      {record.checkInTime}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-xs tabular-nums text-slate-600">
                      {record.checkOutTime ?? '—'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`text-xs font-semibold ${
                          record.status === 'Hadir'
                            ? 'text-emerald-700'
                            : record.status === 'Izin'
                            ? 'text-amber-700'
                            : 'text-slate-700'
                        }`}
                      >
                        {record.status}
                      </span>
                    </td>
                    <td className="py-2.5 pl-3 text-right text-xs">
                      {record.drivePhotoUrl ? (
                        <a
                          href={record.drivePhotoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline"
                        >
                          <span>Lihat Foto</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-slate-400">
                          {record.photoDataUrl ? 'Tersimpan Lokal' : '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Photo Preview Modal */}
      {inspectRecord && inspectRecord.photoDataUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-semibold text-slate-900">{inspectRecord.memberName}</h3>
                <p className="text-xs text-slate-500 font-mono">
                  {inspectRecord.date} · {inspectRecord.checkInTime}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectRecord(null)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Tutup foto"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
              <img
                src={inspectRecord.photoDataUrl}
                alt={`Foto ${inspectRecord.memberName}`}
                className="w-full max-h-80 object-contain"
              />
            </div>
            {inspectRecord.drivePhotoUrl && (
              <div className="mt-4 flex justify-end">
                <a
                  href={inspectRecord.drivePhotoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  <span>Buka di Google Drive</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
