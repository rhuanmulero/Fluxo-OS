import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateWorkspaceDto {
  @IsString()
  @MinLength(3, { message: 'Nome do workspace deve ter ao menos 3 caracteres.' })
  @MaxLength(80, { message: 'Nome do workspace deve ter no máximo 80 caracteres.' })
  name!: string;
}
