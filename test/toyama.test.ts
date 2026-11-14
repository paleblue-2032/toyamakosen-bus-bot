import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { fetchLiveBuses, fetchTripInfo } from '../src/toyama.js';

type Handler = (url: string, init: RequestInit | undefined) => Response | Promise<Response>;

const originalFetch = globalThis.fetch;
let handler: Handler | null = null;

function mockFetch(next: Handler): void {
  handler = next;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (!handler) throw new Error('no handler');
    return handler(url, init);
  }) as typeof fetch;
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  handler = null;
});

describe('fetchLiveBuses', () => {
  it('運行中のバスを緯度経度つきで返す', async () => {
    mockFetch(() =>
      json({
        unko_list: [
          {
            id: 930895,
            rosen_id: 3598,
            headsign: '小杉・高岡線 小杉駅前 行き',
            lat: '36.697497',
            lon: '137.213345',
            teiryujo_id: 529016,
            teiryujo_name: '富山駅前',
            status: '通常運行',
            map_text: 'ノンステップバス',
            vehicle_id: 3716,
          },
        ],
      }),
    );

    const buses = await fetchLiveBuses(3626);

    assert.equal(buses.length, 1);
    assert.deepEqual(buses[0], {
      id: 930895,
      rosenId: 3598,
      headsign: '小杉・高岡線 小杉駅前 行き',
      lat: 36.697497,
      lon: 137.213345,
      stopId: 529016,
      stopName: '富山駅前',
      status: '通常運行',
      mapText: 'ノンステップバス',
      vehicleId: 3716,
    });
  });

  it('座標の無いエントリは捨てる', async () => {
    mockFetch(() => json({ unko_list: [{ id: 1, lat: null, lon: null }] }));

    const buses = await fetchLiveBuses(3626);

    assert.equal(buses.length, 0);
  });

  it('同じ id の重複を取り除く', async () => {
    mockFetch(() =>
      json({
        unko_list: [
          { id: 1, lat: '36.1', lon: '137.1' },
          { id: 1, lat: '36.1', lon: '137.1' },
          { id: 2, lat: '36.2', lon: '137.2' },
        ],
      }),
    );

    const buses = await fetchLiveBuses(3626);

    assert.deepEqual(
      buses.map((bus) => bus.id),
      [1, 2],
    );
  });

  it('unko_list が null でも空配列を返す', async () => {
    mockFetch(() => json({ unko_list: null }));

    assert.deepEqual(await fetchLiveBuses(3626), []);
  });

  it('HTTP エラーを日本語メッセージにする', async () => {
    mockFetch(() => new Response('', { status: 503 }));

    await assert.rejects(fetchLiveBuses(3626), /HTTP 503/);
  });

  it('JSON でない応答をエラーにする', async () => {
    mockFetch(() => new Response('<html>error</html>', { status: 200 }));

    await assert.rejects(fetchLiveBuses(3626), /解析できません/);
  });
});

describe('fetchTripInfo', () => {
  it('便の詳細と停留所リストを返す', async () => {
    mockFetch(() =>
      json({
        rosen_id: 3626,
        unko_yotei_id: 930899,
        unko_no: 9,
        unko_count: 9,
        unkyu: 0,
        unko_jokyo: '運行待ち',
        trip_headsign: '46国立高専（朝菜町 経由）',
        start_time: '20:10',
        start_teiryujo_name: '富山駅前',
        delay_minute: null,
        update_time: '20:05',
        jikokuhyo_list: [
          { teiryujo_id: 530282, jikokuhyo_time: null, yotei_time: null, passed: null },
          {
            teiryujo_id: 530292,
            jikokuhyo_time: '20:10',
            yotei_time: '20:10',
            passed: null,
          },
          {
            teiryujo_id: 530293,
            jikokuhyo_time: '20:11',
            yotei_time: '20:12',
            passed: 1,
          },
        ],
      }),
    );

    const trip = await fetchTripInfo(3626, 930899);

    assert.equal(trip.tripId, 930899);
    assert.equal(trip.tripNo, 9);
    assert.equal(trip.suspended, false);
    assert.equal(trip.headsign, '46国立高専（朝菜町 経由）');
    assert.equal(trip.startTime, '20:10');
    assert.equal(trip.delayMinutes, null);
    assert.deepEqual(trip.stops, [
      { stopId: 530282, scheduledTime: null, expectedTime: null, passed: false },
      { stopId: 530292, scheduledTime: '20:10', expectedTime: '20:10', passed: false },
      { stopId: 530293, scheduledTime: '20:11', expectedTime: '20:12', passed: true },
    ]);
  });

  it('運休フラグを解釈する', async () => {
    mockFetch(() => json({ rosen_id: 3817, unkyu: 1, unko_jokyo: '運休', jikokuhyo_list: null }));

    const trip = await fetchTripInfo(3817, null);

    assert.equal(trip.suspended, true);
    assert.deepEqual(trip.stops, []);
  });

  it('便IDを指定したときだけ unko_yotei_id を送る', async () => {
    const bodies: string[] = [];
    mockFetch((_url, init) => {
      bodies.push(String(init?.body ?? ''));
      return json({ rosen_id: 3626 });
    });

    await fetchTripInfo(3626, 930899);
    await fetchTripInfo(3626, null);

    assert.match(bodies[0] ?? '', /unko_yotei_id=930899/);
    assert.doesNotMatch(bodies[1] ?? '', /unko_yotei_id/);
  });
});
