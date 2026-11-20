import { AttendanceRecord, Member, SessionConfig } from '../types/attendance';

const STORAGE_KEYS = {
  MEMBERS: 'hadirscan_members_v1',
  RECORDS: 'hadirscan_records_v1',
  CONFIG: 'hadirscan_config_v1',
};

export const DEFAULT_CONFIG: SessionConfig = {
  sessionName: 'Shift 1',
  soundEnabled: true,
  vibrationEnabled: true,
  autoCapturePhoto: true,
  autoUploadPhotoToDrive: true,
  isDefaultPassword: true,
};

export const STARTER_MEMBERS: Member[] = [
  {
    id: 'ANG-001',
    name: 'Budi Santoso',
    division: 'Operasional',
    position: 'Staf',
    active: true,
    createdAt: '2026-01-10T08:00:00Z',
  },
  {
    id: 'ANG-002',
    name: 'Siti Rahmawati',
    division: 'Keuangan',
    position: 'Staf',
    active: true,
    createdAt: '2026-01-10T08:00:00Z',
  },
  {
    id: 'ANG-003',
    name: 'Andi Wijaya',
    division: 'Teknologi',
    position: 'Engineer',
    active: true,
    createdAt: '2026-01-10T08:00:00Z',
  },
  {
    id: 'ANG-004',
    name: 'Dewi Lestari',
    division: 'Pemasaran',
    position: 'Staf',
    active: true,
    createdAt: '2026-01-10T08:00:00Z',
  },
  {
    id: 'ANG-005',
    name: 'Rizky Pratama',
    division: 'Teknologi',
    position: 'Support',
    active: true,
    createdAt: '2026-01-10T08:00:00Z',
  },
  {
    id: 'ANG-006',
    name: 'Nadia Putri',
    division: 'Operasional',
    position: 'Koordinator',
    active: true,
    createdAt: '2026-01-10T08:00:00Z',
  },
];

export function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLocalTimeString(date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

export function loadMembers(): Member[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MEMBERS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(STARTER_MEMBERS));
      return STARTER_MEMBERS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : STARTER_MEMBERS;
  } catch {
    return STARTER_MEMBERS;
  }
}

export function saveMembers(members: Member[]): void {
  localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members));
}

export function loadRecords(): AttendanceRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RECORDS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRecords(records: AttendanceRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(records));
  } catch {
    const trimmed = records.map((r, idx) =>
      idx > 25 && r.drivePhotoUrl ? { ...r, photoDataUrl: null } : r
    );
    try {
      localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(trimmed));
    } catch {
      const minimal = records.map((r, idx) => (idx > 15 ? { ...r, photoDataUrl: null } : r));
      localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(minimal));
    }
  }
}

export function loadConfig(): SessionConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config: SessionConfig): void {
  localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
}

function escapeCsvCell(value: string | null | undefined): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsvString(records: AttendanceRecord[]): string {
  const headers = [
    'Tanggal',
    'ID Anggota',
    'Nama Lengkap',
    'Divisi / Kelas',
    'Sesi',
    'Jam Masuk',
    'Jam Pulang',
    'Status',
    'Metode Scan',
    'Link Foto Drive',
  ];

  const rows = records.map((r) => [
    r.date,
    r.memberId,
    r.memberName,
    r.division,
    r.sessionName,
    r.checkInTime,
    r.checkOutTime ?? '-',
    r.status,
    r.method,
    r.drivePhotoUrl ?? '-',
  ]);

  return (
    '\uFEFF' +
    [headers, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\r\n')
  );
}

export function exportRecordsToCsv(records: AttendanceRecord[], filename: string): void {
  const csvContent = buildCsvString(records);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportFullBackupJson(
  members: Member[],
  records: AttendanceRecord[],
  config: SessionConfig
): void {
  const payload = {
    app: 'HadirScan',
    exportedAt: new Date().toISOString(),
    config,
    members,
    records,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `backup-absensi-${getLocalDateString()}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
