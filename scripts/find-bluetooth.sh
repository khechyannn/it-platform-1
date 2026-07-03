#!/usr/bin/env bash
# Поиск и подключение Marshall Major V (или другого BT-устройства)
set -euo pipefail

echo "=== Bluetooth status ==="
rfkill list bluetooth || true
bluetoothctl show

echo ""
echo "Включи наушники в РЕЖИМ СОПРЯЖЕНИЯ:"
echo "  выключи → зажми китнопку питания ~5 сек до мигания синим"
echo ""
read -r -p "Нажми Enter когда наушники в pairing mode..."

echo ""
echo "=== Сканирование 25 сек (ищем Major / Marshall) ==="
bluetoothctl <<'EOF'
power on
agent on
default-agent
scan on
EOF

sleep 25

bluetoothctl devices | grep -iE 'major|marshall' || bluetoothctl devices

echo ""
read -r -p "Введи MAC-адрес устройства (XX:XX:XX:XX:XX:XX) или Enter для выхода: " MAC
if [[ -z "${MAC}" ]]; then
  bluetoothctl scan off
  exit 0
fi

bluetoothctl <<EOF
pair ${MAC}
trust ${MAC}
connect ${MAC}
scan off
quit
EOF

echo "Готово. Проверь звук в настройках звука."
