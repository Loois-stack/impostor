import qrcode from 'qrcode-generator';
import { useMemo } from 'react';

/** Código QR dibujado en SVG (sin pedirle nada a ningún servidor). */
export function QR({ text, size = 168 }: { text: string; size?: number }) {
  const { n, path } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const count = qr.getModuleCount();
    let d = '';
    for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return { n: count, path: d };
  }, [text]);
  return (
    <svg width={size} height={size} viewBox={`-2 -2 ${n + 4} ${n + 4}`} role="img" aria-label="Código QR para entrar a la sala" style={{ borderRadius: 14, background: '#fff', display: 'block' }}>
      <path d={path} fill="#0a0710" />
    </svg>
  );
}
