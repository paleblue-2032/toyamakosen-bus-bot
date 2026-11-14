import { KOSEN_LINE } from './constants.js';
import { formatStatus, type BusSnapshot } from './status.js';
import { fetchLiveBuses, fetchStopNames, fetchTripInfo } from './toyama.js';
import type { TripInfo } from './toyama.js';

async function fetchTrips(tripIds: number[]): Promise<Map<number, TripInfo>> {
  const entries = await Promise.all(
    tripIds.map(async (tripId) => {
      const trip = await fetchTripInfo(KOSEN_LINE.towardKosen, tripId).catch(() => null);
      return trip ? ([tripId, trip] as const) : null;
    }),
  );

  const byId = new Map<number, TripInfo>();
  for (const entry of entries) {
    if (entry) byId.set(entry[0], entry[1]);
  }
  return byId;
}

export async function getKosenStatus(now: Date = new Date()): Promise<string> {
  const [liveBuses, stopNames] = await Promise.all([
    fetchLiveBuses(KOSEN_LINE.towardKosen),
    fetchStopNames(KOSEN_LINE.towardKosen),
  ]);

  if (liveBuses.length > 0) {
    const trips = await fetchTrips(liveBuses.map((bus) => bus.id));
    const snapshots: BusSnapshot[] = [];
    for (const bus of liveBuses) {
      const trip = trips.get(bus.id);
      if (trip) snapshots.push({ bus, trip, stopNames });
    }
    if (snapshots.length > 0) {
      return formatStatus(snapshots, null, stopNames, now);
    }
  }

  const fallback = await fetchTripInfo(KOSEN_LINE.towardKosen, null).catch(() => null);
  return formatStatus([], fallback, stopNames, now);
}
