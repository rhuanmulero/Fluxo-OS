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
  UseGuards,
} from '@nestjs/common';
import { Action } from '../../common/authorization/action';
import { AuthGuard } from '../../common/authorization/auth.guard';
import { AuthenticatedUser } from '../../common/authorization/authenticated-user';
import { CurrentUser } from '../../common/authorization/current-user.decorator';
import { ModulePermissionGuard } from '../../common/authorization/module-permission.guard';
import { ProjectModule } from '../../common/authorization/project-module';
import { RequirePermission } from '../../common/authorization/require-permission.decorator';
import { CreateRoadmapDto } from './dto/create-roadmap.dto';
import { CreateStageDto } from './dto/create-stage.dto';
import { ReorderStagesDto } from './dto/reorder-stages.dto';
import { RoadmapResponseDto } from './dto/roadmap-response.dto';
import { StageResponseDto } from './dto/stage-response.dto';
import { UpdateRoadmapDto } from './dto/update-roadmap.dto';
import { UpdateStageDto } from './dto/update-stage.dto';
import { RoadmapService } from './roadmap.service';

@Controller('projects/:projectId/roadmaps')
@UseGuards(AuthGuard, ModulePermissionGuard)
export class RoadmapController {
  constructor(private readonly roadmaps: RoadmapService) {}

  @Get()
  @RequirePermission(ProjectModule.ROADMAP, Action.READ)
  list(@Param('projectId') projectId: string): Promise<RoadmapResponseDto[]> {
    return this.roadmaps.listFor(projectId);
  }

  @Post()
  @RequirePermission(ProjectModule.ROADMAP, Action.CREATE)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Body() dto: CreateRoadmapDto,
  ): Promise<RoadmapResponseDto> {
    return this.roadmaps.create(projectId, user.id, dto);
  }

  @Post(':roadmapId/stages')
  @RequirePermission(ProjectModule.ROADMAP, Action.CREATE)
  addStage(
    @Param('projectId') projectId: string,
    @Param('roadmapId') roadmapId: string,
    @Body() dto: CreateStageDto,
  ): Promise<StageResponseDto> {
    return this.roadmaps.addStage(projectId, roadmapId, dto);
  }

  @Patch(':roadmapId/stages/order')
  @RequirePermission(ProjectModule.ROADMAP, Action.UPDATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  reorderStages(
    @Param('projectId') projectId: string,
    @Param('roadmapId') roadmapId: string,
    @Body() dto: ReorderStagesDto,
  ): Promise<void> {
    return this.roadmaps.reorderStages(projectId, roadmapId, dto.orderedIds);
  }

  @Patch(':roadmapId/stages/:stageId')
  @RequirePermission(ProjectModule.ROADMAP, Action.UPDATE)
  updateStage(
    @Param('projectId') projectId: string,
    @Param('roadmapId') roadmapId: string,
    @Param('stageId') stageId: string,
    @Body() dto: UpdateStageDto,
  ): Promise<StageResponseDto> {
    return this.roadmaps.updateStage(projectId, roadmapId, stageId, dto);
  }

  @Delete(':roadmapId/stages/:stageId')
  @RequirePermission(ProjectModule.ROADMAP, Action.DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeStage(
    @Param('projectId') projectId: string,
    @Param('roadmapId') roadmapId: string,
    @Param('stageId') stageId: string,
  ): Promise<void> {
    return this.roadmaps.removeStage(projectId, roadmapId, stageId);
  }

  @Patch(':roadmapId')
  @RequirePermission(ProjectModule.ROADMAP, Action.UPDATE)
  update(
    @Param('projectId') projectId: string,
    @Param('roadmapId') roadmapId: string,
    @Body() dto: UpdateRoadmapDto,
  ): Promise<RoadmapResponseDto> {
    return this.roadmaps.update(projectId, roadmapId, dto);
  }

  @Delete(':roadmapId')
  @RequirePermission(ProjectModule.ROADMAP, Action.DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('projectId') projectId: string,
    @Param('roadmapId') roadmapId: string,
  ): Promise<void> {
    return this.roadmaps.remove(projectId, roadmapId);
  }
}
