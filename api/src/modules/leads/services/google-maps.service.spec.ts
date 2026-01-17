import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnprocessableEntityException } from '@nestjs/common';
import { GoogleMapsService } from './google-maps.service';

// Mock @googlemaps/google-maps-services-js
jest.mock('@googlemaps/google-maps-services-js', () => ({
  Client: jest.fn().mockImplementation(() => ({
    geocode: jest.fn(),
    reverseGeocode: jest.fn(),
  })),
}));

describe('GoogleMapsService', () => {
  let service: GoogleMapsService;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'GOOGLE_MAPS_API_KEY') return 'test-api-key';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleMapsService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<GoogleMapsService>(GoogleMapsService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateAddress - Scenario 1: Frontend provides lat/lng', () => {
    it('should skip API call when valid lat/lng and city/state provided', async () => {
      const address = {
        address_line1: '106 Stow St',
        city: 'Acton',
        state: 'MA',
        zip_code: '01720',
        latitude: 42.4929,
        longitude: -71.5242,
      };

      const result = await service.validateAddress(address);

      expect(result.latitude).toBe(42.4929);
      expect(result.longitude).toBe(-71.5242);
      expect(result.city).toBe('Acton');
      expect(result.state).toBe('MA');
    });

    it('should throw error for invalid coordinates', async () => {
      const address = {
        address_line1: '123 Main St',
        latitude: 200, // Invalid
        longitude: -71.5242,
      };

      await expect(service.validateAddress(address)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('should reverse geocode when lat/lng provided but city/state missing', async () => {
      const address = {
        address_line1: '123 Main St',
        latitude: 42.4929,
        longitude: -71.5242,
      };

      // Mock reverse geocode response
      const mockClient = service['googleMapsClient'] as any;
      mockClient.reverseGeocode = jest.fn().mockResolvedValue({
        data: {
          status: 'OK',
          results: [
            {
              geometry: {
                location: { lat: 42.4929, lng: -71.5242 },
              },
              address_components: [
                { types: ['locality'], long_name: 'Acton' },
                { types: ['administrative_area_level_1'], short_name: 'CA' },
                { types: ['postal_code'], long_name: '90001' },
              ],
              formatted_address: '123 Main St, Acton, CA 90001, USA',
            },
          ],
        },
      });

      const result = await service.validateAddress(address);

      expect(result.city).toBe('Acton');
      expect(result.state).toBe('CA');
      expect(result.zip_code).toBe('90001');
    });
  });

  describe('validateAddress - Scenario 2 & 3: Geocoding required', () => {
    it('should geocode address when lat/lng not provided', async () => {
      const address = {
        address_line1: '123 Main St',
        city: 'Acton',
        state: 'CA',
        zip_code: '90001',
      };

      // Mock geocode response
      const mockClient = service['googleMapsClient'] as any;
      mockClient.geocode = jest.fn().mockResolvedValue({
        data: {
          status: 'OK',
          results: [
            {
              geometry: {
                location: { lat: 42.4929, lng: -71.5242 },
              },
              address_components: [
                { types: ['locality'], long_name: 'Acton' },
                { types: ['administrative_area_level_1'], short_name: 'CA' },
                { types: ['postal_code'], long_name: '90001' },
              ],
              formatted_address: '123 Main St, Acton, CA 90001, USA',
            },
          ],
        },
      });

      const result = await service.validateAddress(address);

      expect(result.latitude).toBe(42.4929);
      expect(result.longitude).toBe(-71.5242);
      expect(result.city).toBe('Acton');
      expect(result.state).toBe('CA');
    });

    it('should throw error when address not found', async () => {
      const address = {
        address_line1: 'Nonexistent Address',
        city: 'Fake City',
        state: 'ZZ',
      };

      const mockClient = service['googleMapsClient'] as any;
      mockClient.geocode = jest.fn().mockResolvedValue({
        data: { status: 'ZERO_RESULTS', results: [] },
      });

      await expect(service.validateAddress(address)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('should throw error when Google Maps API fails', async () => {
      const address = {
        address_line1: '123 Main St',
        city: 'Acton',
        state: 'CA',
      };

      const mockClient = service['googleMapsClient'] as any;
      mockClient.geocode = jest.fn().mockRejectedValue(new Error('API Error'));

      await expect(service.validateAddress(address)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  describe('validateCoordinates', () => {
    it('should validate correct US coordinates', () => {
      // US-specific bounds: lat 24-50, lng -125 to -66
      expect(service.validateCoordinates(42.4929, -71.5242)).toBe(true); // Acton
      expect(service.validateCoordinates(40.7128, -74.006)).toBe(true); // New York
      expect(service.validateCoordinates(25.7617, -80.1918)).toBe(true); // Miami
      expect(service.validateCoordinates(47.6062, -122.3321)).toBe(true); // Seattle
    });

    it('should reject coordinates outside US bounds', () => {
      expect(service.validateCoordinates(0, 0)).toBe(false); // Null Island - not US
      expect(service.validateCoordinates(-90, -180)).toBe(false); // South Pole - not US
      expect(service.validateCoordinates(90, 180)).toBe(false); // North Pole - not US
      expect(service.validateCoordinates(51, -100)).toBe(false); // lat > 50 (Canada)
      expect(service.validateCoordinates(23, -100)).toBe(false); // lat < 24 (Mexico)
      expect(service.validateCoordinates(35, -130)).toBe(false); // lng < -125 (Pacific)
      expect(service.validateCoordinates(35, -60)).toBe(false); // lng > -66 (Atlantic)
      expect(service.validateCoordinates(NaN, -100)).toBe(false);
      expect(service.validateCoordinates(35, NaN)).toBe(false);
    });
  });
});
