import { IsEnum } from 'class-validator';
import { GovernanceMode } from '../../../common/authorization/project-module';

export class SetGovernanceDto {
  @IsEnum(GovernanceMode, {
    message: 'Paradigma deve ser MICROMANAGEMENT ou HIERARCHICAL.',
  })
  governance!: GovernanceMode;
}
