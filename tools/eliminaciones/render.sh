#!/bin/bash
# Renderiza las animaciones de eliminación con Blender (como módulo de Python) y las deja en public/elim/.
#
#   python3 -m venv /tmp/blenv && /tmp/blenv/bin/pip install bpy==5.3.0
#   BLENDER_PY=/tmp/blenv/bin/python tools/eliminaciones/render.sh [rayo agujero pinata cohete ovni hielo]
#
# Cada escena tarda unos minutos en CPU (Cycles). La piñata usa BebasNeue.ttf (la letra de la app, licencia OFL). Para una vista rápida de algunos cuadros:
#   $BLENDER_PY tools/eliminaciones/rayo.py -- --dir tools/eliminaciones --out /tmp/prev --pct 35 --frames 12,22,30
set -e
cd "$(dirname "$0")/../.."
PY=${BLENDER_PY:-python3}
WORK=${WORK:-/tmp/elim-frames}
names=${*:-rayo agujero pinata cohete ovni hielo}
mkdir -p public/elim
for n in $names; do
  rm -rf "$WORK/$n" && mkdir -p "$WORK/$n"
  "$PY" tools/eliminaciones/$n.py -- --dir tools/eliminaciones --out "$WORK/$n"
  # Resplandor (desenfoque sumado en modo "pantalla") y H.264 para que se vea en cualquier teléfono.
  ffmpeg -loglevel error -y -framerate 24 -i "$WORK/$n/f%04d.png" \
    -filter_complex "[0]format=gbrp,split[a][b];[b]gblur=sigma=16,eq=saturation=1.25[g];[a][g]blend=all_mode=screen:all_opacity=0.7,vignette=angle=0.5,format=yuv420p" \
    -c:v libx264 -preset slow -crf 27 -tune animation -movflags +faststart -an public/elim/$n.mp4
  echo "listo: public/elim/$n.mp4"
done
