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
  // Build relative URL to the upload endpoint
  return `${UPLOAD_DIR}/${storedName}`;
}
