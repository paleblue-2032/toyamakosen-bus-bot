# toyamakosen-bus-bot

とやまロケーションシステムから、富山地方鉄道「興人・国立高専線」の**国立高専前行き**の現在地を取得して Discord に返す bot。

`/kosen` を実行すると、いま走っているバスの位置・遅延・この先の停留所・国立高専前の到着予定を表示する。

```
**興人・国立高専線 / 国立高専前行き**
現在地: **総曲輪** 付近
46国立高専（朝菜町 経由） / 富山駅前 20:10発
運行: 6分遅れ / ノンステップバス
この先: 星井町１丁目 → 星井町 → 西中野口 → 花園町 → 太郎丸口 → 富山市民病院口 → …（残り23か所）
**国立高専前 20:36 着**
[地図を開く](https://www.google.com/maps?q=36.689035,137.212473)
-# 20:19 時点 / とやまロケーションシステム
```

## 使い方

Discord で `/kosen` を実行するだけ。

- 走行中のバスがいれば、台数分だけ現在地を並べる
- 走行中でなければ、次の便の発時刻と高専到着予定を出す
- 運休ならその旨を出す

## 仕組み

とやまロケーションシステムの公開サイト (buscatch.jp) が内部で使っている JSON エンドポイントを直接叩いている。

| 用途 | エンドポイント |
| --- | --- |
| 走行中の車両一覧 | `POST https://buscatch.jp/rt3/toyama_map.ajax.php` (`command=get_unko_list`) |
| 便の詳細・停留所ごとの通過/予定時刻 | `POST https://buscatch.jp/rt3/unko.ajax.php` (`command=get_unko_rosen_info`) |

- 路線ID: `rosen_id=3626`（興人・国立高専線 国立高専前行き）
- 車両一覧の `id` が便ID (`unko_yotei_id`) と一致するので、それをキーに詳細を引く
- 停留所名は同じ `get_unko_list` の `teiryujo_list` から取得し、10 分キャッシュする
- `lat` / `lon` は文字列で返るので数値に変換する

公式 API ではないため、サイト構造が変わると動かなくなる可能性がある。

## 環境変数

`.env.example` を参照。

| 変数 | 内容 |
| --- | --- |
| `DISCORD_TOKEN` | Bot トークン（必須） |
| `DISCORD_GUILD_ID` | コマンドを登録するギルド ID（任意）。未指定ならグローバル登録 |

## 開発

Nix で環境を揃えている。

```bash
nix develop
npm install --include=dev
npm test
npm run typecheck
npm run build
```

実データでの確認:

```bash
nix develop --command npx tsx scripts/live.ts
```

## デプロイ

```bash
nix build .# --print-build-logs
```

systemd unit は `deploy/toyamakosen-bus-bot.service`。

```bash
sudo systemctl restart toyamakosen-bus-bot
sudo journalctl -u toyamakosen-bus-bot -f
```

## 構成

| パス | 内容 |
| --- | --- |
| `src/index.ts` | Discord 接続、`/kosen` の登録と応答 |
| `src/service.ts` | 車両一覧と便詳細を突き合わせて整形済みテキストを作る |
| `src/toyama.ts` | とやまロケーションシステムの API クライアント |
| `src/status.ts` | Discord 向けメッセージ整形 |
| `src/constants.ts` | 路線ID・キャッシュ TTL など |
| `test/` | node:test + tsx。フォーマッタと API パースのテスト |
| `scripts/live.ts` | 実 API を叩いて表示を確認するスクリプト |
