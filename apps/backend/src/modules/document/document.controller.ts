import {
  BadRequestException,
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
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AuthGuard } from '../../common/authorization/auth.guard';
import { AuthenticatedUser } from '../../common/authorization/authenticated-user';
import { CurrentUser } from '../../common/authorization/current-user.decorator';
import { PermissionGuard } from '../../common/authorization/permission.guard';
import { PermissionResolver } from '../../common/authorization/permission.resolver';
import { RequireWorkspaceRole } from '../../common/authorization/require-workspace-role.decorator';
import { CreateDocumentDto } from './dto/create-document.dto';
import { DocumentFilterDto } from './dto/document-filter.dto';
import { DocumentResponseDto } from './dto/document-response.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { DocumentService, MAX_DOCUMENT_BYTES } from './document.service';

interface MultipartFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

@Controller('workspaces/:workspaceId/documents')
@UseGuards(AuthGuard, PermissionGuard)
@RequireWorkspaceRole('MEMBER')
export class DocumentController {
  constructor(
    private readonly documents: DocumentService,
    private readonly permissions: PermissionResolver,
  ) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Query() filter: DocumentFilterDto,
  ): Promise<DocumentResponseDto[]> {
    return this.documents.list(workspaceId, user.id, filter);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_DOCUMENT_BYTES } }))
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateDocumentDto,
    @UploadedFile() file?: MultipartFile,
  ): Promise<DocumentResponseDto> {
    if (!file) {
      throw new BadRequestException('Envie um arquivo.');
    }

    const role = await this.permissions.roleIn(workspaceId, user.id);

    return this.documents.create(workspaceId, user.id, role, dto, {
      originalName: file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer,
    });
  }

  @Get(':documentId/download')
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('documentId') documentId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const { document, stream } = await this.documents.openDownload(
      workspaceId,
      user.id,
      documentId,
    );

    response.set({
      'Content-Type': document.mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(document.fileName)}"`,
    });

    return new StreamableFile(stream);
  }

  @Patch(':documentId')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('documentId') documentId: string,
    @Body() dto: UpdateDocumentDto,
  ): Promise<DocumentResponseDto> {
    const role = await this.permissions.roleIn(workspaceId, user.id);

    return this.documents.update(workspaceId, user.id, role, documentId, dto);
  }

  @Delete(':documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('documentId') documentId: string,
  ): Promise<void> {
    const role = await this.permissions.roleIn(workspaceId, user.id);

    await this.documents.remove(workspaceId, user.id, role, documentId);
  }
}
