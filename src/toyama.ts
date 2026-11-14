import { BUSCATCH, REQUEST_TIMEOUT_MS, STOP_CACHE_TTL_MS } from './constants.js';

export interface LiveBus {
  id: number;
  rosenId: number;
  headsign: string | null;
  lat: number;
  lon: number;
  stopId: number | null;
  stopName: string | null;
  status: string | null;
  mapText: string | null;
  vehicleId: number | null;
}

export interface TripStop {
  stopId: number;
  scheduledTime: string | null;
  expectedTime: string | null;
  passed: boolean;
}

export interface TripInfo {
  rosenId: number;
  tripId: number | null;
  tripNo: number | null;
  tripCount: number | null;
  suspended: boolean;
  headsign: string | null;
  startTime: string | null;
  startStopName: string | null;
  delayMinutes: number | null;
  status: string | null;
  updateTime: string | null;
  stops: TripStop[];
}

export interface StopNames {
  byId: Map<number, string>;
}

interface RawLiveBus {
  id?: number;
  rosen_id?: number;
  headsign?: string | null;
  lat?: string | number | null;
  lon?: string | number | null;
  teiryujo_id?: number | null;
  teiryujo_name?: string | null;
  status?: string | null;
  map_text?: string | null;
  vehicle_id?: number | null;
}

interface RawTripStop {
  teiryujo_id?: number;
  jikokuhyo_time?: string | null;
  yotei_time?: string | null;
  passed?: number | null;
}

interface RawTripInfo {
  rosen_id?: number;
  unko_yotei_id?: number | null;
  unko_no?: number | null;
  unko_count?: number | null;
  unkyu?: number | null;
  unko_jokyo?: string | null;
  trip_headsign?: string | null;
  start_time?: string | null;
  start_teiryujo_name?: string | null;
  delay_minute?: number | null;
  update_time?: string | null;
  jikokuhyo_list?: RawTripStop[] | null;
}

interface RawMapResponse {
  unko_list?: RawLiveBus[] | null;
  teiryujo_list?: { id?: number; name?: string }[] | null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

async function postJson<T>(path: string, params: Record<string, string | number>): Promise<T> {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    body.set(key, String(value));
  }

  let response: Response;
  try {
    response = await fetch(`${BUSCATCH.baseUrl}/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': BUSCATCH.userAgent,
        Referer: `${BUSCATCH.baseUrl}/toyama_map.php`,
      },
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new Error('とやまロケーションシステムに接続できませんでした');
  }

  if (!response.ok) {
    throw new Error(`とやまロケーションシステムの応答が異常です (HTTP ${response.status})`);
  }

  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('とやまロケーションシステムの応答を解析できませんでした');
  }
}

function mapParams(rosenId: number): Record<string, string | number> {
  return {
    id: BUSCATCH.operator,
    command: 'get_unko_list',
    rosen_group_id: BUSCATCH.rosenGroupId,
    keito_id: '',
    rosen_id: rosenId,
  };
}

function dedupeById(buses: LiveBus[]): LiveBus[] {
  const seen = new Set<number>();
  return buses.filter((bus) => {
    if (seen.has(bus.id)) return false;
    seen.add(bus.id);
    return true;
  });
}

export async function fetchLiveBuses(rosenId: number): Promise<LiveBus[]> {
  const raw = await postJson<RawMapResponse>('toyama_map.ajax.php', mapParams(rosenId));

  const buses: LiveBus[] = [];
  for (const item of raw.unko_list ?? []) {
    const lat = toNumber(item.lat);
    const lon = toNumber(item.lon);
    if (lat === null || lon === null) continue;
    buses.push({
      id: toNumber(item.id) ?? -1,
      rosenId: toNumber(item.rosen_id) ?? rosenId,
      headsign: item.headsign ?? null,
      lat,
      lon,
      stopId: toNumber(item.teiryujo_id),
      stopName: item.teiryujo_name ?? null,
      status: item.status ?? null,
      mapText: item.map_text ?? null,
      vehicleId: toNumber(item.vehicle_id),
    });
  }

  return dedupeById(buses);
}

export async function fetchTripInfo(rosenId: number, tripId: number | null): Promise<TripInfo> {
  const params: Record<string, string | number> = {
    id: BUSCATCH.operator,
    command: 'get_unko_rosen_info',
    rosen_id: rosenId,
  };
  if (tripId !== null) params.unko_yotei_id = tripId;

  const raw = await postJson<RawTripInfo>('unko.ajax.php', params);

  const stops: TripStop[] = [];
  for (const stop of raw.jikokuhyo_list ?? []) {
    const stopId = toNumber(stop.teiryujo_id);
    if (stopId === null) continue;
    stops.push({
      stopId,
      scheduledTime: stop.jikokuhyo_time ?? null,
      expectedTime: stop.yotei_time ?? null,
      passed: toNumber(stop.passed) !== null,
    });
  }

  return {
    rosenId: toNumber(raw.rosen_id) ?? rosenId,
    tripId: toNumber(raw.unko_yotei_id),
    tripNo: toNumber(raw.unko_no),
    tripCount: toNumber(raw.unko_count),
    suspended: toNumber(raw.unkyu) === 1,
    headsign: raw.trip_headsign ?? null,
    startTime: raw.start_time ?? null,
    startStopName: raw.start_teiryujo_name ?? null,
    delayMinutes: toNumber(raw.delay_minute),
    status: raw.unko_jokyo ?? null,
    updateTime: raw.update_time ?? null,
    stops,
  };
}

const stopCache = new Map<number, { expiresAt: number; names: StopNames }>();

export async function fetchStopNames(rosenId: number): Promise<StopNames> {
  const cached = stopCache.get(rosenId);
  if (cached && cached.expiresAt > Date.now()) return cached.names;

  const raw = await postJson<RawMapResponse>('toyama_map.ajax.php', mapParams(rosenId));

  const byId = new Map<number, string>();
  for (const stop of raw.teiryujo_list ?? []) {
    const id = toNumber(stop.id);
    if (id !== null && stop.name) byId.set(id, stop.name);
  }

  const names: StopNames = { byId };
  stopCache.set(rosenId, { expiresAt: Date.now() + STOP_CACHE_TTL_MS, names });
  return names;
}
