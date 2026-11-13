import { IsBoolean, ValidateIf, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class NamiSettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(20)
  @MaxLength(256)
  @Matches(/^\S+$/, { message: 'A chave não pode conter espaços.' })
  apiKey?: string;

  @IsString()
  @Matches(/^gemini-[a-z0-9.-]+$/, { message: 'Informe um modelo Gemini válido.' })
  @MaxLength(100)
  model!: string;
}

export class NamiMessageDto {
  @IsString()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @MinLength(1)
  @MaxLength(8000)
  message!: string;

  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;
}

export class UpdateNamiConversationDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @MinLength(1)
  @MaxLength(80)
  title?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsBoolean()
  pinned?: boolean;
}
