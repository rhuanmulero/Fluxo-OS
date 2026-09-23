import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../common/authorization/auth.guard';
import { AuthenticatedUser } from '../../common/authorization/authenticated-user';
import { CurrentUser } from '../../common/authorization/current-user.decorator';
import { PermissionGuard } from '../../common/authorization/permission.guard';
import { RequireWorkspaceRole } from '../../common/authorization/require-workspace-role.decorator';
import { CreateEventDto } from './dto/create-event.dto';
import { EventFilterDto } from './dto/event-filter.dto';
import { EventResponseDto } from './dto/event-response.dto';
import { SetEventVisibilityDto } from './dto/set-event-visibility.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventService } from './event.service';

@Controller('workspaces/:workspaceId/events')
@UseGuards(AuthGuard, PermissionGuard)
@RequireWorkspaceRole('MEMBER')
export class EventController {
  constructor(private readonly events: EventService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Query() filter: EventFilterDto,
  ): Promise<EventResponseDto[]> {
    return this.events.list(workspaceId, user.id, filter);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateEventDto,
  ): Promise<EventResponseDto> {
    return this.events.create(workspaceId, user.id, dto);
  }

  @Patch(':eventId/visibility')
  setVisibility(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('eventId') eventId: string,
    @Body() dto: SetEventVisibilityDto,
  ): Promise<EventResponseDto> {
    return this.events.setVisibility(workspaceId, user.id, eventId, dto);
  }

  @Patch(':eventId')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('eventId') eventId: string,
    @Body() dto: UpdateEventDto,
  ): Promise<EventResponseDto> {
    return this.events.update(workspaceId, user.id, eventId, dto);
  }

  @Delete(':eventId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('eventId') eventId: string,
  ): Promise<void> {
    return this.events.remove(workspaceId, user.id, eventId);
  }
}
