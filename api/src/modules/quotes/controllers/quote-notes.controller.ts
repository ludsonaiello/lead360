import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Request,
  Query,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { QuoteNotesService } from '../services/quote-notes.service';
import {
  CreateQuoteNoteDto,
  UpdateQuoteNoteDto,
  QuoteNoteResponseDto,
  QuoteNotesListResponseDto,
} from '../dto/notes';

/**
 * QuoteNotesController
 *
 * Manages notes attached to quotes
 * Provides full CRUD operations with user tracking and timestamps
 */
@ApiTags('Quotes - Notes')
@Controller('quotes')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class QuoteNotesController {
  constructor(private readonly notesService: QuoteNotesService) {}

  /**
   * Create a new note for a quote
   */
  @Post(':id/notes')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add a note to a quote',
    description:
      'Creates a new note attached to a quote with automatic user tracking and timestamps',
  })
  @ApiParam({
    name: 'id',
    description: 'Quote UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 201,
    description: 'Note created successfully',
    type: QuoteNoteResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Note text is empty or exceeds 5000 characters',
  })
  @ApiResponse({
    status: 404,
    description: 'Quote not found or access denied',
  })
  async createNote(
    @Request() req,
    @Param('id', ParseUUIDPipe) quoteId: string,
    @Body() createNoteDto: CreateQuoteNoteDto,
  ): Promise<QuoteNoteResponseDto> {
    return this.notesService.create(
      req.user.tenant_id,
      quoteId,
      req.user.id,
      createNoteDto,
    );
  }

  /**
   * Get all notes for a quote
   */
  @Get(':id/notes')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Field')
  @ApiOperation({
    summary: 'List all notes for a quote',
    description:
      'Returns all notes for a quote, ordered by pinned status and creation date (newest first)',
  })
  @ApiParam({
    name: 'id',
    description: 'Quote UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page',
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: 'List of notes',
    type: QuoteNotesListResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Quote not found or access denied',
  })
  async findAllNotes(
    @Request() req,
    @Param('id', ParseUUIDPipe) quoteId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<QuoteNotesListResponseDto> {
    return this.notesService.findAllByQuote(
      req.user.tenant_id,
      quoteId,
      page,
      limit,
    );
  }

  /**
   * Update a quote note
   */
  @Patch(':id/notes/:noteId')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({
    summary: 'Update a quote note',
    description: 'Updates note text and/or pinned status',
  })
  @ApiParam({
    name: 'id',
    description: 'Quote UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'noteId',
    description: 'Note UUID',
    example: '987e6543-e89b-12d3-a456-426614174111',
  })
  @ApiResponse({
    status: 200,
    description: 'Note updated successfully',
    type: QuoteNoteResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Note text is empty or exceeds 5000 characters',
  })
  @ApiResponse({
    status: 404,
    description: 'Note not found or access denied',
  })
  async updateNote(
    @Request() req,
    @Param('id', ParseUUIDPipe) quoteId: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Body() updateNoteDto: UpdateQuoteNoteDto,
  ): Promise<QuoteNoteResponseDto> {
    return this.notesService.update(
      req.user.tenant_id,
      quoteId,
      noteId,
      req.user.id,
      updateNoteDto,
    );
  }

  /**
   * Delete a quote note
   */
  @Delete(':id/notes/:noteId')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a quote note',
    description: 'Permanently deletes a note from a quote',
  })
  @ApiParam({
    name: 'id',
    description: 'Quote UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'noteId',
    description: 'Note UUID',
    example: '987e6543-e89b-12d3-a456-426614174111',
  })
  @ApiResponse({
    status: 204,
    description: 'Note deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Note not found or access denied',
  })
  async deleteNote(
    @Request() req,
    @Param('id', ParseUUIDPipe) quoteId: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
  ): Promise<void> {
    await this.notesService.delete(
      req.user.tenant_id,
      quoteId,
      noteId,
      req.user.id,
    );
  }
}
