import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../common/authorization/auth.guard';
import { AuthenticatedUser } from '../../common/authorization/authenticated-user';
import { CurrentUser } from '../../common/authorization/current-user.decorator';
import { PermissionGuard } from '../../common/authorization/permission.guard';
import { RequireWorkspaceRole } from '../../common/authorization/require-workspace-role.decorator';
import { CreateInviteDto } from './dto/create-invite.dto';
import { InviteResponseDto } from './dto/invite-response.dto';
import { InviteService } from './invite.service';

@Controller()
@UseGuards(AuthGuard, PermissionGuard)
export class InviteController {
  constructor(private readonly invites: InviteService) {}

  @Get('workspaces/:workspaceId/invites')
  @RequireWorkspaceRole('ADMIN')
  list(@Param('workspaceId') workspaceId: string): Promise<InviteResponseDto[]> {
    return this.invites.listFor(workspaceId);
  }

  @Post('workspaces/:workspaceId/invites')
  @RequireWorkspaceRole('SUPERADMIN')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateInviteDto,
  ): Promise<InviteResponseDto> {
    return this.invites.create(workspaceId, user.id, dto);
  }

  @Delete('workspaces/:workspaceId/invites/:inviteId')
  @RequireWorkspaceRole('SUPERADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(@Param('inviteId') inviteId: string): Promise<void> {
    return this.invites.revoke(inviteId);
  }

  @Post('invites/:code/accept')
  accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param('code') code: string,
  ): Promise<InviteResponseDto> {
    return this.invites.accept(code, user.id);
  }
}
