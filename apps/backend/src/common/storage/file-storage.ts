import { ReadStream } from 'node:fs';

export const FILE_STORAGE = Symbol('FileStorage');

export interface UploadedFile {
  originalName: string;
  mimeType: string;
  buffer: Buffer;
}

export interface StoredFile {
  storageKey: string;
  sizeBytes: number;
}

export interface FileStorage {
  save(workspaceId: string, file: UploadedFile): Promise<StoredFile>;
  read(storageKey: string): ReadStream;
  remove(storageKey: string): Promise<void>;
}
