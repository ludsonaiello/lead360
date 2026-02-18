import {
  IsBoolean,
  IsString,
  IsArray,
  IsInt,
  Min,
  Max,
  IsObject,
  IsIn,
  IsUrl,
  Matches,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
  IsNotEmpty,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * Valid IVR action types
 */
export const IVR_ACTION_TYPES = [
  'route_to_number',
  'route_to_default',
  'trigger_webhook',
  'voicemail',
  'voice_ai',
] as const;

export type IvrActionType = (typeof IVR_ACTION_TYPES)[number];

/**
 * IVR Menu Option Configuration
 *
 * Defines a single menu choice in the IVR system (e.g., "Press 1 for Sales")
 */
export class IvrMenuOptionDto {
  @ApiProperty({
    description: 'DTMF digit (0-9) that triggers this action',
    example: '1',
    enum: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
  })
  @IsString()
  @IsIn(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'], {
    message: 'Digit must be a single digit from 0-9',
  })
  digit: string;

  @ApiProperty({
    description: 'Action to execute when this digit is pressed',
    example: 'route_to_number',
    enum: IVR_ACTION_TYPES,
  })
  @IsString()
  @IsIn(IVR_ACTION_TYPES, {
    message: `Action must be one of: ${IVR_ACTION_TYPES.join(', ')}`,
  })
  action: IvrActionType;

  @ApiProperty({
    description:
      'Human-readable label for this option (used in TwiML "Press 1 for {label}")',
    example: 'Sales Department',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty({ message: 'Label cannot be empty' })
  @MinLength(1, { message: 'Label must be at least 1 character' })
  @MaxLength(100, { message: 'Label must not exceed 100 characters' })
  label: string;

  @ApiProperty({
    description:
      'Action-specific configuration (validated based on action type)',
    example: { phone_number: '+19781234567' },
  })
  @IsObject()
  @IsNotEmpty({ message: 'Config cannot be empty' })
  config: {
    phone_number?: string;
    webhook_url?: string;
    max_duration_seconds?: number;
  };
}

/**
 * Default Action Configuration
 *
 * Action to execute if user does not provide input or timeout occurs
 */
export class IvrDefaultActionDto {
  @ApiProperty({
    description: 'Action to execute when no input is received',
    example: 'voicemail',
    enum: IVR_ACTION_TYPES,
  })
  @IsString()
  @IsIn(IVR_ACTION_TYPES, {
    message: `Action must be one of: ${IVR_ACTION_TYPES.join(', ')}`,
  })
  action: IvrActionType;

  @ApiProperty({
    description: 'Action-specific configuration',
    example: { max_duration_seconds: 180 },
  })
  @IsObject()
  @IsNotEmpty({ message: 'Config cannot be empty' })
  config: {
    phone_number?: string;
    webhook_url?: string;
    max_duration_seconds?: number;
  };
}

/**
 * CreateIvrConfigDto
 *
 * DTO for creating or updating IVR (Interactive Voice Response) configuration.
 *
 * IVR System Overview:
 * - Answers inbound calls with a greeting message
 * - Presents a menu of options (max 10)
 * - Routes calls based on DTMF digit input (0-9)
 * - Handles timeout/invalid input with default action
 * - Supports retry logic for incorrect input
 *
 * Production Considerations:
 * - Each digit must be unique within the menu
 * - Phone numbers must be in E.164 format (+[country][number])
 * - Webhook URLs must use HTTPS for security
 * - Voicemail recordings are limited to prevent abuse
 * - Greeting message should be concise (< 30 seconds when spoken)
 *
 * @example
 * {
 *   "ivr_enabled": true,
 *   "greeting_message": "Thank you for calling ABC Company.",
 *   "menu_options": [
 *     {
 *       "digit": "1",
 *       "action": "route_to_number",
 *       "label": "Sales Department",
 *       "config": { "phone_number": "+19781234567" }
 *     },
 *     {
 *       "digit": "2",
 *       "action": "voicemail",
 *       "label": "Leave a message",
 *       "config": { "max_duration_seconds": 180 }
 *     }
 *   ],
 *   "default_action": {
 *     "action": "voicemail",
 *     "config": { "max_duration_seconds": 180 }
 *   },
 *   "timeout_seconds": 10,
 *   "max_retries": 3
 * }
 */
export class CreateIvrConfigDto {
  @ApiProperty({
    description: 'Whether IVR is enabled for this tenant',
    example: true,
  })
  @IsBoolean({ message: 'ivr_enabled must be a boolean' })
  ivr_enabled: boolean;

  @ApiProperty({
    description:
      'IVR greeting message (spoken before menu options). Keep concise (< 30 seconds).',
    example: 'Thank you for calling ABC Company.',
    minLength: 5,
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty({ message: 'Greeting message cannot be empty' })
  @MinLength(5, {
    message: 'Greeting message must be at least 5 characters',
  })
  @MaxLength(500, {
    message:
      'Greeting message must not exceed 500 characters (should be < 30 seconds when spoken)',
  })
  greeting_message: string;

  @ApiProperty({
    description:
      'Array of menu options (1-10 options). Each digit must be unique.',
    type: [IvrMenuOptionDto],
    minItems: 1,
    maxItems: 10,
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least 1 menu option is required' })
  @ArrayMaxSize(10, { message: 'Maximum 10 menu options allowed' })
  @ValidateNested({ each: true })
  @Type(() => IvrMenuOptionDto)
  menu_options: IvrMenuOptionDto[];

  @ApiProperty({
    description:
      'Default action if no input received or timeout occurs (fallback behavior)',
    example: { action: 'voicemail', config: { max_duration_seconds: 180 } },
    type: IvrDefaultActionDto,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => IvrDefaultActionDto)
  default_action: IvrDefaultActionDto;

  @ApiProperty({
    description:
      'Seconds to wait for user input before executing default action',
    example: 10,
    minimum: 5,
    maximum: 60,
    default: 10,
  })
  @IsInt({ message: 'timeout_seconds must be an integer' })
  @Min(5, { message: 'Timeout must be at least 5 seconds' })
  @Max(60, {
    message: 'Timeout must not exceed 60 seconds (UX best practice)',
  })
  timeout_seconds: number;

  @ApiProperty({
    description:
      'Maximum number of retry attempts for invalid input before executing default action',
    example: 3,
    minimum: 1,
    maximum: 5,
    default: 3,
  })
  @IsInt({ message: 'max_retries must be an integer' })
  @Min(1, { message: 'At least 1 retry attempt is required' })
  @Max(5, {
    message: 'Maximum 5 retry attempts allowed (prevents caller frustration)',
  })
  max_retries: number;
}

/**
 * UpdateIvrConfigDto
 *
 * Same as CreateIvrConfigDto - IVR updates use upsert pattern.
 * This is an alias for clarity in controller signatures.
 */
export class UpdateIvrConfigDto extends CreateIvrConfigDto {}
