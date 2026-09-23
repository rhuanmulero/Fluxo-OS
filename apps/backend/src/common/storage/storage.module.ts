import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../config/environment-variables';
import { DiskFileStorage } from './disk-file-storage';
import { FILE_STORAGE } from './file-storage';

@Module({
  providers: [
    {
      provide: FILE_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) =>
        new DiskFileStorage(config.get('VAULT_STORAGE_DIR', { infer: true })),
    },
  ],
  exports: [FILE_STORAGE],
})
export class StorageModule {}
