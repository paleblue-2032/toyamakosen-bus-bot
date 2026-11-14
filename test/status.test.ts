import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatStatus } from '../src/status.js';
import { KOSEN_ROUTE_STOPS, makeBus, makeKosenTrip, makeStop, makeStopNames, makeTrip } from './fixtures.js';

const stopNames = makeStopNames(KOSEN_ROUTE_STOPS);
const now = new Date('2026-11-14T11:05:00Z');

describe('formatStatus', () => {
  it('現在地・行き先・高専到着予定を表示する', () => {
    const bus = makeBus({ stopName: '富山駅前', stopId: 530292 });
    const trip = makeKosenTrip({ tripId: bus.id, updateTime: '20:05' });

    const text = formatStatus([{ bus, trip, stopNames }], null, stopNames, now);

    assert.match(text, /興人・国立高専線 \/ 国立高専前行き/);
    assert.match(text, /現在地: \*\*富山駅前\*\* 付近/);
    assert.match(text, /46国立高専/);
    assert.match(text, /富山駅前 20:10発/);
    assert.match(text, /国立高専前 \d{2}:\d{2} 着/);
    assert.match(text, /20:05 時点/);
  });

  it('遅延を分単位で表示する', () => {
    const bus = makeBus();
    const trip = makeKosenTrip({ delayMinutes: 7, status: '通常運行' });

    const text = formatStatus([{ bus, trip, stopNames }], null, stopNames, now);

    assert.match(text, /遅れ 7 分/);
  });

  it('運行情報に遅延が含まれるときは二重に出さない', () => {
    const bus = makeBus();
    const trip = makeKosenTrip({ delayMinutes: 5, status: '5分遅れ' });

    const text = formatStatus([{ bus, trip, stopNames }], null, stopNames, now);

    assert.equal(text.match(/遅れ/g)?.length, 1);
  });

  it('遅延ゼロは表示しない', () => {
    const bus = makeBus();
    const trip = makeKosenTrip({ delayMinutes: 0 });

    const text = formatStatus([{ bus, trip, stopNames }], null, stopNames, now);

    assert.doesNotMatch(text, /遅れ/);
  });

  it('通過済みの停留所をこの先に含めない', () => {
    const stops = KOSEN_ROUTE_STOPS.map(([stopId], index) => makeStop(stopId, '08:00', index < 4));
    const bus = makeBus({ stopName: '富山駅前' });
    const trip = makeKosenTrip({ stops });

    const text = formatStatus([{ bus, trip, stopNames }], null, stopNames, now);

    assert.match(text, /この先: 富山駅前/);
    assert.doesNotMatch(text, /この先: 奥田北小学校前/);
  });

  it('この先が長い場合は省略する', () => {
    const bus = makeBus();
    const trip = makeKosenTrip();

    const text = formatStatus([{ bus, trip, stopNames }], null, stopNames, now);

    assert.match(text, /…（残り\d+か所）/);
  });

  it('走行中のバスが無いときは次の便を出す', () => {
    const trip = makeKosenTrip({ status: '運行待ち', startTime: '20:10' });

    const text = formatStatus([], trip, stopNames, now);

    assert.match(text, /走っているバスはいません/);
    assert.match(text, /次の便: 富山駅前 20:10発/);
  });

  it('出発時刻を過ぎた便を「次の便」と呼ばない', () => {
    // now は JST 20:05。20:10 発は未来なので「次の便」。
    const before = makeKosenTrip({ status: '運行待ち', startTime: '20:10' });
    assert.match(formatStatus([], before, stopNames, now), /次の便/);

    // JST 20:20 から見ると 20:10 発は過去。
    const after = new Date('2026-11-14T11:20:00Z');
    const text = formatStatus([], before, stopNames, after);
    assert.doesNotMatch(text, /次の便/);
    assert.match(text, /本日の運行は終了しました/);
  });

  it('運行終了のステータスを尊重する', () => {
    const trip = makeKosenTrip({ status: '運行終了', startTime: '22:10' });

    const text = formatStatus([], trip, stopNames, now);

    assert.doesNotMatch(text, /次の便/);
    assert.match(text, /本日の運行は終了しました/);
  });

  it('運休を明示する', () => {
    const trip = makeKosenTrip({ suspended: true, startTime: null });

    const text = formatStatus([], trip, stopNames, now);

    assert.match(text, /運休/);
  });

  it('情報が何も無いときは運行時間外と伝える', () => {
    const trip = makeTrip({ stops: [], startTime: null, status: null });

    const text = formatStatus([], trip, stopNames, now);

    assert.match(text, /運行時間外/);
  });

  it('地図リンクに座標を入れる', () => {
    const bus = makeBus({ lat: 36.697497, lon: 137.213345 });
    const trip = makeKosenTrip();

    const text = formatStatus([{ bus, trip, stopNames }], null, stopNames, now);

    assert.match(text, /https:\/\/www\.google\.com\/maps\?q=36\.697497,137\.213345/);
  });

  it('複数台いるときは全部並べる', () => {
    const tripA = makeKosenTrip({ tripId: 1, headsign: '1便' });
    const tripB = makeKosenTrip({ tripId: 2, headsign: '2便' });

    const text = formatStatus(
      [
        { bus: makeBus({ id: 1, stopName: '富山駅前' }), trip: tripA, stopNames },
        { bus: makeBus({ id: 2, stopName: '南富山駅前' }), trip: tripB, stopNames },
      ],
      null,
      stopNames,
      now,
    );

    assert.match(text, /富山駅前/);
    assert.match(text, /南富山駅前/);
    assert.equal(text.match(/現在地/g)?.length, 2);
  });
});
