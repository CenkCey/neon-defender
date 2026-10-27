import { GALAXIES } from './content.ts';
function mix(a: string, b: string, t: number) {
  const channels = [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t));
  return `rgb(${channels.join(',')})`;
}
/** A bounded two-second palette transition; no shaders or media assets. */
export function createTheme() {
  let current = 0, previous = 0, blend = 1;
  return {
    update(index: number, dt: number) {
      if (index !== current) { previous = current; current = index; blend = 0; }
      blend = Math.min(1, blend + dt / 2);
      const from = GALAXIES[previous], to = GALAXIES[current];
      return { background: mix(from.background, to.background, blend), accent: mix(from.accent, to.accent, blend), secondary: mix(from.secondary, to.secondary, blend) };
    },
  };
}
