// Small inline SVG icons for the toolbar and panels. Stroke-based, 16px,
// currentColor so they inherit button text color.
const S = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export const Icon = {
  undo: () => (<svg {...S}><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-1" /></svg>),
  redo: () => (<svg {...S}><path d="m15 14 5-5-5-5" /><path d="M20 9H9a5 5 0 0 0 0 10h1" /></svg>),
  file: () => (<svg {...S}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>),
  save: () => (<svg {...S}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><path d="M17 21v-8H7v8M7 3v5h8" /></svg>),
  load: () => (<svg {...S}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5M12 15V3" /></svg>),
  pptx: () => (<svg {...S}><rect x="3" y="3" width="18" height="14" rx="2" /><path d="M7 21h10M12 17v4" /></svg>),
  play: () => (<svg {...S}><polygon points="6 3 20 12 6 21 6 3" /></svg>),
  slide: () => (<svg {...S}><rect x="2" y="4" width="20" height="14" rx="2" /><path d="M12 18v3M8 21h8" /></svg>),
  publish: () => (<svg {...S}><path d="M12 3v12" /><path d="m8 7 4-4 4 4" /><path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" /></svg>),
  plus: () => (<svg {...S}><path d="M12 5v14M5 12h14" /></svg>),
  sparkles: () => (<svg {...S}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2" /></svg>),
  refresh: () => (<svg {...S}><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></svg>)
};
