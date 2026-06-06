export const UPLOAD_MAX_SIZE = 25 * 1024 * 1024; // 25MB
export const UPLOAD_MAX_FILES = 5;
export const UPLOAD_POLL_INTERVAL = 2000;

export const ALLOWED_EXTENSIONS = [
  '.pdf', '.docx', '.xlsx', '.pptx',
  '.csv', '.txt', '.md', '.json',
  '.png', '.jpg', '.jpeg', '.gif', '.webp',
];

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv',
  'text/plain',
  'text/markdown',
  'application/json',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
];

const IMAGE_MIME_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
]);

export function isImageFile(mimeType) {
  return IMAGE_MIME_TYPES.has(mimeType);
}

export function getExtension(filename) {
  const idx = filename.lastIndexOf('.');
  return idx >= 0 ? filename.slice(idx).toLowerCase() : '';
}

export function validateFile(file) {
  const ext = getExtension(file.name);
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return 'File type not supported. Accepted: PDF, DOCX, XLSX, PPTX, CSV, TXT, MD, JSON, and images.';
  }
  if (file.size > UPLOAD_MAX_SIZE) {
    return 'File exceeds 25MB limit.';
  }
  return null;
}

const EXT_TO_TYPE = {
  '.pdf': 'pdf',
  '.docx': 'word',
  '.xlsx': 'excel',
  '.pptx': 'powerpoint',
  '.csv': 'text',
  '.txt': 'text',
  '.md': 'text',
  '.json': 'text',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.gif': 'image',
  '.webp': 'image',
};

export function getFileType(filename) {
  return EXT_TO_TYPE[getExtension(filename)] || 'text';
}

export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const FILE_TYPE_COLORS = {
  pdf: 'bg-red-500',
  word: 'bg-blue-500',
  excel: 'bg-green-500',
  powerpoint: 'bg-orange-500',
  text: 'bg-gray-500',
  image: 'bg-purple-500',
};

export const FILE_TYPE_LABELS = {
  pdf: 'PDF',
  word: 'DOCX',
  excel: 'XLSX',
  powerpoint: 'PPTX',
  text: 'DOC',
  image: 'IMG',
};

export const ACCEPT_STRING = ALLOWED_EXTENSIONS.join(',');

export const UPLOAD_STATUS = {
  UPLOADING: 'uploading',
  PROCESSING: 'processing',
  READY: 'processed',
  ERROR: 'error',
  EXPIRED: 'expired',
};
