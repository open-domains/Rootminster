import { useEffect } from 'react';
import { usePublicConfig } from '@/lib/public-config';

function hexToHsl(hex) {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
  if (!match) return null;
  let [r, g, b] = match.slice(1).map((part) => Number.parseInt(part, 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  let hue = 0;
  let saturation = 0;
  if (max !== min) {
    const delta = max - min;
    saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === r) hue = (g - b) / delta + (g < b ? 6 : 0);
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue /= 6;
  }
  return `${Math.round(hue * 360)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
}

export default function BrandRuntime({ children }) {
  const { config } = usePublicConfig();
  useEffect(() => {
    const branding = config.branding;
    if (!branding) return;
    document.title = branding.platform_name;
    const hsl = hexToHsl(branding.primary_color);
    if (hsl) {
      document.documentElement.style.setProperty('--primary', hsl);
      document.documentElement.style.setProperty('--ring', hsl);
      document.documentElement.style.setProperty('--sidebar-primary', hsl);
    }
  }, [config.branding]);
  return children;
}
