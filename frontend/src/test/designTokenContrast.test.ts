import { describe, expect, it } from 'vitest';
// @ts-expect-error Node typings are intentionally not part of the browser application.
import { readFileSync } from 'node:fs';

// @ts-expect-error Node typings are intentionally not part of the browser application.
const theme = readFileSync(`${process.cwd()}/src/index.css`, 'utf8');


function readColor(name: string): [number, number, number] {
  const value = theme.match(new RegExp(`--color-${name}:\\s*(#[0-9A-Fa-f]{6})`))?.[1];
  if (!value) throw new Error(`Missing color token: ${name}`);
  return [1, 3, 5].map(index => Number.parseInt(value.slice(index, index + 2), 16)) as [number, number, number];
}

function luminance(color: [number, number, number]): number {
  const [r, g, b] = color.map(channel => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foreground: [number, number, number], background: [number, number, number]): number {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function blend(foreground: [number, number, number], background: [number, number, number], alpha: number): [number, number, number] {
  return foreground.map((channel, index) => Math.round(channel * alpha + background[index] * (1 - alpha))) as [number, number, number];
}

describe('readable semantic color tokens', () => {
  it('keeps the existing brand and danger fill colors unchanged', () => {
    expect(theme).toContain('--color-brand-primary: #D3613C;');
    expect(theme).toContain('--color-danger: #EF4444;');
  });

  it.each([
    ['brand-readable', 'brand-primary'],
    ['danger-readable', 'danger'],
  ])('provides %s contrast on every dark surface and its tinted state background', (foregroundName, tintName) => {
    const foreground = readColor(foregroundName);
    const surfaces = ['surface-0', 'surface-1', 'surface-2', 'surface-3'].map(readColor);

    for (const surface of surfaces) {
      expect(contrastRatio(foreground, surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(foreground, blend(readColor(tintName), surface, 0.15))).toBeGreaterThanOrEqual(4.5);
    }
  });
});
