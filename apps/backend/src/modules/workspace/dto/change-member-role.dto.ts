import { IsIn } from 'class-validator';
import { WorkspaceRoleName } from '../../../common/authorization/workspace-role';

export class ChangeMemberRoleDto {
  @IsIn(['SUPERADMIN', 'ADMIN', 'MEMBER'], {
    message: 'Papel deve ser SUPERADMIN, ADMIN ou MEMBER.',
  })
  role!: Exclude<WorkspaceRoleName, 'OWNER'>;
}
