export const BUSCATCH = {
  baseUrl: 'https://buscatch.jp/rt3',
  operator: 'chitetsu',
  rosenGroupId: 1975,
  userAgent:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
} as const;

export const KOSEN_LINE = {
  keitoName: '興人・国立高専線',
  towardKosen: 3626,
} as const;

export const KOSEN_TERMINAL_STOP_ID = 530347;

export const STOP_CACHE_TTL_MS = 10 * 60 * 1000;

export const AHEAD_MAX_STOPS = 6;

export const REQUEST_TIMEOUT_MS = 10_000;
