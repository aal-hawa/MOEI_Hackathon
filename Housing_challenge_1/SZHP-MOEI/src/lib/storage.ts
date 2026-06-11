/**
 * Storage utility for resolving stored file URLs
 */

const UPLOAD_DIR = '/uploads';

/**
 * Resolve a stored file name to a URL that can be accessed by the browser
 */
export function resolveStoredFileUrl(storedName: string): string {
  if (!storedName) return '';
  // If already a full URL, return as-is
  if (storedName.startsWith('http://') || storedName.startsWith('https://')) {
    return storedName;
  }
  // Build relative URL to the upload API endpoint
  return `${UPLOAD_DIR}/${storedName}`;
}

/**
 * Get the absolute filesystem path for a stored file
 */
export function getStoredFilePath(storedName: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path');
  return path.join(process.cwd(), 'uploads', storedName);
}
