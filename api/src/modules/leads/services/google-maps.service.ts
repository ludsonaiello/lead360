import { Injectable, UnprocessableEntityException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, GeocodeResult } from '@googlemaps/google-maps-services-js';

export interface PartialAddress {
  address_line1: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip_code: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

export interface ValidatedAddress {
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  latitude: number;
  longitude: number;
  google_place_id?: string;
}

@Injectable()
export class GoogleMapsService {
  private readonly logger = new Logger(GoogleMapsService.name);
  private readonly googleMapsClient: Client;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    // Use server-side API key (without referer restrictions)
    this.apiKey = this.configService.get<string>('GOOGLE_MAPS_API_KEY_SERVER') || '';

    if (!this.apiKey) {
      this.logger.error('GOOGLE_MAPS_API_KEY_SERVER is not configured. Address validation will fail.');
      // Don't throw here, allow service to initialize but fail at runtime
    }

    this.googleMapsClient = new Client({});
  }

  /**
   * Main validation method - handles all 3 scenarios:
   * 1. Frontend provides lat/lng → validates components, uses provided coordinates
   * 2. Lat/lng missing → geocodes address
   * 3. City/state missing → fetches from Google Maps
   */
  async validateAddress(address: PartialAddress): Promise<ValidatedAddress> {
    this.ensureApiKeyConfigured();

    // Scenario 1: Frontend provided lat/lng (performance optimization - skip API call)
    if (address.latitude && address.longitude) {
      this.logger.log(
        `Validating address with provided coordinates: ${address.latitude}, ${address.longitude}`
      );

      // Validate coordinates are within reasonable bounds (US)
      if (!this.validateCoordinates(address.latitude, address.longitude)) {
        throw new UnprocessableEntityException(
          'Invalid coordinates provided. Coordinates must be within US bounds.'
        );
      }

      // If city/state missing, reverse geocode to get them
      if (!address.city || !address.state) {
        this.logger.log('City or state missing, performing reverse geocoding...');
        return this.reverseGeocode(
          address.latitude,
          address.longitude,
          address
        );
      }

      // All data provided, return validated address
      return {
        address_line1: address.address_line1,
        address_line2: address.address_line2,
        city: address.city,
        state: address.state,
        zip_code: address.zip_code,
        country: address.country || 'US',
        latitude: address.latitude,
        longitude: address.longitude,
      };
    }

    // Scenario 2 & 3: Lat/lng missing OR city/state missing → geocode
    this.logger.log(
      `Geocoding address: ${address.address_line1}, ${address.zip_code}`
    );
    return this.geocodeAddress(address);
  }

  /**
   * Forward geocoding: Address → Lat/Lng + all components
   */
  async geocodeAddress(address: PartialAddress): Promise<ValidatedAddress> {
    this.ensureApiKeyConfigured();

    const fullAddress = [
      address.address_line1,
      address.address_line2,
      address.city,
      address.state,
      address.zip_code,
      address.country || 'US',
    ]
      .filter(Boolean)
      .join(', ');

    try {
      const response = await this.googleMapsClient.geocode({
        params: {
          address: fullAddress,
          key: this.apiKey,
        },
        timeout: 5000, // 5 second timeout
      });

      if (response.data.status !== 'OK' || !response.data.results.length) {
        this.logger.error(
          `Google Maps geocoding failed: ${response.data.status}`
        );
        throw new UnprocessableEntityException(
          `Address validation failed: Could not geocode address. Please verify street address and zipcode. Status: ${response.data.status}`
        );
      }

      const result = response.data.results[0];
      return this.parseGeocodeResult(result, address);
    } catch (error) {
      if (error instanceof UnprocessableEntityException) {
        throw error;
      }

      this.logger.error('Google Maps API error:', error);
      throw new UnprocessableEntityException(
        `Address validation failed: ${error.message}`
      );
    }
  }

  /**
   * Reverse geocoding: Lat/Lng → Address components
   */
  async reverseGeocode(
    lat: number,
    lng: number,
    originalAddress: PartialAddress
  ): Promise<ValidatedAddress> {
    this.ensureApiKeyConfigured();

    try {
      const response = await this.googleMapsClient.reverseGeocode({
        params: {
          latlng: { lat, lng },
          key: this.apiKey,
        },
        timeout: 5000,
      });

      if (response.data.status !== 'OK' || !response.data.results.length) {
        this.logger.error(
          `Google Maps reverse geocoding failed: ${response.data.status}`
        );
        throw new UnprocessableEntityException(
          `Address validation failed: Could not reverse geocode coordinates. Status: ${response.data.status}`
        );
      }

      const result = response.data.results[0];
      return this.parseGeocodeResult(result, originalAddress);
    } catch (error) {
      if (error instanceof UnprocessableEntityException) {
        throw error;
      }

      this.logger.error('Google Maps reverse geocoding error:', error);
      throw new UnprocessableEntityException(
        `Address validation failed: ${error.message}`
      );
    }
  }

  /**
   * Validate coordinates are within US bounds
   */
  validateCoordinates(lat: number, lng: number): boolean {
    // US bounds: lat 24-50, lng -125 to -66 (approximate)
    const isValidLat = lat >= 24 && lat <= 50;
    const isValidLng = lng >= -125 && lng <= -66;
    return isValidLat && isValidLng;
  }

  /**
   * Parse Google Maps geocode result into ValidatedAddress
   */
  private parseGeocodeResult(
    result: GeocodeResult,
    originalAddress: PartialAddress
  ): ValidatedAddress {
    const components = result.address_components;

    // Extract components
    const streetNumber = this.extractComponent(components, 'street_number');
    const route = this.extractComponent(components, 'route');
    const city =
      this.extractComponent(components, 'locality') ||
      this.extractComponent(components, 'sublocality') ||
      this.extractComponent(components, 'administrative_area_level_3');
    const state = this.extractComponent(
      components,
      'administrative_area_level_1',
      true
    ); // Short name (e.g., "MA")
    const zipCode = this.extractComponent(components, 'postal_code');
    const country = this.extractComponent(components, 'country', true); // Short name (e.g., "US")

    // Build street address (prefer original if provided)
    const addressLine1 =
      originalAddress.address_line1 ||
      [streetNumber, route].filter(Boolean).join(' ');

    // Validate required fields
    if (!addressLine1 || !city || !state || !zipCode) {
      this.logger.error('Incomplete address components from Google Maps', {
        addressLine1,
        city,
        state,
        zipCode,
      });
      throw new UnprocessableEntityException(
        'Address validation failed: Could not extract all required address components from Google Maps'
      );
    }

    return {
      address_line1: addressLine1,
      address_line2: originalAddress.address_line2,
      city,
      state,
      zip_code: zipCode,
      country: country || 'US',
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      google_place_id: result.place_id,
    };
  }

  /**
   * Extract address component from Google Maps result
   */
  extractComponent(
    components: any[],
    type: string,
    shortName: boolean = false
  ): string | null {
    const component = components.find((c) => c.types.includes(type));
    if (!component) return null;
    return shortName ? component.short_name : component.long_name;
  }

  /**
   * Ensure API key is configured
   */
  private ensureApiKeyConfigured(): void {
    if (!this.apiKey) {
      throw new UnprocessableEntityException(
        'Google Maps API key is not configured. Cannot validate address.'
      );
    }
  }
}
