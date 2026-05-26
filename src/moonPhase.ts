const SYNODIC_MONTH_MS = 29.530588853 * 24 * 60 * 60 * 1000;
const KNOWN_NEW_MOON_UTC_MS = Date.UTC(2000, 0, 6, 18, 14);

export const MOON_PHASE_COUNT = 8;

export type MoonPhaseIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type MoonPhase = {
  index: MoonPhaseIndex;
  label: string;
};

export const moonPhaseLabels = [
  "Luna nueva",
  "Luna creciente",
  "Cuarto creciente",
  "Gibosa creciente",
  "Luna llena",
  "Gibosa menguante",
  "Cuarto menguante",
  "Luna menguante",
] as const satisfies readonly string[];

function positiveModulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

function getMoonAgeMs(date: Date) {
  return positiveModulo(date.getTime() - KNOWN_NEW_MOON_UTC_MS, SYNODIC_MONTH_MS);
}

export function getMoonPhase(date = new Date()): MoonPhase {
  const phaseSpanMs = SYNODIC_MONTH_MS / MOON_PHASE_COUNT;
  const index = Math.floor(
    positiveModulo(getMoonAgeMs(date) + phaseSpanMs / 2, SYNODIC_MONTH_MS) / phaseSpanMs,
  ) as MoonPhaseIndex;

  return {
    index,
    label: moonPhaseLabels[index],
  };
}

export function getNextMoonPhaseChange(date = new Date()) {
  const phaseSpanMs = SYNODIC_MONTH_MS / MOON_PHASE_COUNT;
  const ageMs = getMoonAgeMs(date);
  const currentPhase = getMoonPhase(date);
  let nextBoundaryAgeMs = (currentPhase.index + 0.5) * phaseSpanMs;

  if (nextBoundaryAgeMs <= ageMs) {
    nextBoundaryAgeMs += SYNODIC_MONTH_MS;
  }

  return new Date(date.getTime() + nextBoundaryAgeMs - ageMs);
}

export function renderMoonPhaseFaviconSvg(phase: MoonPhase) {
  const uniqueId = `moon-phase-${phase.index}`;
  const shadow = getMoonShadowSvg(phase.index);

  return `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${phase.label}">
  <defs>
    <radialGradient id="${uniqueId}-light" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(23 18) rotate(50) scale(45)">
      <stop stop-color="#fffdf2"/>
      <stop offset=".35" stop-color="#d8d5c8"/>
      <stop offset=".7" stop-color="#9b9c98"/>
      <stop offset="1" stop-color="#5f625f"/>
    </radialGradient>
    <radialGradient id="${uniqueId}-rim" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(24 18) scale(31)">
      <stop stop-color="#ffffff" stop-opacity=".9"/>
      <stop offset=".55" stop-color="#ffffff" stop-opacity=".18"/>
      <stop offset="1" stop-color="#151817" stop-opacity=".65"/>
    </radialGradient>
    <radialGradient id="${uniqueId}-crater" cx="0" cy="0" r="1">
      <stop stop-color="#6c6e6a"/>
      <stop offset=".54" stop-color="#a8a89f"/>
      <stop offset=".76" stop-color="#d9d4c2"/>
      <stop offset="1" stop-color="#70736e"/>
    </radialGradient>
    <filter id="${uniqueId}-surface" x="2" y="2" width="60" height="60" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="4" seed="18" result="noise"/>
      <feColorMatrix in="noise" type="matrix" values=".34 0 0 0 0 0 .34 0 0 0 0 0 .34 0 0 0 0 0 .32 0" result="grain"/>
      <feBlend in="SourceGraphic" in2="grain" mode="multiply"/>
    </filter>
    <clipPath id="${uniqueId}-disc">
      <circle cx="32" cy="32" r="28"/>
    </clipPath>
  </defs>
  <g clip-path="url(#${uniqueId}-disc)">
    <circle cx="32" cy="32" r="28" fill="url(#${uniqueId}-light)" filter="url(#${uniqueId}-surface)"/>
    <path d="M11 28c6-12 17-18 31-17-9 4-16 11-20 21-3 8-7 13-14 15 0-7 1-13 3-19Z" fill="#fff7dc" fill-opacity=".22"/>
    <path d="M45 14c9 6 13 15 10 27-3-8-9-13-18-16-7-2-11-5-11-10 6-3 12-3 19-1Z" fill="#6b6f6d" fill-opacity=".26"/>
    <circle cx="23" cy="21" r="4.3" fill="url(#${uniqueId}-crater)" opacity=".68"/>
    <circle cx="41" cy="23" r="3.2" fill="url(#${uniqueId}-crater)" opacity=".62"/>
    <circle cx="29" cy="36" r="5.5" fill="url(#${uniqueId}-crater)" opacity=".55"/>
    <circle cx="45" cy="43" r="4.7" fill="url(#${uniqueId}-crater)" opacity=".58"/>
    <circle cx="18" cy="44" r="3.2" fill="url(#${uniqueId}-crater)" opacity=".5"/>
    <circle cx="36" cy="49" r="2" fill="#6d706b" opacity=".46"/>
    <circle cx="16" cy="30" r="2.2" fill="#747771" opacity=".45"/>
    <circle cx="51" cy="32" r="2.5" fill="#767970" opacity=".42"/>
    ${shadow}
    <circle cx="32" cy="32" r="28" fill="url(#${uniqueId}-rim)"/>
  </g>
  <circle cx="32" cy="32" r="28.3" stroke="#f8f0ce" stroke-opacity=".52" stroke-width="1.4"/>
</svg>`;
}

export function renderMoonPhaseFaviconHref(phase: MoonPhase) {
  return `data:image/svg+xml,${encodeURIComponent(renderMoonPhaseFaviconSvg(phase))}`;
}

function getMoonShadowSvg(phaseIndex: MoonPhaseIndex) {
  const shadowFill = 'fill="#05070d" fill-opacity=".82"';

  switch (phaseIndex) {
    case 0:
      return `<circle cx="32" cy="32" r="28" ${shadowFill}/>`;
    case 1:
      return `<ellipse cx="24" cy="32" rx="28" ry="28" ${shadowFill}/>`;
    case 2:
      return `<rect x="4" y="4" width="28" height="56" ${shadowFill}/>`;
    case 3:
      return `<ellipse cx="14" cy="32" rx="15.5" ry="28" ${shadowFill}/>`;
    case 4:
      return "";
    case 5:
      return `<ellipse cx="50" cy="32" rx="15.5" ry="28" ${shadowFill}/>`;
    case 6:
      return `<rect x="32" y="4" width="28" height="56" ${shadowFill}/>`;
    case 7:
      return `<ellipse cx="40" cy="32" rx="28" ry="28" ${shadowFill}/>`;
  }
}
