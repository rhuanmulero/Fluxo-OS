import { IsEmail, IsIn, IsOptional } from 'class-validator';
import { WorkspaceRoleName } from '../../../common/authorization/workspace-role';

export class CreateInviteDto {
  @IsIn(['SUPERADMIN', 'ADMIN', 'MEMBER'], {
    message: 'Papel do convite deve ser SUPERADMIN, ADMIN ou MEMBER.',
  })
  role!: Exclude<WorkspaceRoleName, 'OWNER'>;

  @IsOptional()
  @IsEmail({}, { message: 'E-mail do convite é inválido.' })
  email?: string;
}
