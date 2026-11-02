/**
 * MARSHGO Canonical Design Tokens
 * Conforms to WCAG 2.2 AA, fluid tactile ergonomics, and responsive 320-1440px layouts.
 */

export const tokens = {
  radii: {
    xs: '6px',
    sm: '10px',
    md: '14px',
    lg: '18px',
    xl: '22px',
    '2xl': '28px',
    full: '9999px',
  },
  typography: {
    fontSans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    weights: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
      black: 900,
    },
    sizes: {
      caption: '10px',
      footnote: '11px',
      bodySm: '12px',
      body: '14px',
      subhead: '15px',
      headline: '17px',
      titleSm: '20px',
      title: '24px',
      display: '30px',
    },
  },
  elevation: {
    subtle: '0 2px 8px rgba(18, 48, 86, 0.05)',
    card: '0 4px 16px rgba(18, 48, 86, 0.07)',
    floating: '0 8px 24px rgba(18, 48, 86, 0.12)',
    sheet: '0 -18px 64px rgba(18, 48, 86, 0.18)',
    modal: '0 24px 64px rgba(0, 0, 0, 0.35)',
  },
  touchTarget: {
    minSizePx: 44,
  },
  breakpoints: {
    mobileSm: 320,
    mobile: 390,
    mobileLg: 430,
    tablet: 768,
    desktop: 1024,
    desktopLg: 1440,
  },
} as const;
