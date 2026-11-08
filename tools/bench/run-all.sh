#!/usr/bin/env bash
# Ejecuta las pruebas de banco gen01…gen07 en orden y deja los resultados en tools/bench/out/ (paso 8).
cd "$(dirname "$0")/../.."
OUT=tools/bench/out
for t in gen01-esqueleto gen03-rata-callejera gen04-edgerunner gen05-paquete-completo gen06-pnj gen07-edgerunners; do
  mkdir -p "$OUT/$t"
  echo "== $t $(date +%H:%M:%S)"
  timeout 900 node "tools/bench/$t.mjs" "$OUT/$t/result.json" "$OUT/$t" > "$OUT/$t/log.txt" 2>&1
  echo "   salida $?"
done
echo "== fin $(date +%H:%M:%S)"
