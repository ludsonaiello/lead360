import { apiClient } from './axios';
import type {
  DrawSchedule,
  CreateDrawScheduleDto,
  UpdateDrawScheduleDto,
} from '@/lib/types/quotes';

/**
 * Create draw schedule for quote
 * @endpoint POST /quotes/:quoteId/draw-schedule
 * @permission Owner, Admin, Manager, Sales
 * @param quoteId Quote UUID
 * @param dto Draw schedule creation data with entries
 * @returns Array of created draw entries (NOT full DrawSchedule object)
 * @throws 400 - Validation errors (percentages must sum to 100%, draw numbers must be sequential)
 * @throws 404 - Quote not found
 * @note API returns array of entries, not full DrawSchedule. Use getDrawSchedule to get full object.
 */
export const createDrawSchedule = async (
  quoteId: string,
  dto: CreateDrawScheduleDto
): Promise<DrawSchedule['entries']> => {
  const { data } = await apiClient.post<DrawSchedule['entries']>(
    `/quotes/${quoteId}/draw-schedule`,
    dto
  );
  return data;
};

/**
 * Get draw schedule for quote
 * @endpoint GET /quotes/:quoteId/draw-schedule
 * @permission Owner, Admin, Manager, Sales, Field
 * @param quoteId Quote UUID
 * @returns Draw schedule with all entries
 * @throws 404 - Quote not found
 */
export const getDrawSchedule = async (
  quoteId: string
): Promise<DrawSchedule> => {
  const { data } = await apiClient.get<DrawSchedule>(
    `/quotes/${quoteId}/draw-schedule`
  );
  return data;
};

/**
 * Update draw schedule (replaces entire schedule)
 * @endpoint PATCH /quotes/:quoteId/draw-schedule
 * @permission Owner, Admin, Manager, Sales
 * @param quoteId Quote UUID
 * @param dto Draw schedule update data with entries
 * @returns Array of updated draw entries (NOT full DrawSchedule object)
 * @throws 400 - Validation errors (percentages must sum to 100%, draw numbers must be sequential)
 * @throws 404 - Quote not found
 * @note API returns array of entries, not full DrawSchedule. Use getDrawSchedule to get full object.
 */
export const updateDrawSchedule = async (
  quoteId: string,
  dto: UpdateDrawScheduleDto
): Promise<DrawSchedule['entries']> => {
  const { data } = await apiClient.patch<DrawSchedule['entries']>(
    `/quotes/${quoteId}/draw-schedule`,
    dto
  );
  return data;
};

/**
 * Delete draw schedule
 * @endpoint DELETE /quotes/:quoteId/draw-schedule
 * @permission Owner, Admin, Manager, Sales
 * @param quoteId Quote UUID
 * @returns void
 * @throws 404 - Quote not found
 */
export const deleteDrawSchedule = async (quoteId: string): Promise<void> => {
  await apiClient.delete(`/quotes/${quoteId}/draw-schedule`);
};
