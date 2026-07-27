import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/database';

export interface CheckGeofenceParams {
  tenantId: string;
  latitude: number;
  longitude: number;
  projectId?: string;
  clockInMode?: string;
}

export interface CheckGeofenceResult {
  geofence_status: 'not_enforced' | 'inside' | 'outside';
  clockin_address_id: string | null;
  nearest_distance_meters: number | null;
  flag_reason: string | null;
}

@Injectable()
export class GeofenceService {
  constructor(private readonly prisma: PrismaService) {}

  async checkGeofence(
    params: CheckGeofenceParams,
  ): Promise<CheckGeofenceResult> {
    const { tenantId, latitude, longitude, projectId } = params;

    const where: Prisma.clockin_addressWhereInput = {
      tenant_id: tenantId,
      is_active: true,
    };

    if (projectId) {
      where.OR = [{ project_id: null }, { project_id: projectId }];
    }

    const addresses = await this.prisma.clockin_address.findMany({ where });

    if (addresses.length === 0) {
      return {
        geofence_status: 'not_enforced',
        clockin_address_id: null,
        nearest_distance_meters: null,
        flag_reason: null,
      };
    }

    let closestInside: { id: string; distance: number } | null = null;
    let nearestDistance = Infinity;

    for (const addr of addresses) {
      if (addr.latitude === null || addr.longitude === null) {
        continue;
      }

      const distance = this.haversineDistance(
        latitude,
        longitude,
        Number(addr.latitude),
        Number(addr.longitude),
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
      }

      if (distance <= addr.radius_meters) {
        if (!closestInside || distance < closestInside.distance) {
          closestInside = { id: addr.id, distance };
        }
      }
    }

    if (closestInside) {
      return {
        geofence_status: 'inside',
        clockin_address_id: closestInside.id,
        nearest_distance_meters: Math.round(closestInside.distance),
        flag_reason: null,
      };
    }

    const roundedNearest = Math.round(nearestDistance);
    return {
      geofence_status: 'outside',
      clockin_address_id: null,
      nearest_distance_meters: roundedNearest,
      flag_reason: `Outside all configured locations — ${roundedNearest}m from nearest`,
    };
  }

  private haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371000;
    const phi1 = lat1 * (Math.PI / 180);
    const phi2 = lat2 * (Math.PI / 180);
    const deltaPhi = (lat2 - lat1) * (Math.PI / 180);
    const deltaLambda = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(deltaPhi / 2) ** 2 +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
