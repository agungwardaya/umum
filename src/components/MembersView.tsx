import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Download,
  KeyRound,
  Pencil,
  Plus,
  Printer,
  QrCode,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { Member } from '../types/attendance';
import { ConfirmDialog } from './ConfirmDialog';

interface MembersViewProps {
  members: Member[];
  onAddMember: (member: Omit<Member, 'createdAt'>) => { ok: boolean; error?: string };
  onUpdateMember: (originalId: string, updated: Partial<Member>) => { ok: boolean; error?: string };
  onDeleteMember: (memberId: string) => void;
  onChangeAdminPassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<{ ok: boolean; error?: string }>;
}

const QrPreviewCard: React.FC<{
  member: Member;
  onSelectInspect: (member: Member, dataUrl: string) => void;
  onEdit: (member: Member) => void;
  onDelete: (member: Member) => void;
}> = ({ member, onSelectInspect, onEdit, onDelete }) => {
  const [qrUrl, setQrUrl] = useState<string>('');

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(member.id, {
      width: 320,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => {
        if (active) setQrUrl(url);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [member.id]);

  const handleDownloadCard = () => {
    if (!qrUrl) return;
    const link = document.createElement('a');
    link.href = qrUrl;
    link.download = `qr-${member.id}-${member.name.toLowerCase().replace(/\s+/g, '-')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3.5">
        <button
          type="button"
          onClick={() => qrUrl && onSelectInspect(member, qrUrl)}
          className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 hover:border-blue-500 transition-colors"
          aria-label={`Perbesar QR ${member.name}`}
        >
          {qrUrl ? (
            <img src={qrUrl} alt={`QR Code ${member.name}`} className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-300">
              <QrCode className="h-8 w-8" />
            </div>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{member.name}</p>
          <p className="mt-0.5 text-xs text-slate-500 truncate">
            {member.division}
            {member.position ? ` · ${member.position}` : ''}
          </p>
          <p className="mt-1.5 font-mono text-xs font-medium text-slate-700 tabular-nums">
            {member.id}
            {member.pin ? ' · PIN aktif' : ''}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 pt-3 border-t border-slate-100 no-print">
        <button
          type="button"
          onClick={() => qrUrl && onSelectInspect(member, qrUrl)}
          className="min-h-[38px] rounded-lg px-2.5 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors whitespace-nowrap shrink-0"
        >
          Tampilkan QR
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(member)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            aria-label={`Edit user ${member.name}`}
            title="Edit User"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleDownloadCard}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            aria-label={`Unduh PNG QR ${member.name}`}
            title="Unduh QR PNG"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(member)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
            aria-label={`Hapus user ${member.name}`}
            title="Hapus User"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export const MembersView: React.FC<MembersViewProps> = ({
  members,
  onAddMember,
  onUpdateMember,
  onDeleteMember,
  onChangeAdminPassword,
}) => {
  // Add form state
  const [name, setName] = useState('');
  const [memberId, setMemberId] = useState('');
  const [division, setDivision] = useState('');
  const [position, setPosition] = useState('');
  const [pin, setPin] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Search & inspect state
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectModal, setInspectModal] = useState<{ member: Member; qrUrl: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Member | null>(null);

  // Edit member modal state
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editName, setEditName] = useState('');
  const [editId, setEditId] = useState('');
  const [editDivision, setEditDivision] = useState('');
  const [editPosition, setEditPosition] = useState('');
  const [editPin, setEditPin] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  // Admin password change state
  const [currentAdminPw, setCurrentAdminPw] = useState('');
  const [newAdminPw, setNewAdminPw] = useState('');
  const [confirmAdminPw, setConfirmAdminPw] = useState('');
  const [pwMessage, setPwMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const suggestNextId = () => {
    const nextNum = members.length + 1;
    return `ANG-${String(nextNum).padStart(3, '0')}`;
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = name.trim();
    const trimmedId = (memberId.trim() || suggestNextId()).toUpperCase();
    const trimmedDivision = division.trim() || 'Umum';
    const trimmedPosition = position.trim() || 'Anggota';
    const trimmedPin = pin.trim();

    if (!trimmedName) {
      setFormError('Nama lengkap user wajib diisi.');
      return;
    }

    const result = onAddMember({
      id: trimmedId,
      name: trimmedName,
      division: trimmedDivision,
      position: trimmedPosition,
      pin: trimmedPin || undefined,
      active: true,
    });

    if (!result.ok) {
      setFormError(result.error ?? 'Gagal menambahkan user.');
      return;
    }

    setName('');
    setMemberId('');
    setDivision('');
    setPosition('');
    setPin('');
  };

  const openEditModal = (member: Member) => {
    setEditingMember(member);
    setEditName(member.name);
    setEditId(member.id);
    setEditDivision(member.division);
    setEditPosition(member.position ?? '');
    setEditPin(member.pin ?? '');
    setEditError(null);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    setEditError(null);

    if (!editName.trim() || !editId.trim()) {
      setEditError('Nama dan ID wajib diisi.');
      return;
    }

    const result = onUpdateMember(editingMember.id, {
      id: editId.trim().toUpperCase(),
      name: editName.trim(),
      division: editDivision.trim() || 'Umum',
      position: editPosition.trim() || 'Anggota',
      pin: editPin.trim() || undefined,
    });

    if (!result.ok) {
      setEditError(result.error ?? 'Gagal memperbarui data user.');
      return;
    }

    setEditingMember(null);
  };

  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMessage(null);

    if (newAdminPw.length < 4) {
      setPwMessage({ type: 'error', text: 'Password admin baru minimal 4 karakter.' });
      return;
    }
    if (newAdminPw !== confirmAdminPw) {
      setPwMessage({ type: 'error', text: 'Konfirmasi password baru tidak cocok.' });
      return;
    }

    const res = await onChangeAdminPassword(currentAdminPw, newAdminPw);
    if (res.ok) {
      setPwMessage({ type: 'success', text: 'Password admin berhasil diperbarui.' });
      setCurrentAdminPw('');
      setNewAdminPw('');
      setConfirmAdminPw('');
    } else {
      setPwMessage({ type: 'error', text: res.error ?? 'Gagal mengganti password admin.' });
    }
  };

  const filteredMembers = members.filter((m) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      m.name.toLowerCase().includes(q) ||
      m.id.toLowerCase().includes(q) ||
      m.division.toLowerCase().includes(q) ||
      (m.position ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Row: Add User & Admin Password Management */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start no-print">
        {/* Add User Form */}
        <div className="lg:col-span-8 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
            <UserPlus className="h-5 w-5 text-blue-600" />
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Manajemen User & Kartu QR</h1>
              <p className="text-xs text-slate-500">
                Tambah user baru, atur PIN pribadi (opsional), dan kelola kartu QR anggota
              </p>
            </div>
          </div>

          <form onSubmit={handleAddSubmit} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-12">
            <div className="sm:col-span-5">
              <label htmlFor="member-name" className="block text-xs font-medium text-slate-700 mb-1">
                Nama Lengkap
              </label>
              <input
                id="member-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Ahmad Fauzi"
                className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="member-id" className="block text-xs font-medium text-slate-700 mb-1">
                ID / NIS / NIP
              </label>
              <input
                id="member-id"
                type="text"
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                placeholder={suggestNextId()}
                className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-mono text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>

            <div className="sm:col-span-4">
              <label
                htmlFor="member-division"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Divisi / Kelas
              </label>
              <input
                id="member-division"
                type="text"
                value={division}
                onChange={(e) => setDivision(e.target.value)}
                placeholder="Contoh: Operasional"
                className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>

            <div className="sm:col-span-5">
              <label
                htmlFor="member-position"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Jabatan / Peran
              </label>
              <input
                id="member-position"
                type="text"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="Contoh: Staf / Siswa"
                className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>

            <div className="sm:col-span-4">
              <label htmlFor="member-pin" className="block text-xs font-medium text-slate-700 mb-1">
                PIN Cek Data Pribadi (opsional)
              </label>
              <input
                id="member-pin"
                type="text"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Kosongkan jika tanpa PIN"
                className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-mono text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>

            <div className="sm:col-span-3 flex items-end">
              <button
                type="submit"
                className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap"
              >
                <Plus className="h-4 w-4" />
                <span>Tambah User</span>
              </button>
            </div>
          </form>

          {formError && <p className="mt-2.5 text-xs font-medium text-red-600">{formError}</p>}
        </div>

        {/* Admin Password Management */}
        <div className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Password Admin</h2>
              <p className="text-xs text-slate-500">Ubah password akses mode Admin</p>
            </div>
          </div>

          <form onSubmit={handlePasswordChangeSubmit} className="mt-3 space-y-3">
            <div>
              <label
                htmlFor="current-admin-pw"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Password Saat Ini
              </label>
              <input
                id="current-admin-pw"
                type="password"
                value={currentAdminPw}
                onChange={(e) => setCurrentAdminPw(e.target.value)}
                placeholder="Password admin saat ini"
                className="min-h-[40px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="new-admin-pw"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Password Baru
              </label>
              <input
                id="new-admin-pw"
                type="password"
                value={newAdminPw}
                onChange={(e) => setNewAdminPw(e.target.value)}
                placeholder="Minimal 4 karakter"
                className="min-h-[40px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="confirm-admin-pw"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Ulangi Password Baru
              </label>
              <input
                id="confirm-admin-pw"
                type="password"
                value={confirmAdminPw}
                onChange={(e) => setConfirmAdminPw(e.target.value)}
                placeholder="Ketik ulang password baru"
                className="min-h-[40px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>

            {pwMessage && (
              <p
                className={`text-xs font-medium ${
                  pwMessage.type === 'success' ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {pwMessage.text}
              </p>
            )}

            <button
              type="submit"
              className="flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span>Simpan Password Admin</span>
            </button>
          </form>
        </div>
      </div>

      {/* Member QR Cards Grid */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between no-print">
          <p className="text-sm font-semibold text-slate-900">
            Daftar User & Kartu QR ({filteredMembers.length})
          </p>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-60">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari user..."
                className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Printer className="h-4 w-4" />
              <span>Cetak Kartu</span>
            </button>
          </div>
        </div>

        {filteredMembers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center">
            <p className="text-sm font-medium text-slate-700">Tidak ada user ditemukan</p>
            <p className="mt-1 text-xs text-slate-500">
              Tambahkan user baru di formulir atas untuk menghasilkan kartu QR.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredMembers.map((member) => (
              <QrPreviewCard
                key={member.id}
                member={member}
                onSelectInspect={(m, url) => setInspectModal({ member: m, qrUrl: url })}
                onEdit={openEditModal}
                onDelete={(m) => setPendingDelete(m)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit User Modal */}
      {editingMember && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900">Edit Data User</h3>
              <button
                type="button"
                onClick={() => setEditingMember(null)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Tutup edit user"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">ID Anggota</label>
                  <input
                    type="text"
                    value={editId}
                    onChange={(e) => setEditId(e.target.value)}
                    className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-mono text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    PIN Pribadi
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={editPin}
                    onChange={(e) => setEditPin(e.target.value)}
                    placeholder="Kosongkan = tanpa PIN"
                    className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-mono text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Divisi / Kelas
                  </label>
                  <input
                    type="text"
                    value={editDivision}
                    onChange={(e) => setEditDivision(e.target.value)}
                    className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Jabatan / Peran
                  </label>
                  <input
                    type="text"
                    value={editPosition}
                    onChange={(e) => setEditPosition(e.target.value)}
                    className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {editError && <p className="text-xs font-medium text-red-600">{editError}</p>}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
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

      {/* Large QR Modal */}
      {inspectModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Kartu QR Anggota</span>
              <button
                type="button"
                onClick={() => setInspectModal(null)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Tutup modal QR"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 mx-auto w-60 h-60 rounded-2xl border border-slate-200 bg-white p-3">
              <img
                src={inspectModal.qrUrl}
                alt={`QR ${inspectModal.member.name}`}
                className="h-full w-full object-contain"
              />
            </div>

            <h3 className="mt-4 text-lg font-bold text-slate-900">{inspectModal.member.name}</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              <span className="font-mono font-semibold text-slate-700">
                {inspectModal.member.id}
              </span>{' '}
              · {inspectModal.member.division}
            </p>
            <p className="mt-3 text-xs text-slate-500">
              Arahkan kamera HP scanner ke kode QR di atas untuk mencatat kehadiran.
            </p>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Hapus User?"
        description={
          pendingDelete
            ? `${pendingDelete.name} (${pendingDelete.id}) akan dihapus dari daftar user. Riwayat absensi lama tetap tersimpan.`
            : ''
        }
        confirmLabel="Hapus User"
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            onDeleteMember(pendingDelete.id);
            setPendingDelete(null);
          }
        }}
      />
    </div>
  );
};
