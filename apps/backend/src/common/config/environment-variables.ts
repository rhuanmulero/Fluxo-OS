import { plainToInstance, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsUrl,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export class EnvironmentVariables {
  @Type(() => Number)
  @IsInt({ message: 'PORT deve ser um número inteiro.' })
  @Min(1)
  @Max(65535)
  PORT = 3000;

  @Matches(/^postgres(ql)?:\/\/.+/, {
    message: 'DATABASE_URL deve ser uma URL postgresql://.',
  })
  DATABASE_URL!: string;

  @IsUrl({ require_tld: false }, { message: 'FRONTEND_URL deve ser uma URL válida.' })
  FRONTEND_URL!: string;

  @IsUrl({ require_tld: false }, { message: 'BETTER_AUTH_URL deve ser uma URL válida.' })
  BETTER_AUTH_URL!: string;

  @MinLength(32, {
    message: 'BETTER_AUTH_SECRET deve ter ao menos 32 caracteres.',
  })
  BETTER_AUTH_SECRET!: string;

  @IsNotEmpty({ message: 'SMTP_HOST é obrigatório.' })
  SMTP_HOST!: string;

  @Type(() => Number)
  @IsInt({ message: 'SMTP_PORT deve ser um número inteiro.' })
  @Min(1, { message: 'SMTP_PORT deve estar entre 1 e 65535.' })
  @Max(65535, { message: 'SMTP_PORT deve estar entre 1 e 65535.' })
  SMTP_PORT!: number;

  @IsNotEmpty({ message: 'SMTP_USER é obrigatório.' })
  SMTP_USER!: string;

  @IsNotEmpty({ message: 'SMTP_PASSWORD é obrigatório.' })
  SMTP_PASSWORD!: string;

  @IsNotEmpty({ message: 'SMTP_FROM é obrigatório.' })
  SMTP_FROM!: string;

  @Matches(/^([A-Za-z]:[\\/]|\/).+/, {
    message: 'VAULT_STORAGE_DIR deve ser um caminho absoluto.',
  })
  VAULT_STORAGE_DIR!: string;
}

export function validateEnvironment(raw: Record<string, unknown>): EnvironmentVariables {
  const parsed = plainToInstance(EnvironmentVariables, raw, {
    enableImplicitConversion: false,
  });

  const errors = validateSync(parsed, { skipMissingProperties: false });

  if (errors.length > 0) {
    const detail = errors
      .map((error) => Object.values(error.constraints ?? {}).join(' '))
      .join(' ');
    throw new Error(`Configuração de ambiente inválida: ${detail}`);
  }

  return parsed;
}
