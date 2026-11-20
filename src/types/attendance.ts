export type AttendanceStatus = 'Hadir' | 'Izin' | 'Sakit';

export type ScanMode = 'checkin' | 'checkout';

export type ScanMethod = 'QR Kamera' | 'Foto Wajah' | 'Input Manual';

export type ActiveTab = 'scanner' | 'rekap' | 'anggota' | 'ekspor';

export type UserAccessRole = 'member' | 'admin';

export type DrivePhotoStatus = 'none' | 'local' | 'uploading' | 'synced' | 'error';

export interface Member {
  id: string;
  name: string;
  division: string;
  position?: string;
  pin?: string; // Optional personal PIN for viewing own records
  active?: boolean;
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  memberId: string;
  memberName: string;
  division: string;
  date: string; // YYYY-MM-DD
  checkInTime: string; // HH:mm:ss
  checkOutTime: string | null; // HH:mm:ss | null
  status: AttendanceStatus;
  sessionName: string;
  method: ScanMethod;
  updatedAt: string;
  photoDataUrl?: string | null;
  drivePhotoId?: string | null;
  drivePhotoUrl?: string | null;
  drivePhotoStatus?: DrivePhotoStatus;
}

export interface SessionConfig {
  sessionName: string;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  autoCapturePhoto: boolean;
  autoUploadPhotoToDrive: boolean;
  adminPasswordHash?: string;
  isDefaultPassword?: boolean;
}

export interface ScanFeedback {
  type: 'success' | 'warning' | 'error';
  title: string;
  detail: string;
  timestamp: string;
  photoDataUrl?: string | null;
}

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
  size?: string;
}
