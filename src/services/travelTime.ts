// Travel Time Estimation Service for MARSHGO
// Accurately calculates estimated travel time and ETA based on distance, vehicle type, and transport category

import { TransportCategory } from '../types';

export interface TravelTimeDetails {
  durationMinutes: number;
  durationFormatted: string;
  hours: number;
  minutes: number;
  averageSpeedKmH: number;
  vehicleTypeLabel: string;
  vehicleTypeIconType: 'sedan' | 'suv' | 'minivan' | 'bus' | 'transfer';
  eta: Date;
  etaFormatted: string;
  isNextDay: boolean;
  transitSummary: string;
  highwayRestBufferMinutes: number;
}

export interface VehicleSpec {
  make?: string;
  model?: string;
  bodyType?: string;
  year?: number;
}

/**
 * Calculates estimated travel duration and arrival time based on distance and vehicle type.
 *
 * Speeds are modeled on realistic Ukrainian highway conditions (e.g. M-05 Kyiv-Odesa, M-06 Kyiv-Chop):
 * - Sedans / Hatchbacks: ~85-90 km/h cruising speed
 * - SUVs / Crossovers: ~84-88 km/h cruising speed
 * - Minivans / Passenger vans: ~75 km/h
 * - Intercity Buses: ~60-65 km/h (speed governed to 90 km/h + mandatory station stops)
 * - Express Transfers / Taxi PRO: ~90 km/h (direct express routing)
 */
export function calculateEstimatedTravelTime(
  distanceKm: number,
  category: TransportCategory | string,
  departureTime: string | Date,
  vehicle?: VehicleSpec
): TravelTimeDetails {
  const safeDistance = Math.max(1, distanceKm || 80);

  const bodyType = (vehicle?.bodyType || '').toLowerCase();
  const makeModel = `${vehicle?.make || ''} ${vehicle?.model || ''}`.toLowerCase();

  let avgSpeed = 85;
  let vehicleTypeLabel = 'Легкове авто (Седан / Хетчбек)';
  let vehicleTypeIconType: TravelTimeDetails['vehicleTypeIconType'] = 'sedan';

  if (category === 'bus') {
    avgSpeed = 62;
    vehicleTypeLabel = 'Рейсовий автобус';
    vehicleTypeIconType = 'bus';
  } else if (
    category === 'minibus' ||
    bodyType === 'minivan' ||
    makeModel.includes('vito') ||
    makeModel.includes('transporter') ||
    makeModel.includes('sprinter') ||
    makeModel.includes('traffic') ||
    makeModel.includes('caravelle')
  ) {
    avgSpeed = 74;
    vehicleTypeLabel = 'Мінівен / Мікроавтобус';
    vehicleTypeIconType = 'minivan';
  } else if (category === 'transfer' || category === 'taxi_pro') {
    avgSpeed = 90;
    vehicleTypeLabel = 'Express таксі / Трансфер';
    vehicleTypeIconType = 'transfer';
  } else if (
    bodyType === 'suv' ||
    makeModel.includes('rav4') ||
    makeModel.includes('prado') ||
    makeModel.includes('touareg') ||
    makeModel.includes('duster') ||
    makeModel.includes('tucson') ||
    makeModel.includes('sportage') ||
    makeModel.includes('cx-5') ||
    makeModel.includes('kodiaq')
  ) {
    avgSpeed = 84;
    vehicleTypeLabel = 'Кросовер / Позашляховик';
    vehicleTypeIconType = 'suv';
  } else {
    avgSpeed = 85;
    vehicleTypeLabel = 'Легковий автомобіль (Седан)';
    vehicleTypeIconType = 'sedan';
  }

  // Mandatory short rest stops on long-distance Ukrainian routes (>200 km: +15 min per 200 km)
  const highwayRestBufferMinutes = safeDistance > 200 ? Math.floor(safeDistance / 200) * 15 : 0;

  // Total calculated travel time in minutes
  const drivingMinutes = Math.round((safeDistance / avgSpeed) * 60);
  const totalMinutes = drivingMinutes + highwayRestBufferMinutes;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const durationFormatted = `${hours > 0 ? `${hours} год ` : ''}${minutes} хв`;

  // Calculated arrival time (ETA)
  const depDate = new Date(departureTime);
  const eta = new Date(depDate.getTime() + totalMinutes * 60 * 1000);
  const etaFormatted = eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isNextDay = eta.getDate() !== depDate.getDate();

  return {
    durationMinutes: totalMinutes,
    durationFormatted,
    hours,
    minutes,
    averageSpeedKmH: avgSpeed,
    vehicleTypeLabel,
    vehicleTypeIconType,
    eta,
    etaFormatted,
    isNextDay,
    transitSummary: `${safeDistance} км за ~${avgSpeed} км/год (${vehicleTypeLabel})`,
    highwayRestBufferMinutes
  };
}
