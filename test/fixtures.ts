import type { LiveBus, StopNames, TripInfo, TripStop } from '../src/toyama.js';

export function makeStop(stopId: number, scheduled: string | null, passed = false): TripStop {
  return {
    stopId,
    scheduledTime: scheduled,
    expectedTime: scheduled,
    passed,
  };
}

export function makeTrip(overrides: Partial<TripInfo> = {}): TripInfo {
  return {
    rosenId: 3626,
    tripId: 930899,
    tripNo: 9,
    tripCount: 9,
    suspended: false,
    headsign: '46国立高専（朝菜町 経由）',
    startTime: '20:10',
    startStopName: '富山駅前',
    delayMinutes: null,
    status: '運行待ち',
    updateTime: '20:05',
    stops: [],
    ...overrides,
  };
}

export function makeBus(overrides: Partial<LiveBus> = {}): LiveBus {
  return {
    id: 930899,
    rosenId: 3626,
    headsign: '46国立高専（朝菜町 経由）',
    lat: 36.697497,
    lon: 137.213345,
    stopId: 530292,
    stopName: '富山駅前',
    status: '通常運行',
    mapText: null,
    vehicleId: 3716,
    ...overrides,
  };
}

export function makeStopNames(entries: [number, string][]): StopNames {
  return { byId: new Map(entries) };
}

export const KOSEN_ROUTE_STOPS: [number, string][] = [
  [530282, '奥田北小学校前'],
  [530283, '興人団地'],
  [530284, '下新北町3区'],
  [530291, '富山駅北口'],
  [530292, '富山駅前'],
  [530293, '富山市役所前'],
  [530294, '城址公園前'],
  [530295, '総曲輪'],
  [530296, '星井町1丁目'],
  [530297, '星井町'],
  [530298, '西中野口'],
  [530299, '花園町'],
  [530300, '太郎丸口'],
  [530330, '富山市民病院口'],
  [530333, '南富山駅前'],
  [530336, '南堀川'],
  [530337, '朝菜町六丁目'],
  [530340, '新堀町'],
  [530343, '堀（高専）'],
  [530345, '西本郷（高専）'],
  [530346, '本郷四区'],
  [530347, '国立高専前'],
];

export function makeKosenTrip(overrides: Partial<TripInfo> = {}): TripInfo {
  const stops = KOSEN_ROUTE_STOPS.map(([stopId, name], index) =>
    makeStop(stopId, `${String(8 + Math.floor(index / 6)).padStart(2, '0')}:${String((index * 2) % 60).padStart(2, '0')}`),
  );
  return makeTrip({ stops, ...overrides });
}
