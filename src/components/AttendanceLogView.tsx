import React, { useMemo, useState } from 'react';
import {
  Download,
  Search,
  Trash2,
  Calendar,
  FileSpreadsheet,
  ExternalLink,
  Image as ImageIcon,
  X,
  UploadCloud,
  Plus,
  Pencil,
} from 'lucide-react';
import { AttendanceRecord, AttendanceStatus, Member } from '../types/attendance';
import { exportRecordsToCsv, getLocalDateString, getLocalTimeString } from '../utils/storage';
import { ConfirmDialog } from './ConfirmDialog';

interface AttendanceLogViewProps {
  members: Member[];
  records: AttendanceRecord[];
  defaultSessionName: string;
  driveConnected: boolean;
  onUploadPhotoToDrive: (recordId: string) => void;
  onAddManualRecord: (record: {
    memberId: string;
    date: string;
    checkInTime: string;
    checkOutTime: string | null;
    status: AttendanceStatus;
    sessionName: string;
  }) => void;
  onEditRecord: (
    recordId: string,
    updates: {
      date: string;
      checkInTime: string;
      checkOutTime: string | null;
      status: AttendanceStatus;
      sessionName: string;
    }
  ) => void;
  onDeleteRecord: (recordId: string) => void;
  onOpenScanner: () => void;
}

export const AttendanceLogView: React.FC<AttendanceLogViewProps> = ({
  members,
  records,
  defaultSessionName,
  driveConnected,
  onUploadPhotoToDrive,
  onAddManualRecord,
  onEditRecord,
  onDeleteRecord,
  onOpenScanner,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(getLocalDateString());
  const [showAllDates, setShowAllDates] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'MASUK' | 'PULANG' | 'BELUM_PULANG' | 'Izin'
  >('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingDelete, setPendingDelete] = useState<AttendanceRecord | null>(null);
  const [inspectPhotoRecord, setInspectPhotoRecord] = useState<AttendanceRecord | null>(null);

  // Add Manual Record Modal
  const [addOpen, setAddOpen] = useState(false);
  const [addMemberId, setAddMemberId] = useState(members[0]?.id ?? '');
  const [addDate, setAddDate] = useState(getLocalDateString());
  const [addCheckIn, setAddCheckIn] = useState(getLocalTimeString().slice(0, 5));
  const [addCheckOut, setAddCheckOut] = useState('');
  const [addStatus, setAddStatus] = useState<AttendanceStatus>('Hadir');
  const [addSession, setAddSession] = useState(defaultSessionName);

  // Edit Existing Record Modal
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editCheckIn, setEditCheckIn] = useState('');
  const [editCheckOut, setEditCheckOut] = useState('');
  const [editStatus, setEditStatus] = useState<AttendanceStatus>('Hadir');
  const [editSession, setEditSession] = useState('');

  const filteredRecords = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return records
      .filter((r) => {
        if (!showAllDates && selectedDate && r.date !== selectedDate) return false;
        if (statusFilter === 'MASUK') {
          if (!r.checkInTime) return false;
        } else if (statusFilter === 'PULANG') {
          if (!r.checkOutTime) return false;
        } else if (statusFilter === 'BELUM_PULANG') {
          if (r.checkOutTime !== null) return false;
        } else if (statusFilter !== 'ALL') {
          if (r.status !== statusFilter) return false;
        }
        if (query) {
          const hay = `${r.memberName} ${r.memberId} ${r.division} ${r.sessionName}`.toLowerCase();
          if (!hay.includes(query)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return b.checkInTime.localeCompare(a.checkInTime);
      });
  }, [records, selectedDate, showAllDates, statusFilter, searchQuery]);

  const checkInTotal = filteredRecords.filter((r) => Boolean(r.checkInTime)).length;
  const checkOutTotal = filteredRecords.filter((r) => r.checkOutTime !== null).length;

  const handleExportFiltered = () => {
    const suffix = showAllDates ? 'semua-tanggal' : selectedDate;
    exportRecordsToCsv(filteredRecords, `rekap-absensi-${suffix}.csv`);
  };

  const openAddModal = () => {
    setAddMemberId(members[0]?.id ?? '');
    setAddDate(selectedDate || getLocalDateString());
    setAddCheckIn(getLocalTimeString().slice(0, 5));
    setAddCheckOut('');
    setAddStatus('Hadir');
    setAddSession(defaultSessionName);
    setAddOpen(true);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addMemberId) return;
    const formattedIn = addCheckIn.length === 5 ? `${addCheckIn}:00` : addCheckIn;
    const formattedOut = addCheckOut.trim()
      ? addCheckOut.length === 5
        ? `${addCheckOut}:00`
        : addCheckOut
      : null;

    onAddManualRecord({
      memberId: addMemberId,
      date: addDate,
      checkInTime: formattedIn,
      checkOutTime: formattedOut,
      status: addStatus,
      sessionName: addSession.trim() || defaultSessionName,
    });
    setAddOpen(false);
  };

  const openEditModal = (record: AttendanceRecord) => {
    setEditingRecord(record);
    setEditDate(record.date);
    setEditCheckIn(record.checkInTime.slice(0, 5));
    setEditCheckOut(record.checkOutTime ? record.checkOutTime.slice(0, 5) : '');
    setEditStatus(record.status);
    setEditSession(record.sessionName);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    const formattedIn = editCheckIn.length === 5 ? `${editCheckIn}:00` : editCheckIn;
    const formattedOut = editCheckOut.trim()
      ? editCheckOut.length === 5
        ? `${editCheckOut}:00`
        : editCheckOut
      : null;

    onEditRecord(editingRecord.id, {
      date: editDate,
      checkInTime: formattedIn,
      checkOutTime: formattedOut,
      status: editStatus,
      sessionName: editSession.trim() || defaultSessionName,
    });
    setEditingRecord(null);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        {/* Header & Admin Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Rekap Semua Data (Admin)</h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Menampilkan{' '}
              <span className="font-mono tabular-nums font-medium text-slate-700">
                {filteredRecords.length}
              </span>{' '}
              catatan
              {showAllDates ? ' dari seluruh tanggal' : ` untuk tanggal ${selectedDate}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={members.length === 0}
              onClick={openAddModal}
              className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Data</span>
            </button>

            <button
              type="button"
              disabled={filteredRecords.length === 0}
              onClick={handleExportFiltered}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="h-4 w-4" />
              <span>Unduh CSV</span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex items-center">
              <Calendar className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
              <input
                type="date"
                value={selectedDate}
                disabled={showAllDates}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs font-mono text-slate-800 disabled:opacity-50 focus:border-blue-600 focus:bg-white focus:outline-none"
                aria-label="Filter tanggal"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowAllDates((prev) => !prev)}
              className={`min-h-[44px] rounded-xl border px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                showAllDates
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {showAllDates ? 'Semua Tanggal Aktif' : 'Lihat Semua Tanggal'}
            </button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="inline-flex items-center rounded-xl bg-slate-100 p-1 overflow-x-auto">
              {(
                [
                  { id: 'ALL', label: 'Semua' },
                  { id: 'MASUK', label: `Masuk (${checkInTotal})` },
                  { id: 'PULANG', label: `Pulang (${checkOutTotal})` },
                  { id: 'BELUM_PULANG', label: 'Belum Pulang' },
                  { id: 'Izin', label: 'Izin' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    statusFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative flex-1 sm:w-56">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, ID, divisi..."
                className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* High-Density Data Table */}
        {filteredRecords.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-slate-200 py-14 px-4 text-center">
            <FileSpreadsheet className="mx-auto h-9 w-9 text-slate-300" />
            <h2 className="mt-3 text-sm font-semibold text-slate-800">
              Belum ada data absensi yang cocok
            </h2>
            <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
              Lakukan scan QR, tambah data manual, atau ubah filter tanggal untuk melihat catatan.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={onOpenScanner}
                className="min-h-[44px] rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
              >
                Buka Scanner
              </button>
              {members.length > 0 && (
                <button
                  type="button"
                  onClick={openAddModal}
                  className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Tambah Manual
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-3 pr-4">Foto</th>
                  <th className="py-3 px-3">Anggota</th>
                  <th className="py-3 px-3">Divisi / Kelas</th>
                  <th className="py-3 px-3">Tanggal</th>
                  <th className="py-3 px-3 text-right">Masuk</th>
                  <th className="py-3 px-3 text-right">Pulang</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Drive</th>
                  <th className="py-3 pl-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 pr-4">
                      {record.photoDataUrl ? (
                        <button
                          type="button"
                          onClick={() => setInspectPhotoRecord(record)}
                          className="h-11 w-11 overflow-hidden rounded-lg border border-slate-200 hover:border-blue-500 transition-colors"
                          aria-label={`Lihat foto ${record.memberName}`}
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
                    <td className="py-2.5 px-3">
                      <p className="font-semibold text-slate-900">{record.memberName}</p>
                      <p className="text-xs font-mono text-slate-500">
                        {record.memberId} · {record.method}
                      </p>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-slate-600">{record.division}</td>
                    <td className="py-2.5 px-3 font-mono text-xs tabular-nums text-slate-600">
                      {record.date}
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
                      <p className="text-[11px] text-slate-400">{record.sessionName}</p>
                    </td>
                    <td className="py-2.5 px-3 text-xs">
                      {record.drivePhotoUrl ? (
                        <a
                          href={record.drivePhotoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline whitespace-nowrap"
                        >
                          <span>Foto Drive</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : record.drivePhotoStatus === 'uploading' ? (
                        <span className="text-slate-500">Mengunggah...</span>
                      ) : record.photoDataUrl && driveConnected ? (
                        <button
                          type="button"
                          onClick={() => onUploadPhotoToDrive(record.id)}
                          className="inline-flex items-center gap-1 font-medium text-slate-700 hover:text-blue-600 whitespace-nowrap"
                        >
                          <UploadCloud className="h-3.5 w-3.5" />
                          <span>Unggah</span>
                        </button>
                      ) : (
                        <span className="text-slate-400">
                          {record.photoDataUrl ? 'Lokal' : '—'}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pl-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(record)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                          aria-label={`Edit catatan ${record.memberName}`}
                          title="Edit Catatan"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(record)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          aria-label={`Hapus catatan ${record.memberName}`}
                          title="Hapus Catatan"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Manual Record Modal */}
      {addOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900">Tambah Data Absensi</h3>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Anggota</label>
                <select
                  value={addMemberId}
                  onChange={(e) => setAddMemberId(e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.id} · {m.division})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Tanggal</label>
                  <input
                    type="date"
                    value={addDate}
                    onChange={(e) => setAddDate(e.target.value)}
                    required
                    className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
                  <select
                    value={addStatus}
                    onChange={(e) => setAddStatus(e.target.value as AttendanceStatus)}
                    className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                  >
                    <option value="Hadir">Hadir</option>
                    <option value="Izin">Izin</option>
                    <option value="Sakit">Sakit</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Jam Masuk</label>
                  <input
                    type="time"
                    value={addCheckIn}
                    onChange={(e) => setAddCheckIn(e.target.value)}
                    required
                    className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Jam Pulang (opsional)
                  </label>
                  <input
                    type="time"
                    value={addCheckOut}
                    onChange={(e) => setAddCheckOut(e.target.value)}
                    className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Sesi</label>
                <input
                  type="text"
                  value={addSession}
                  onChange={(e) => setAddSession(e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Simpan Data
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Existing Record Modal */}
      {editingRecord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Edit Catatan Absensi</h3>
                <p className="text-xs text-slate-500">
                  {editingRecord.memberName} ({editingRecord.memberId})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Tanggal</label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    required
                    className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as AttendanceStatus)}
                    className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                  >
                    <option value="Hadir">Hadir</option>
                    <option value="Izin">Izin</option>
                    <option value="Sakit">Sakit</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Jam Masuk</label>
                  <input
                    type="time"
                    value={editCheckIn}
                    onChange={(e) => setEditCheckIn(e.target.value)}
                    required
                    className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Jam Pulang (opsional)
                  </label>
                  <input
                    type="time"
                    value={editCheckOut}
                    onChange={(e) => setEditCheckOut(e.target.value)}
                    className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Sesi</label>
                <input
                  type="text"
                  value={editSession}
                  onChange={(e) => setEditSession(e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Photo Preview Modal */}
      {inspectPhotoRecord && inspectPhotoRecord.photoDataUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  {inspectPhotoRecord.memberName}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {inspectPhotoRecord.memberId} · {inspectPhotoRecord.date} ·{' '}
                  {inspectPhotoRecord.checkInTime}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectPhotoRecord(null)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Tutup foto"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
              <img
                src={inspectPhotoRecord.photoDataUrl}
                alt={`Foto absensi ${inspectPhotoRecord.memberName}`}
                className="w-full max-h-80 object-contain"
              />
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500">
                Status:{' '}
                <strong className="text-slate-800">{inspectPhotoRecord.status}</strong>
              </span>
              {inspectPhotoRecord.drivePhotoUrl && (
                <a
                  href={inspectPhotoRecord.drivePhotoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  <span>Buka di Google Drive</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Hapus Catatan Absensi?"
        description={
          pendingDelete
            ? `Catatan kehadiran ${pendingDelete.memberName} (${pendingDelete.date}) akan dihapus dari daftar lokal perangkat.`
            : ''
        }
        confirmLabel="Hapus"
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            onDeleteRecord(pendingDelete.id);
            setPendingDelete(null);
          }
        }}
      />
    </div>
  );
};
