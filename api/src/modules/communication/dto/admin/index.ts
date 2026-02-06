/**
 * Admin DTOs - Index
 *
 * Exports all admin-related Data Transfer Objects for the Communication module.
 * These DTOs are used exclusively for admin/platform management endpoints.
 *
 * @module CommunicationAdminDTOs
 * @since Sprint 8
 */

// Filter DTOs
export * from './admin-call-filters.dto';
export * from './admin-sms-filters.dto';

// Usage Tracking DTOs
export * from './usage-query.dto';

// Provider Management DTOs
export * from './register-system-provider.dto';

// Alert Management DTOs (if needed in future)
// export * from './alert-query.dto';
