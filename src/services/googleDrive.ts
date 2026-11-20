import { DriveFileItem } from '../types/attendance';

const ROOT_FOLDER_NAME = 'HadirScan Absensi';
const PHOTO_FOLDER_NAME = 'Foto Wajah';

async function driveFetch(url: string, accessToken: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    let errMessage = `Google Drive error (${res.status})`;
    try {
      const errJson = await res.json();
      if (errJson?.error?.message) {
        errMessage = errJson.error.message;
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(errMessage);
  }
  return res;
}

export async function findOrCreateFolder(
  accessToken: string,
  folderName: string,
  parentId?: string
): Promise<string> {
  const parentClause = parentId ? ` and '${parentId}' in parents` : '';
  const query = `name='${folderName.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentClause}`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    query
  )}&fields=files(id,name)&pageSize=1`;

  const searchRes = await driveFetch(searchUrl, accessToken);
  const searchData = await searchRes.json();
  if (Array.isArray(searchData.files) && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  const metadata: { name: string; mimeType: string; parents?: string[] } = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) {
    metadata.parents = [parentId];
  }

  const createRes = await driveFetch('https://www.googleapis.com/drive/v3/files?fields=id', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata),
  });
  const created = await createRes.json();
  return created.id;
}

export async function ensureAppFolders(
  accessToken: string
): Promise<{ rootFolderId: string; photoFolderId: string }> {
  const rootFolderId = await findOrCreateFolder(accessToken, ROOT_FOLDER_NAME);
  const photoFolderId = await findOrCreateFolder(accessToken, PHOTO_FOLDER_NAME, rootFolderId);
  return { rootFolderId, photoFolderId };
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64Data] = dataUrl.split(',');
  const mimeMatch = header.match(/data:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

async function multipartUpload(
  accessToken: string,
  metadata: Record<string, unknown>,
  contentBlob: Blob,
  contentType: string
): Promise<DriveFileItem> {
  const boundary = `hadirscan_boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const metaPart =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${contentType}\r\n\r\n`;
  const closingPart = `\r\n--${boundary}--`;

  const multipartBody = new Blob([metaPart, contentBlob, closingPart], {
    type: `multipart/related; boundary=${boundary}`,
  });

  const res = await driveFetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime,webViewLink,size',
    accessToken,
    {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  );
  return res.json();
}

export async function uploadFacePhotoToDrive(
  accessToken: string,
  photoDataUrl: string,
  fileName: string
): Promise<DriveFileItem> {
  const { photoFolderId } = await ensureAppFolders(accessToken);
  const blob = dataUrlToBlob(photoDataUrl);
  return multipartUpload(
    accessToken,
    {
      name: fileName,
      parents: [photoFolderId],
      description: 'Foto wajah absensi HadirScan',
    },
    blob,
    'image/jpeg'
  );
}

export async function findDriveFileByName(
  accessToken: string,
  fileName: string,
  folderId: string
): Promise<DriveFileItem | null> {
  const query = `name='${fileName.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed=false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    query
  )}&fields=files(id,name,mimeType,modifiedTime,webViewLink,size)&pageSize=1`;
  const res = await driveFetch(url, accessToken);
  const data = await res.json();
  if (Array.isArray(data.files) && data.files.length > 0) {
    return data.files[0];
  }
  return null;
}

export async function createOrUpdateTextFileInDrive(
  accessToken: string,
  fileName: string,
  content: string,
  mimeType: string,
  existingFileId?: string | null
): Promise<DriveFileItem> {
  const { rootFolderId } = await ensureAppFolders(accessToken);
  const targetId = existingFileId ?? (await findDriveFileByName(accessToken, fileName, rootFolderId))?.id;

  if (targetId) {
    const res = await driveFetch(
      `https://www.googleapis.com/upload/drive/v3/files/${targetId}?uploadType=media&fields=id,name,mimeType,modifiedTime,webViewLink,size`,
      accessToken,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': mimeType,
        },
        body: content,
      }
    );
    return res.json();
  }

  const blob = new Blob([content], { type: mimeType });
  return multipartUpload(
    accessToken,
    {
      name: fileName,
      parents: [rootFolderId],
    },
    blob,
    mimeType
  );
}

export async function listAppDriveFiles(accessToken: string): Promise<{
  rootFolderId: string;
  files: DriveFileItem[];
}> {
  const { rootFolderId, photoFolderId } = await ensureAppFolders(accessToken);
  const query = `('${rootFolderId}' in parents or '${photoFolderId}' in parents) and trashed=false and mimeType!='application/vnd.google-apps.folder'`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    query
  )}&orderBy=modifiedTime desc&pageSize=30&fields=files(id,name,mimeType,modifiedTime,webViewLink,size)`;
  const res = await driveFetch(url, accessToken);
  const data = await res.json();
  return {
    rootFolderId,
    files: Array.isArray(data.files) ? data.files : [],
  };
}

export async function deleteDriveFile(accessToken: string, fileId: string): Promise<void> {
  await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, accessToken, {
    method: 'DELETE',
  });
}
