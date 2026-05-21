import { FileCategory } from './types';

/**
 * Formats standard bytes into human readable format (KB, MB, GB, etc.)
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Categorizes a file by its MIME type or extension.
 */
export function determineFileCategory(mimeType: string, filename: string): FileCategory {
  if (mimeType.startsWith('image/')) {
    return 'image';
  }

  const extension = filename.split('.').pop()?.toLowerCase() || '';
  
  // Checking document mimeTypes and typical extensions
  const docExtensions = ['pdf', 'txt', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'md', 'json', 'rtf', 'odt', 'ods', 'odp'];
  const docMimePrefixes = ['text/', 'application/pdf', 'application/msword', 'application/vnd.'];

  if (
    docExtensions.includes(extension) || 
    docMimePrefixes.some(prefix => mimeType.startsWith(prefix))
  ) {
    return 'document';
  }

  return 'other';
}

/**
 * Checks if a file is previewable as plain text.
 */
export function isTextFile(mimeType: string, filename: string): boolean {
  if (mimeType.startsWith('text/')) return true;
  
  const textExtensions = ['txt', 'md', 'json', 'csv', 'xml', 'js', 'jsx', 'ts', 'tsx', 'css', 'html', 'yaml', 'yml', 'ini', 'log'];
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  
  return textExtensions.includes(extension);
}

/**
 * Generates a clean preview URL from a File or Blob.
 * Remember to call URL.revokeObjectURL(url) to release memory.
 */
export function createPreviewUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}
