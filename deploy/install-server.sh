#!/usr/bin/env bash
# 新 bot を kanon-server に同居させる。既存サービスには触れない。
# 実行: sudo bash deploy/install-server.sh
set -euo pipefail

REPO_DIR=/srv/toyamakosen-bus-bot
ADMIN_USER=${ADMIN_USER:-paleblue_2032}
UNIT=toyamakosen-bus-bot.service
SUDOERS=/etc/sudoers.d/90-cmd-maintenance

if [ "$(id -u)" -ne 0 ]; then
  echo "root で実行してください: sudo bash $0" >&2
  exit 1
fi

admin_home="$(getent passwd "$ADMIN_USER" | cut -d: -f6)"

echo "== 1. リポジトリを配置 =="
if [ ! -d "$REPO_DIR/.git" ]; then
  install -d -o "$ADMIN_USER" -g "$ADMIN_USER" -m 755 "$REPO_DIR"
  runuser -u "$ADMIN_USER" -- git clone \
    https://github.com/paleblue-2032/toyamakosen-bus-bot.git "$REPO_DIR"
else
  runuser -u "$ADMIN_USER" -- git -C "$REPO_DIR" pull --ff-only
fi

echo "== 2. ビルド =="
runuser -u "$ADMIN_USER" -- env HOME="$admin_home" \
  PATH=/nix/var/nix/profiles/default/bin:/usr/local/bin:/usr/bin:/bin \
  nix build "$REPO_DIR#default" -o "$REPO_DIR/result" --print-build-logs

echo "== 3. .env（既存は上書きしない） =="
if [ ! -f "$REPO_DIR/.env" ]; then
  umask 077
  cat >"$REPO_DIR/.env" <<'ENV'
DISCORD_TOKEN=
DISCORD_GUILD_ID=
ENV
  chown root:root "$REPO_DIR/.env"
  chmod 600 "$REPO_DIR/.env"
  echo "作成しました。トークンを記入してください: sudo nano $REPO_DIR/.env"
else
  echo "既存の .env はそのまま使います"
fi
# git 管理下の .env を誤ってコミットしないよう念のため
chmod 600 "$REPO_DIR/.env"

echo "== 4. systemd unit =="
install -o root -g root -m 644 "$REPO_DIR/deploy/$UNIT" "/etc/systemd/system/$UNIT"
systemctl daemon-reload

if grep -qE '^DISCORD_TOKEN=.+' "$REPO_DIR/.env"; then
  systemctl enable "$UNIT"
  systemctl restart "$UNIT"
  systemctl is-active "$UNIT"
else
  echo "DISCORD_TOKEN が未設定のため自動起動は有効化していません"
  echo "記入後に次を実行してください: sudo botctl restart kosen"
fi

echo "== 5. botctl =="
install -o root -g root -m 755 "$REPO_DIR/deploy/botctl" /usr/local/sbin/botctl

echo "== 6. sudoers（広い env/bash 許可を撤去し botctl に一本化） =="
tmp="$(mktemp)"
printf '%s ALL=(root) NOPASSWD: /usr/local/sbin/botctl\n' "$ADMIN_USER" >"$tmp"
chmod 440 "$tmp"
visudo -cf "$tmp" >/dev/null

if [ -f "$SUDOERS" ]; then
  backup="/root/90-cmd-maintenance.bak.$(date +%Y%m%d%H%M%S)"
  cp -p "$SUDOERS" "$backup"
  echo "旧設定を $backup に退避しました"
fi
install -o root -g root -m 440 "$tmp" "$SUDOERS"
rm -f "$tmp"
visudo -c >/dev/null

echo
echo "完了しました。"
echo "  sudo nano $REPO_DIR/.env"
echo "  sudo botctl restart kosen"
echo "  sudo botctl logs kosen"
echo
echo "既存 bot も同じ入口に統一:"
echo "  sudo botctl status commandcode"
echo "  sudo botctl deploy commandcode"
