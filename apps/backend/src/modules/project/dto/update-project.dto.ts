import { IsHexColor, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Nome do projeto deve ter ao menos 3 caracteres.' })
  @MaxLength(80, { message: 'Nome do projeto deve ter no máximo 80 caracteres.' })
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Descrição deve ter no máximo 1000 caracteres.' })
  description?: string;

  @IsOptional()
  @IsHexColor({ message: 'Cor do projeto deve ser um hexadecimal.' })
  color?: string;
}
