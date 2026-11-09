import { ConfigService } from '@nestjs/config';
import { NamiKeyService } from './nami-key.service';

describe('Proteção de chaves da Nami', () => {
  const service = () => new NamiKeyService(new ConfigService({ NAMI_ENCRYPTION_KEY: 'ab'.repeat(32) }));
  it('protege a chave com nonce diferente a cada gravação e permite recuperá-la', () => {
    const keys = service();
    const first = keys.encrypt('segredo-gemini');
    expect(first).not.toContain('segredo-gemini');
    expect(keys.encrypt('segredo-gemini')).not.toBe(first);
    expect(keys.decrypt(first)).toBe('segredo-gemini');
  });
  it('rejeita conteúdo adulterado e outra chave de criptografia', () => {
    const encrypted = service().encrypt('segredo');
    const other = new NamiKeyService(new ConfigService({ NAMI_ENCRYPTION_KEY: 'cd'.repeat(32) }));
    expect(() => other.decrypt(encrypted)).toThrow();
    expect(() => service().decrypt('invalido')).toThrow();
  });
  it('não permite persistir chaves sem proteção configurada', () => {
    expect(() => new NamiKeyService(new ConfigService()).encrypt('segredo')).toThrow('não foi configurada');
  });
});
