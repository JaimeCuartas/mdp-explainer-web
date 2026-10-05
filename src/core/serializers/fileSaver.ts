// Minimal ambient types for the File System Access API (not yet in TypeScript's
// bundled DOM lib). Only the subset this file actually calls.
interface FileSystemWritableFileStream {
  write(data: BlobPart): Promise<void>;
  close(): Promise<void>;
}

interface FileSystemFileHandle {
  createWritable(): Promise<FileSystemWritableFileStream>;
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: { description?: string; accept: Record<string, string[]> }[];
}

declare global {
  interface Window {
    showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
  }
}

export interface SaveTextFileOptions {
  description: string;
  mimeType: string;
  extensions: string[];
}

/**
 * Saves text content to a file, letting the user pick the destination folder
 * and filename via the native File System Access API where available, and
 * falling back to a plain browser download (Firefox, Safari) otherwise.
 */
export async function saveTextToFile(content: string, fileName: string, options: SaveTextFileOptions): Promise<void> {
  if (typeof window.showSaveFilePicker === 'function') {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [{ description: options.description, accept: { [options.mimeType]: options.extensions } }],
      });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      throw error;
    }
  }

  const blob = new Blob([content], { type: options.mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function sanitizeFileName(title: string): string {
  const trimmed = title.trim();
  const base = trimmed.length > 0 ? trimmed : 'untitled';
  return base.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
}
