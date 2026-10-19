import { distanceBetween } from './guidance';

type Point = [number, number];

/** Assumed speeds when nothing better is known: a car in town and a person on foot. */
export const DEFAULT_DRIVER_SPEED_MPS = 8.3; // ≈ 30 km/h
export const WALKING_SPEED_MPS = 1.4;

export interface MeetingSnapshot {
  driverToPickupM: number | null;
  passengerToPickupM: number | null;
  betweenM: number | null;
  driverEtaMin: number | null;
  passengerEtaMin: number | null;
  stage: 'FAR' | 'APPROACHING' | 'NEAR' | 'VERY_NEAR' | 'HERE' | null;
}

export const etaMinutes = (meters: number, speedMps: number) => Math.max(1, Math.ceil(meters / Math.max(0.5, speedMps) / 60));

/** Stage of the approach by the distance between the two people (800 / 500 / 200 / 100 / 50 m). */
export function approachStage(meters: number | null): MeetingSnapshot['stage'] {
  if (meters === null) return null;
  if (meters <= 50) return 'HERE';
  if (meters <= 100) return 'VERY_NEAR';
  if (meters <= 200) return 'NEAR';
  if (meters <= 800) return 'APPROACHING';
  return 'FAR';
}

export function meetingSnapshot(input: { pickup: Point | null; driver: Point | null; passenger: Point | null; driverSpeedMps?: number | null }): MeetingSnapshot {
  const { pickup, driver, passenger } = input;
  const driverToPickupM = pickup && driver ? distanceBetween(driver, pickup) : null;
  const passengerToPickupM = pickup && passenger ? distanceBetween(passenger, pickup) : null;
  const betweenM = driver && passenger ? distanceBetween(driver, passenger) : null;
  const driverSpeed = input.driverSpeedMps && input.driverSpeedMps > 2 ? input.driverSpeedMps : DEFAULT_DRIVER_SPEED_MPS;
  return {
    driverToPickupM, passengerToPickupM, betweenM,
    driverEtaMin: driverToPickupM === null ? null : driverToPickupM < 30 ? 0 : etaMinutes(driverToPickupM, driverSpeed),
    passengerEtaMin: passengerToPickupM === null ? null : passengerToPickupM < 20 ? 0 : etaMinutes(passengerToPickupM, WALKING_SPEED_MPS),
    stage: approachStage(betweenM),
  };
}

export function formatMeters(meters: number | null): string {
  if (meters === null) return '—';
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} м`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} км`;
}
export const formatEta = (minutes: number | null) => minutes === null ? '—' : minutes === 0 ? 'на місці' : `≈ ${minutes} хв`;

export const stageText: Record<NonNullable<MeetingSnapshot['stage']>, string> = {
  FAR: 'Ви ще далеко один від одного',
  APPROACHING: 'Ви наближаєтесь один до одного',
  NEAR: 'Зовсім поруч — шукайте один одного очима',
  VERY_NEAR: 'Майже зустрілися',
  HERE: 'Ви на одному місці',
};
