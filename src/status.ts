import { KOSEN_LINE, KOSEN_TERMINAL_STOP_ID, AHEAD_MAX_STOPS } from './constants.js';
import type { LiveBus, StopNames, TripInfo, TripStop } from './toyama.js';

export interface BusSnapshot {
  bus: LiveBus;
  trip: TripInfo;
  stopNames: StopNames;
}

export const LINE_LABEL = `${KOSEN_LINE.keitoName} / 国立高専前行き`;

const KOSEN_STOP_NAME = '国立高専前';

function formatClock(date: Date): string {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function mapUrl(bus: LiveBus): string {
  return `https://www.google.com/maps?q=${bus.lat},${bus.lon}`;
}

function stopName(stop: TripStop, stopNames: StopNames): string {
  return stopNames.byId.get(stop.stopId) ?? `停留所${stop.stopId}`;
}

function isServed(stop: TripStop): boolean {
  return stop.scheduledTime !== null || stop.expectedTime !== null;
}

function terminalStop(trip: TripInfo): TripStop | undefined {
  return trip.stops.find((stop) => stop.stopId === KOSEN_TERMINAL_STOP_ID && isServed(stop));
}

function arrivalLine(trip: TripInfo, stopNames: StopNames): string | null {
  const terminal = terminalStop(trip);
  const time = terminal?.expectedTime ?? terminal?.scheduledTime;
  if (!terminal || !time) return null;
  const name = stopNames.byId.get(KOSEN_TERMINAL_STOP_ID) ?? KOSEN_STOP_NAME;
  return `**${name} ${time} 着**${terminal.passed ? '（通過済み）' : ''}`;
}

function aheadNames(trip: TripInfo, stopNames: StopNames): string {
  const names = trip.stops
    .filter((stop) => !stop.passed && isServed(stop))
    .map((stop) => stopName(stop, stopNames));
  if (names.length === 0) return '';
  if (names.length <= AHEAD_MAX_STOPS) return names.join(' → ');
  return `${names.slice(0, AHEAD_MAX_STOPS).join(' → ')} → …（残り${names.length}か所）`;
}

function formatRunning(snapshot: BusSnapshot): string {
  const { bus, trip, stopNames } = snapshot;
  const lines: string[] = [];

  lines.push(bus.stopName ? `現在地: **${bus.stopName}** 付近` : '現在地: 位置情報のみ');

  const detail: string[] = [];
  if (trip.headsign) detail.push(trip.headsign);
  if (trip.startTime) {
    detail.push(trip.startStopName ? `${trip.startStopName} ${trip.startTime}発` : `${trip.startTime}発`);
  }
  if (detail.length > 0) lines.push(detail.join(' / '));

  const state: string[] = [];
  if (trip.status) state.push(trip.status);
  if (
    trip.delayMinutes !== null &&
    trip.delayMinutes !== 0 &&
    !trip.status?.includes('遅れ')
  ) {
    state.push(`遅れ ${trip.delayMinutes} 分`);
  }
  if (bus.mapText) state.push(bus.mapText);
  if (state.length > 0) lines.push(`運行: ${state.join(' / ')}`);

  const ahead = aheadNames(trip, stopNames);
  if (ahead) lines.push(`この先: ${ahead}`);

  const arrival = arrivalLine(trip, stopNames);
  if (arrival) lines.push(arrival);

  lines.push(`[地図を開く](${mapUrl(bus)})`);
  return lines.join('\n');
}

function formatWaiting(trip: TripInfo | null, stopNames: StopNames): string {
  if (!trip) return 'いま高専方面を走っているバスはいません。';

  if (trip.suspended) {
    return 'いま高専方面を走っているバスはいません。\n本日の運行は運休です。';
  }

  const lines = ['いま高専方面を走っているバスはいません。'];

  if (trip.startTime) {
    const from = trip.startStopName ?? '始発';
    const headsign = trip.headsign ? `（${trip.headsign}）` : '';
    lines.push(`次の便: ${from} ${trip.startTime}発${headsign}`);
  }

  const arrival = arrivalLine(trip, stopNames);
  if (arrival) lines.push(arrival);

  if (!trip.startTime && !arrival) {
    lines.push('運行時間外か、本日の運行が終了したようです。');
  }

  return lines.join('\n');
}

export function formatStatus(
  snapshots: BusSnapshot[],
  fallbackTrip: TripInfo | null,
  stopNames: StopNames,
  now: Date = new Date(),
): string {
  const body =
    snapshots.length > 0
      ? snapshots.map(formatRunning).join('\n\n')
      : formatWaiting(fallbackTrip, stopNames);

  const updated = snapshots[0]?.trip.updateTime ?? fallbackTrip?.updateTime ?? formatClock(now);
  const footer = `-# ${updated} 時点 / とやまロケーションシステム`;

  return [`**${LINE_LABEL}**`, body, footer].join('\n');
}
