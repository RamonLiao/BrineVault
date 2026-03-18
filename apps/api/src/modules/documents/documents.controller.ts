import { Controller, Get, Post, Delete, Param, Body, Query } from '@nestjs/common';
import { DocumentsService } from './documents.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { createDocumentSchema, addVersionSchema, archiveDocumentSchema } from './documents.schemas.js';
import { paginationParamsSchema } from '@rwa-dataroom/shared';

interface JwtPayload {
  sub: string;
  address: string;
  orgId: string | null;
  orgRole: number;
  sid: string;
  jti: string;
  iat: number;
  exp: number;
}

@Controller('pools/:poolId/documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  async list(
    @Param('poolId') poolId: string,
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(paginationParamsSchema)) query: any,
  ) {
    return this.documentsService.listDocuments(poolId, user.orgId, query);
  }

  @Post()
  async create(
    @Param('poolId') poolId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(createDocumentSchema)) dto: any,
  ) {
    return this.documentsService.buildCreateDocument(poolId, user.address, user.orgId, dto);
  }

  @Get(':docId')
  async findOne(
    @Param('poolId') poolId: string,
    @Param('docId') docId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.documentsService.getDocument(poolId, docId, user.orgId);
  }

  @Post(':docId/versions')
  async addVersion(
    @Param('poolId') poolId: string,
    @Param('docId') docId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(addVersionSchema)) dto: any,
  ) {
    return this.documentsService.buildAddVersion(poolId, docId, user.address, user.orgId, dto);
  }

  @Delete(':docId')
  async archive(
    @Param('poolId') poolId: string,
    @Param('docId') docId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(archiveDocumentSchema)) dto: any,
  ) {
    return this.documentsService.buildArchiveDocument(poolId, docId, user.address, user.orgId, dto);
  }

  @Get(':docId/versions')
  async listVersions(
    @Param('poolId') poolId: string,
    @Param('docId') docId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.documentsService.getDocumentVersions(poolId, docId, user.orgId);
  }

  @Get(':docId/versions/:version')
  async getVersion(
    @Param('poolId') poolId: string,
    @Param('docId') docId: string,
    @Param('version') version: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.documentsService.getDocumentVersion(poolId, docId, parseInt(version, 10), user.orgId);
  }
}
