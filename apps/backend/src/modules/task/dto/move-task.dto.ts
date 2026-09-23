import { IsInt, IsUUID, Min } from 'class-validator';

export class MoveTaskDto {
  @IsUUID(undefined, { message: 'Coluna de destino inválida.' })
  columnId!: string;

  @IsInt({ message: 'Posição deve ser um inteiro.' })
  @Min(0, { message: 'Posição não pode ser negativa.' })
  position!: number;
}
