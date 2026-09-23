import { IsBoolean } from 'class-validator';

export class ReviewSnippetDto {
  @IsBoolean({ message: 'Informe se a publicação foi aprovada.' })
  approve!: boolean;
}
