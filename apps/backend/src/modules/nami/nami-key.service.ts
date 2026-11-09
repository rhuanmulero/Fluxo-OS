import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

@Injectable()
export class NamiKeyService {
  constructor(private readonly config: ConfigService) {}

  private key(): Buffer {
    const value = this.config.get<string>('NAMI_ENCRYPTION_KEY') ?? '';
    if (!/^[a-f0-9]{64}$/i.test(value)) {
      throw new ServiceUnavailableException('A proteção das chaves da Nami ainda não foi configurada no servidor.');
    }
    return Buffer.from(value, 'hex');
  }

  encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString('base64')).join('.');
  }

  decrypt(value: string): string {
    const [iv, tag, encrypted] = value.split('.').map(part => Buffer.from(part, 'base64'));
    try {
      if (!iv || !tag || !encrypted) throw new Error('Formato inválido');
      const decipher = createDecipheriv('aes-256-gcm', this.key(), iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    } catch {
      throw new ServiceUnavailableException('Não foi possível abrir a chave da Nami. Configure sua chave novamente.');
    }
  }
}
