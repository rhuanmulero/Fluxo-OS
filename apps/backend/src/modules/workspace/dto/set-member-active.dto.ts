import { IsBoolean } from 'class-validator';

export class SetMemberActiveDto {
  @IsBoolean({ message: 'Ativo deve ser verdadeiro ou falso.' })
  active!: boolean;
}
