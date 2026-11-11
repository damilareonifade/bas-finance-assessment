import { Body, Controller, Get, HttpCode, Param, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AuthenticatedUser } from '../common/auth/authenticated-user';
import { CurrentUser } from '../common/auth/auth.decorators';
import { CustomerDocumentsService, UploadedDocumentFile } from './customer-documents.service';
import { MAX_DOCUMENT_BYTES } from './document-rules';
import { RequestDocumentDto, ReviewDocumentDto, SubmitDocumentDto } from './dto/customer-document.dto';

/** KYC documents on a customer's profile. Same access as the customer: admins, or the assigned officer. */
@Controller('customers/:customerId/documents')
export class CustomerDocumentsController {
  constructor(private readonly documents: CustomerDocumentsService) {}

  @Get()
  list(@Param('customerId') customerId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.documents.list(user, customerId);
  }

  @Post('requests')
  request(@Param('customerId') customerId: string, @Body() body: RequestDocumentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.documents.request(user, customerId, body.type, body.note);
  }

  /** multipart/form-data: type, identifier?, file? (the size check below is the friendly one; Multer's cap is a hard stop). */
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_DOCUMENT_BYTES + 1024 * 1024, files: 1 } }))
  submit(
    @Param('customerId') customerId: string,
    @Body() body: SubmitDocumentDto,
    @UploadedFile() file: UploadedDocumentFile | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documents.submit(user, customerId, body.type, body.identifier, file);
  }

  @Get(':documentId')
  get(@Param('customerId') customerId: string, @Param('documentId') documentId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.documents.get(user, customerId, documentId);
  }

  @Post(':documentId/review')
  @HttpCode(200)
  review(@Param('customerId') customerId: string, @Param('documentId') documentId: string, @Body() body: ReviewDocumentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.documents.review(user, customerId, documentId, body.decision, body.note);
  }

  @Get(':documentId/file')
  async download(@Param('customerId') customerId: string, @Param('documentId') documentId: string, @CurrentUser() user: AuthenticatedUser, @Res() response: Response): Promise<void> {
    const { absolutePath, fileName, mime } = await this.documents.filePathFor(user, customerId, documentId);
    response.setHeader('Content-Type', mime);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Disposition', `inline; filename="${fileName.replace(/[^\w.\- ]/g, '_')}"`);
    response.sendFile(absolutePath);
  }
}
