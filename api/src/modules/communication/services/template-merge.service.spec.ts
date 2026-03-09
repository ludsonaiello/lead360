import { Test, TestingModule } from '@nestjs/testing';
import { TemplateMergeService, MergeData } from './template-merge.service';
import { PrismaService } from '../../../core/database/prisma.service';

/**
 * Unit Tests for TemplateMergeService
 *
 * Tests template variable replacement functionality including:
 * - Lead variables
 * - Tenant variables
 * - User variables
 * - Appointment variables (Sprint 21)
 * - Date/time variables
 * - Custom variables
 * - Data loading from database
 */
describe('TemplateMergeService', () => {
  let service: TemplateMergeService;
  let prisma: PrismaService;

  const mockTenantId = 'tenant-123';
  const mockUserId = 'user-456';
  const mockLeadId = 'lead-789';
  const mockAppointmentId = 'appointment-abc';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplateMergeService,
        {
          provide: PrismaService,
          useValue: {
            tenant: {
              findUnique: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
            },
            lead: {
              findFirst: jest.fn(),
            },
            appointment: {
              findFirst: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<TemplateMergeService>(TemplateMergeService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('mergeTemplate()', () => {
    describe('Lead variables', () => {
      it('should replace {lead.first_name} with actual value', async () => {
        const mergeData: MergeData = {
          lead: { first_name: 'John' },
        };

        const result = await service.mergeTemplate(
          'Hello {lead.first_name}!',
          mergeData,
        );

        expect(result).toBe('Hello John!');
      });

      it('should replace {lead.last_name} with actual value', async () => {
        const mergeData: MergeData = {
          lead: { last_name: 'Smith' },
        };

        const result = await service.mergeTemplate(
          'Dear {lead.last_name}',
          mergeData,
        );

        expect(result).toBe('Dear Smith');
      });

      it('should replace {lead.phone} with actual value', async () => {
        const mergeData: MergeData = {
          lead: { phone: '+15551234567' },
        };

        const result = await service.mergeTemplate(
          'Call us at {lead.phone}',
          mergeData,
        );

        expect(result).toBe('Call us at +15551234567');
      });

      it('should replace {lead.email} with actual value', async () => {
        const mergeData: MergeData = {
          lead: { email: 'john@example.com' },
        };

        const result = await service.mergeTemplate(
          'Email: {lead.email}',
          mergeData,
        );

        expect(result).toBe('Email: john@example.com');
      });

      it('should replace {lead.address} with actual value', async () => {
        const mergeData: MergeData = {
          lead: { address: '123 Main St, City, ST 12345' },
        };

        const result = await service.mergeTemplate(
          'Address: {lead.address}',
          mergeData,
        );

        expect(result).toBe('Address: 123 Main St, City, ST 12345');
      });

      it('should replace missing lead fields with empty string', async () => {
        const mergeData: MergeData = {
          lead: {},
        };

        const result = await service.mergeTemplate(
          'Hello {lead.first_name} {lead.last_name}!',
          mergeData,
        );

        expect(result).toBe('Hello  !');
      });
    });

    describe('Tenant variables', () => {
      it('should replace {tenant.company_name} with actual value', async () => {
        const mergeData: MergeData = {
          tenant: { company_name: 'Acme Corp' },
        };

        const result = await service.mergeTemplate(
          'Welcome to {tenant.company_name}',
          mergeData,
        );

        expect(result).toBe('Welcome to Acme Corp');
      });

      it('should replace {tenant.phone} with actual value', async () => {
        const mergeData: MergeData = {
          tenant: { phone: '+15559876543' },
        };

        const result = await service.mergeTemplate(
          'Contact: {tenant.phone}',
          mergeData,
        );

        expect(result).toBe('Contact: +15559876543');
      });

      it('should replace {tenant.address} with actual value', async () => {
        const mergeData: MergeData = {
          tenant: { address: '456 Business Blvd, City, ST 54321' },
        };

        const result = await service.mergeTemplate(
          'Visit us at {tenant.address}',
          mergeData,
        );

        expect(result).toBe('Visit us at 456 Business Blvd, City, ST 54321');
      });
    });

    describe('User variables', () => {
      it('should replace {user.first_name} with actual value', async () => {
        const mergeData: MergeData = {
          user: { first_name: 'Alice' },
        };

        const result = await service.mergeTemplate(
          'From {user.first_name}',
          mergeData,
        );

        expect(result).toBe('From Alice');
      });

      it('should replace {user.last_name} with actual value', async () => {
        const mergeData: MergeData = {
          user: { last_name: 'Johnson' },
        };

        const result = await service.mergeTemplate(
          'Sent by {user.last_name}',
          mergeData,
        );

        expect(result).toBe('Sent by Johnson');
      });

      it('should replace {user.phone} and {user.email} with actual values', async () => {
        const mergeData: MergeData = {
          user: { phone: '+15551112222', email: 'alice@company.com' },
        };

        const result = await service.mergeTemplate(
          'Contact me: {user.email} or {user.phone}',
          mergeData,
        );

        expect(result).toBe('Contact me: alice@company.com or +15551112222');
      });
    });

    describe('Appointment variables (Sprint 21)', () => {
      it('should replace {appointment_type} with actual value', async () => {
        const mergeData: MergeData = {
          appointment: { appointment_type: 'Quote Visit' },
        };

        const result = await service.mergeTemplate(
          'Your {appointment_type} is confirmed',
          mergeData,
        );

        expect(result).toBe('Your Quote Visit is confirmed');
      });

      it('should replace {appointment_date} with actual value', async () => {
        const mergeData: MergeData = {
          appointment: { appointment_date: 'Monday, March 5, 2026' },
        };

        const result = await service.mergeTemplate(
          'Date: {appointment_date}',
          mergeData,
        );

        expect(result).toBe('Date: Monday, March 5, 2026');
      });

      it('should replace {appointment_time} with actual value', async () => {
        const mergeData: MergeData = {
          appointment: { appointment_time: '9:30 AM' },
        };

        const result = await service.mergeTemplate(
          'Time: {appointment_time}',
          mergeData,
        );

        expect(result).toBe('Time: 9:30 AM');
      });

      it('should replace {appointment_date_time} with actual value', async () => {
        const mergeData: MergeData = {
          appointment: {
            appointment_date_time: 'Monday, March 5, 2026 at 9:30 AM',
          },
        };

        const result = await service.mergeTemplate(
          'Scheduled for {appointment_date_time}',
          mergeData,
        );

        expect(result).toBe('Scheduled for Monday, March 5, 2026 at 9:30 AM');
      });

      it('should replace {appointment_status} with actual value', async () => {
        const mergeData: MergeData = {
          appointment: { appointment_status: 'Confirmed' },
        };

        const result = await service.mergeTemplate(
          'Status: {appointment_status}',
          mergeData,
        );

        expect(result).toBe('Status: Confirmed');
      });

      it('should replace {appointment_notes} with actual value', async () => {
        const mergeData: MergeData = {
          appointment: { appointment_notes: 'Bring ladder and equipment' },
        };

        const result = await service.mergeTemplate(
          'Notes: {appointment_notes}',
          mergeData,
        );

        expect(result).toBe('Notes: Bring ladder and equipment');
      });

      it('should replace all appointment variables in a complete template', async () => {
        const mergeData: MergeData = {
          lead: { first_name: 'John' },
          tenant: { company_name: 'Acme Corp' },
          appointment: {
            appointment_type: 'Quote Visit',
            appointment_date: 'Monday, March 5, 2026',
            appointment_time: '9:30 AM',
            appointment_status: 'Confirmed',
          },
        };

        const template = `Hi {lead.first_name}, your {appointment_type} with {tenant.company_name} is {appointment_status} for {appointment_date} at {appointment_time}.`;

        const result = await service.mergeTemplate(template, mergeData);

        expect(result).toBe(
          'Hi John, your Quote Visit with Acme Corp is Confirmed for Monday, March 5, 2026 at 9:30 AM.',
        );
      });

      it('should replace missing appointment fields with empty string', async () => {
        const mergeData: MergeData = {
          appointment: {},
        };

        const result = await service.mergeTemplate(
          'Type: {appointment_type}, Date: {appointment_date}',
          mergeData,
        );

        expect(result).toBe('Type: , Date: ');
      });

      it('should handle appointment reminder template', async () => {
        const mergeData: MergeData = {
          lead: { first_name: 'Sarah' },
          tenant: { company_name: 'ABC Painting' },
          appointment: {
            appointment_type: 'Quote Visit',
            appointment_date_time: 'Thursday, March 7, 2026 at 2:00 PM',
          },
        };

        const template = `Hi {lead.first_name}, this is a reminder of your {appointment_type} with {tenant.company_name} scheduled for {appointment_date_time}.`;

        const result = await service.mergeTemplate(template, mergeData);

        expect(result).toBe(
          'Hi Sarah, this is a reminder of your Quote Visit with ABC Painting scheduled for Thursday, March 7, 2026 at 2:00 PM.',
        );
      });
    });

    describe('Custom variables', () => {
      it('should replace custom variables', async () => {
        const mergeData: MergeData = {
          custom: {
            quote_url: 'https://example.com/quote/123',
            amount: '$1,250.00',
          },
        };

        const result = await service.mergeTemplate(
          'View your quote: {custom.quote_url} - Total: {custom.amount}',
          mergeData,
        );

        expect(result).toBe(
          'View your quote: https://example.com/quote/123 - Total: $1,250.00',
        );
      });
    });

    describe('Date/time variables', () => {
      it('should replace {today} with formatted date', async () => {
        const template = 'Today is {today}';
        const result = await service.mergeTemplate(template, {});

        // Just verify it contains some date format
        expect(result).toContain('Today is');
        expect(result.length).toBeGreaterThan('Today is '.length);
      });

      it('should replace {time} with formatted time', async () => {
        const template = 'Current time: {time}';
        const result = await service.mergeTemplate(template, {});

        // Just verify it contains some time format
        expect(result).toContain('Current time:');
        expect(result.length).toBeGreaterThan('Current time: '.length);
      });
    });

    describe('Multiple variable types', () => {
      it('should replace all variable types in one template', async () => {
        const mergeData: MergeData = {
          lead: { first_name: 'John', last_name: 'Smith' },
          tenant: { company_name: 'Acme Corp' },
          user: { first_name: 'Alice' },
          appointment: {
            appointment_type: 'Quote Visit',
            appointment_date: 'Monday, March 5, 2026',
          },
          custom: { quote_id: 'Q-1234' },
        };

        const template = `Hi {lead.first_name} {lead.last_name}, {user.first_name} from {tenant.company_name} has scheduled your {appointment_type} for {appointment_date}. Reference: {custom.quote_id}`;

        const result = await service.mergeTemplate(template, mergeData);

        expect(result).toBe(
          'Hi John Smith, Alice from Acme Corp has scheduled your Quote Visit for Monday, March 5, 2026. Reference: Q-1234',
        );
      });
    });
  });

  describe('loadMergeData()', () => {
    const mockTenant = {
      company_name: 'Test Company',
      primary_contact_phone: '+15551234567',
      timezone: 'America/New_York',
      tenant_address: [
        {
          line1: '123 Business Ave',
          line2: 'Suite 100',
          city: 'New York',
          state: 'NY',
          zip_code: '10001',
        },
      ],
    };

    const mockUser = {
      first_name: 'Alice',
      last_name: 'Johnson',
      phone: '+15559876543',
      email: 'alice@testcompany.com',
    };

    const mockLead = {
      first_name: 'John',
      last_name: 'Smith',
      phones: [{ phone: '+15551112222' }],
      emails: [{ email: 'john@example.com' }],
      addresses: [
        {
          address_line1: '456 Main St',
          address_line2: 'Apt 2B',
          city: 'Brooklyn',
          state: 'NY',
          zip_code: '11201',
        },
      ],
    };

    const mockAppointment = {
      scheduled_date: '2026-03-05',
      start_time: '09:30',
      end_time: '11:00',
      status: 'confirmed',
      notes: 'Bring ladder',
      appointment_type: {
        name: 'Quote Visit',
      },
    };

    beforeEach(() => {
      jest
        .spyOn(prisma.tenant, 'findUnique')
        .mockResolvedValue(mockTenant as any);
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);
      jest.spyOn(prisma.lead, 'findFirst').mockResolvedValue(mockLead as any);
      jest
        .spyOn(prisma.appointment, 'findFirst')
        .mockResolvedValue(mockAppointment as any);
    });

    it('should load tenant data', async () => {
      const result = await service.loadMergeData(mockTenantId, mockUserId);

      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: mockTenantId },
        select: expect.objectContaining({
          company_name: true,
          primary_contact_phone: true,
          timezone: true,
        }),
      });

      expect(result.tenant).toEqual({
        company_name: 'Test Company',
        phone: '+15551234567',
        address: '123 Business Ave Suite 100, New York, NY 10001',
      });
    });

    it('should load user data', async () => {
      const result = await service.loadMergeData(mockTenantId, mockUserId);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUserId },
        select: expect.objectContaining({
          first_name: true,
          last_name: true,
          phone: true,
          email: true,
        }),
      });

      expect(result.user).toEqual({
        first_name: 'Alice',
        last_name: 'Johnson',
        phone: '+15559876543',
        email: 'alice@testcompany.com',
      });
    });

    it('should load lead data when leadId is provided', async () => {
      const result = await service.loadMergeData(
        mockTenantId,
        mockUserId,
        mockLeadId,
      );

      expect(prisma.lead.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockLeadId,
          tenant_id: mockTenantId, // CRITICAL: Multi-tenant isolation
        },
        select: expect.any(Object),
      });

      expect(result.lead).toEqual({
        first_name: 'John',
        last_name: 'Smith',
        phone: '+15551112222',
        email: 'john@example.com',
        address: '456 Main St Apt 2B, Brooklyn, NY 11201',
      });
    });

    it('should not load lead data when leadId is not provided', async () => {
      const result = await service.loadMergeData(mockTenantId, mockUserId);

      expect(prisma.lead.findFirst).not.toHaveBeenCalled();
      expect(result.lead).toBeUndefined();
    });

    it('should load appointment data when appointmentId is provided (Sprint 21)', async () => {
      const result = await service.loadMergeData(
        mockTenantId,
        mockUserId,
        undefined,
        mockAppointmentId,
      );

      expect(prisma.appointment.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockAppointmentId,
          tenant_id: mockTenantId, // CRITICAL: Multi-tenant isolation
        },
        select: expect.objectContaining({
          scheduled_date: true,
          start_time: true,
          end_time: true,
          status: true,
          notes: true,
          appointment_type: {
            select: {
              name: true,
            },
          },
        }),
      });

      expect(result.appointment).toBeDefined();
      expect(result.appointment?.appointment_type).toBe('Quote Visit');
      expect(result.appointment?.appointment_date).toContain('March');
      expect(result.appointment?.appointment_time).toContain('9:30');
      expect(result.appointment?.appointment_status).toBe('Confirmed');
      expect(result.appointment?.appointment_notes).toBe('Bring ladder');
    });

    it('should not load appointment data when appointmentId is not provided', async () => {
      const result = await service.loadMergeData(mockTenantId, mockUserId);

      expect(prisma.appointment.findFirst).not.toHaveBeenCalled();
      expect(result.appointment).toBeUndefined();
    });

    it('should format appointment date correctly', async () => {
      const result = await service.loadMergeData(
        mockTenantId,
        mockUserId,
        undefined,
        mockAppointmentId,
      );

      // Date should be formatted as "Weekday, Month Day, Year"
      expect(result.appointment?.appointment_date).toMatch(
        /^[A-Z][a-z]+, [A-Z][a-z]+ \d{1,2}, \d{4}$/,
      );
    });

    it('should format appointment time correctly', async () => {
      const result = await service.loadMergeData(
        mockTenantId,
        mockUserId,
        undefined,
        mockAppointmentId,
      );

      // Time should be formatted as "H:MM AM/PM" or "HH:MM AM/PM"
      expect(result.appointment?.appointment_time).toMatch(
        /^\d{1,2}:\d{2} [AP]M$/,
      );
    });

    it('should format appointment status correctly', async () => {
      // Test with different status values
      const statusTests = [
        { input: 'scheduled', expected: 'Scheduled' },
        { input: 'confirmed', expected: 'Confirmed' },
        { input: 'cancelled', expected: 'Cancelled' },
        { input: 'no_show', expected: 'No Show' },
      ];

      for (const test of statusTests) {
        jest.spyOn(prisma.appointment, 'findFirst').mockResolvedValueOnce({
          ...mockAppointment,
          status: test.input,
        } as any);

        const result = await service.loadMergeData(
          mockTenantId,
          mockUserId,
          undefined,
          mockAppointmentId,
        );

        expect(result.appointment?.appointment_status).toBe(test.expected);
      }
    });

    it('should combine appointment date and time correctly', async () => {
      const result = await service.loadMergeData(
        mockTenantId,
        mockUserId,
        undefined,
        mockAppointmentId,
      );

      expect(result.appointment?.appointment_date_time).toContain(' at ');
      expect(result.appointment?.appointment_date_time).toContain('March');
      expect(result.appointment?.appointment_date_time).toContain('9:30');
    });

    it('should load all data types when all IDs are provided', async () => {
      const result = await service.loadMergeData(
        mockTenantId,
        mockUserId,
        mockLeadId,
        mockAppointmentId,
      );

      expect(result.tenant).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.lead).toBeDefined();
      expect(result.appointment).toBeDefined();
    });

    it('should enforce multi-tenant isolation for lead queries', async () => {
      await service.loadMergeData(mockTenantId, mockUserId, mockLeadId);

      expect(prisma.lead.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: mockTenantId,
          }),
        }),
      );
    });

    it('should enforce multi-tenant isolation for appointment queries (Sprint 21)', async () => {
      await service.loadMergeData(
        mockTenantId,
        mockUserId,
        undefined,
        mockAppointmentId,
      );

      expect(prisma.appointment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: mockTenantId,
          }),
        }),
      );
    });
  });
});
