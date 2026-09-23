import { validateEnvironment } from './environment-variables';

const valid = {
  PORT: '3000',
  DATABASE_URL: 'postgresql://fluxo:fluxo@localhost:5433/fluxo',
  FRONTEND_URL: 'http://localhost:5173',
  BETTER_AUTH_URL: 'http://localhost:5173',
  BETTER_AUTH_SECRET: 'a'.repeat(32),
  SMTP_HOST: 'smtp.mailtrap.io',
  SMTP_PORT: '2525',
  SMTP_USER: 'fluxo',
  SMTP_PASSWORD: 'segredo',
  SMTP_FROM: 'Fluxo <nao-responda@fluxo.app>',
  VAULT_STORAGE_DIR: 'C:/fluxo-storage',
};

describe('validateEnvironment', () => {
  it('aceita um ambiente completo e converte a porta para número', () => {
    const env = validateEnvironment(valid);

    expect(env.PORT).toBe(3000);
    expect(env.BETTER_AUTH_SECRET).toHaveLength(32);
  });

  it('recusa segredo com menos de 32 caracteres', () => {
    expect(() => validateEnvironment({ ...valid, BETTER_AUTH_SECRET: 'curto' })).toThrow(
      /BETTER_AUTH_SECRET/,
    );
  });

  it('recusa DATABASE_URL que não seja postgres', () => {
    expect(() => validateEnvironment({ ...valid, DATABASE_URL: 'mysql://x/y' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('recusa ambiente sem BETTER_AUTH_SECRET', () => {
    const { BETTER_AUTH_SECRET: _omitido, ...semSegredo } = valid;

    expect(() => validateEnvironment(semSegredo)).toThrow(/BETTER_AUTH_SECRET/);
  });

  it('recusa ambiente sem SMTP_HOST', () => {
    const { SMTP_HOST: _omitido, ...semHost } = valid;

    expect(() => validateEnvironment(semHost)).toThrow(/SMTP_HOST/);
  });

  it('recusa ambiente sem SMTP_USER', () => {
    const { SMTP_USER: _omitido, ...semUsuario } = valid;

    expect(() => validateEnvironment(semUsuario)).toThrow(/SMTP_USER/);
  });

  it('recusa ambiente sem SMTP_PASSWORD', () => {
    const { SMTP_PASSWORD: _omitido, ...semSenha } = valid;

    expect(() => validateEnvironment(semSenha)).toThrow(/SMTP_PASSWORD/);
  });

  it('recusa ambiente sem SMTP_FROM', () => {
    const { SMTP_FROM: _omitido, ...semRemetente } = valid;

    expect(() => validateEnvironment(semRemetente)).toThrow(/SMTP_FROM/);
  });

  it('converte SMTP_PORT para número', () => {
    expect(validateEnvironment(valid).SMTP_PORT).toBe(2525);
  });

  it('recusa SMTP_PORT fora da faixa de portas', () => {
    expect(() => validateEnvironment({ ...valid, SMTP_PORT: '70000' })).toThrow(/SMTP_PORT/);
  });

  it('recusa ambiente sem VAULT_STORAGE_DIR', () => {
    const { VAULT_STORAGE_DIR: _omitido, ...semDiretorio } = valid;

    expect(() => validateEnvironment(semDiretorio)).toThrow(/VAULT_STORAGE_DIR/);
  });

  it('recusa VAULT_STORAGE_DIR relativo', () => {
    expect(() => validateEnvironment({ ...valid, VAULT_STORAGE_DIR: './storage' })).toThrow(
      /VAULT_STORAGE_DIR/,
    );
  });

  it('aceita caminho absoluto de Windows e de POSIX', () => {
    const windows = 'C:\\fluxo\\vault';

    expect(validateEnvironment({ ...valid, VAULT_STORAGE_DIR: windows }).VAULT_STORAGE_DIR).toBe(
      windows,
    );
    expect(
      validateEnvironment({ ...valid, VAULT_STORAGE_DIR: '/var/fluxo/vault' }).VAULT_STORAGE_DIR,
    ).toBe('/var/fluxo/vault');
  });
});
