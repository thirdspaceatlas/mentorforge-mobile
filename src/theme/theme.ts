// Design tokens — sourced from /app/design_guidelines.json
// "3 Editorial Mobile LIGHT": calm, premium finance aesthetic.

export const colors = {
  surface: "#F9F8F6",
  onSurface: "#1C1B1A",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#1C1B1A",
  surfaceTertiary: "#F0EFEA",
  onSurfaceTertiary: "#4A4846",
  surfaceInverse: "#1C1B1A",
  onSurfaceInverse: "#F9F8F6",
  brand: "#4A5D4E",
  brandPrimary: "#4A5D4E",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#E8EBE9",
  onBrandSecondary: "#2D3930",
  brandTertiary: "#E8EBE9",
  onBrandTertiary: "#4A5D4E",
  success: "#3E614A",
  onSuccess: "#FFFFFF",
  warning: "#A67C00",
  onWarning: "#FFFFFF",
  error: "#8B3A3A",
  onError: "#FFFFFF",
  info: "#4A4A4A",
  muted: "#8A8782",
  border: "#E6E4DF",
  borderStrong: "#CCC9C0",
  divider: "#E6E4DF",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 0,
  md: 4,
  lg: 8,
  pill: 999,
};

export const fonts = {
  serif: "PlayfairDisplay",
  serifMedium: "PlayfairDisplay-Medium",
  sans: "Geist",
  sansMedium: "Geist-Medium",
};

export const type = {
  sm: 12,
  base: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
  display: 30,
};

export const statusColor: Record<string, { bg: string; fg: string; label: string }> = {
  ahead: { bg: "#E8EBE9", fg: "#3E614A", label: "Ahead of pace" },
  on_track: { bg: "#E8EBE9", fg: "#3E614A", label: "On Track" },
  tight: { bg: "#F4ECD9", fg: "#8A6D1B", label: "Tight" },
  at_risk: { bg: "#F3E7E7", fg: "#8B3A3A", label: "At Risk" },
  behind: { bg: "#F3E7E7", fg: "#8B3A3A", label: "Behind pace" },
};
