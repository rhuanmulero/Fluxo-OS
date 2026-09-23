import { IsString, Length } from 'class-validator';

export class AddProjectMemberDto {
  @IsString({ message: 'Identificador de usuário inválido.' })
  @Length(1, 64, { message: 'Identificador de usuário inválido.' })
  userId!: string;
}
