import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createReadStream, ReadStream } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { FileStorage, StoredFile, UploadedFile } from './file-storage';

const MAX_EXTENSION_LENGTH = 10;

@Injectable()
export class DiskFileStorage implements FileStorage {
  constructor(private readonly root: string) {}

  async save(workspaceId: string, file: UploadedFile): Promise<StoredFile> {
    const extension = extname(file.originalName).toLowerCase().slice(0, MAX_EXTENSION_LENGTH);
    const storageKey = `${workspaceId}/${randomUUID()}${extension}`;
    const target = join(this.root, storageKey);

    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.buffer);

    return { storageKey, sizeBytes: file.buffer.byteLength };
  }

  read(storageKey: string): ReadStream {
    return createReadStream(join(this.root, storageKey));
  }

  async remove(storageKey: string): Promise<void> {
    await unlink(join(this.root, storageKey));
  }
}
