// One stroke icon set (1.5px, 16px grid) so no glyphs stand in for icons.
type P = { className?: string };
const base = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const ArrowRight = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M3 8h10M9 4l4 4-4 4" />
  </svg>
);
export const ArrowUpRight = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M5 11l6-6M6 5h5v5" />
  </svg>
);
export const Chevron = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M6 4l4 4-4 4" />
  </svg>
);
export const Search = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <circle cx="7" cy="7" r="4.25" />
    <path d="M10.2 10.2L13.5 13.5" />
  </svg>
);
export const Doc = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M4 2.5h5l3 3v8H4z" />
    <path d="M9 2.5v3h3M6 8.5h4M6 11h4" />
  </svg>
);
export const Bolt = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M9 1.75L3.5 9h4L7 14.25 12.5 7h-4z" />
  </svg>
);
export const Check = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M3 8.5l3 3 7-7" />
  </svg>
);
export const Cross = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);
export const Copy = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <rect x="5.5" y="5.5" width="8" height="8" />
    <path d="M10.5 5.5v-3h-8v8h3" />
  </svg>
);
export const Download = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M8 2.5v8M4.5 7L8 10.5 11.5 7M3 13.5h10" />
  </svg>
);
export const Pen = ({ className }: P) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M10.5 2.5l3 3-8 8h-3v-3z" />
  </svg>
);
