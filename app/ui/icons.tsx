// One small authored icon set: 16 px grid, 1.5 px round strokes, drawn in the current text colour.
import type { ReactNode } from 'react';

function Icon({ children, size = 16 }: { children: ReactNode; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export const RefreshIcon = () => (
  <Icon>
    <path d="M13.5 8a5.5 5.5 0 1 1-1.7-4" />
    <path d="M13.5 2.5V5H11" />
  </Icon>
);
export const PlusIcon = () => (
  <Icon>
    <path d="M8 3v10M3 8h10" />
  </Icon>
);
export const BackIcon = () => (
  <Icon>
    <path d="M9.5 3.5 5 8l4.5 4.5" />
  </Icon>
);
export const ChevronIcon = () => (
  <Icon>
    <path d="M6 3.5 10.5 8 6 12.5" />
  </Icon>
);
export const ClockIcon = () => (
  <Icon>
    <circle cx="8" cy="8" r="5.5" />
    <path d="M8 5v3.2l2 1.3" />
  </Icon>
);
export const RepeatIcon = () => (
  <Icon>
    <path d="M3 7V6a2 2 0 0 1 2-2h7.5" />
    <path d="M10.5 2 12.5 4l-2 2" />
    <path d="M13 9v1a2 2 0 0 1-2 2H3.5" />
    <path d="M5.5 14 3.5 12l2-2" />
  </Icon>
);
export const NoteIcon = () => (
  <Icon>
    <path d="M4 2.5h8v11H4z" />
    <path d="M6 6h4M6 8.5h4M6 11h2" />
  </Icon>
);
export const CheckIcon = () => (
  <Icon>
    <path d="m3.5 8.5 3 3 6-7" />
  </Icon>
);
export const AlertIcon = () => (
  <Icon>
    <path d="M8 2.5 14 13H2z" />
    <path d="M8 6.5v3M8 11.3v.2" />
  </Icon>
);
export const SendingIcon = () => (
  <Icon>
    <path d="M2.5 8h8" />
    <path d="m8 4.5 3.5 3.5L8 11.5" />
    <path d="M13.5 4v8" />
  </Icon>
);
