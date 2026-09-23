import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class ReorderColumnsDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'Informe a ordem das colunas.' })
  @IsUUID(undefined, { each: true, message: 'Identificador de coluna inválido.' })
  orderedIds!: string[];
}
