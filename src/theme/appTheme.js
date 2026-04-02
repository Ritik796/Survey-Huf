import { StyleSheet, Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── Responsive Helpers ───────────────────────────────────────────────────────
// Scale any size relative to a 375px baseline (iPhone 11 design base)
const BASE_WIDTH = 375;
const scale = (size) => (SCREEN_W / BASE_WIDTH) * size;
const moderateScale = (size, factor = 0.5) =>
  size + (scale(size) - size) * factor;

export const rs = {
  w: SCREEN_W,
  h: SCREEN_H,
  scale,
  ms: moderateScale,
  // Font size that adapts to screen but doesn't grow too large
  font: (size) => moderateScale(size, 0.4),
  // Spacing that adapts
  sp: (size) => moderateScale(size, 0.5),
  // Pixel-perfect 1px border
  hairline: 1 / PixelRatio.get(),
};

// ─── Color Palette (Splash Screen origin) ────────────────────────────────────
export const colors = {
  // Brand greens — updated to match image reference
  gradientStart:  '#4CAF50',
  gradientEnd:    '#388E3C',
  gradientMid:    '#43A047',

  // Neutrals
  white:          '#ffffff',
  offWhite:       '#f5f6fa',
  lightGrey:      '#ecf0f1',
  grey:           '#bdc3c7',
  darkGrey:       '#7f8c8d',
  charcoal:       '#34495e',
  black:          '#2c3e50',    // NOT pure black — from splash brandMain

  // Semantic
  primaryBackground: '#f5f6fa',
  surfaceWhite:      '#ffffff',
  primaryText:       '#2c3e50',
  secondaryText:     '#7f8c8d',
  placeholder:       '#bdc3c7',

  // Input
  inputBg:        '#ffffff',
  inputBorder:    '#dfe6e9',
  inputFocused:   '#27ae60',

  // Status
  success:        '#2ecc71',
  error:          '#e74c3c',
  warning:        '#f39c12',
  info:           '#3498db',

  // Card overlay / glow
  greenGlow:      'rgba(46,204,113,0.12)',
  greenGlowDeep:  'rgba(39,174,96,0.08)',
  blackOverlay:   'rgba(44,62,80,0.06)',
};

// ─── Typography ───────────────────────────────────────────────────────────────
export const typography = {
  h1:   { fontSize: rs.font(28), fontWeight: '800', color: colors.black, letterSpacing: 0.5 },
  h2:   { fontSize: rs.font(22), fontWeight: '700', color: colors.black },
  h3:   { fontSize: rs.font(18), fontWeight: '700', color: colors.black },
  body: { fontSize: rs.font(15), fontWeight: '400', color: colors.primaryText },
  sm:   { fontSize: rs.font(13), fontWeight: '400', color: colors.secondaryText },
  xs:   { fontSize: rs.font(11), fontWeight: '400', color: colors.secondaryText },
  btn:  { fontSize: rs.font(15), fontWeight: '700', color: colors.white, letterSpacing: 1.2 },
  label:{ fontSize: rs.font(13), fontWeight: '600', color: colors.secondaryText },
  brand:{ fontSize: rs.font(26), fontWeight: '800', letterSpacing: 2 },
};

// ─── Spacing ─────────────────────────────────────────────────────────────────
export const spacing = {
  xs:  rs.sp(4),
  sm:  rs.sp(8),
  md:  rs.sp(16),
  lg:  rs.sp(24),
  xl:  rs.sp(32),
  xxl: rs.sp(48),
};

// ─── Border Radius ───────────────────────────────────────────────────────────
export const radius = {
  sm:  8,
  md:  12,
  lg:  18,
  xl:  24,
  pill:100,
};

// ─── Shadows ─────────────────────────────────────────────────────────────────
export const shadows = {
  card: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
  },
  logo: {
    shadowColor: colors.gradientStart,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 22,
    elevation: 12,
  },
  button: {
    shadowColor: colors.gradientEnd,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  input: {
    shadowColor: colors.gradientStart,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
};

// ─── Gradient Presets ────────────────────────────────────────────────────────
export const gradients = {
  primaryH:  [colors.gradientStart, colors.gradientEnd],       // horizontal
  primaryV:  [colors.gradientStart, colors.gradientEnd],       // vertical
  primary3:  [colors.gradientStart, colors.gradientMid, colors.gradientEnd],
  softBg:    ['#f0faf4', '#e8f8ef'],                           // subtle green tint bg
  glowCard:  ['#ffffff', '#f0faf4'],
};

// ─── Global StyleSheet ────────────────────────────────────────────────────────
export const theme = {
  colors,
  typography,
  spacing,
  radius,
  shadows,
  gradients,
  rs,
  globalStyles: StyleSheet.create({
    flex: { flex: 1 },
    container: {
      flex: 1,
      backgroundColor: colors.primaryBackground,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    card: {
      backgroundColor: colors.surfaceWhite,
      borderRadius: radius.lg,
      padding: spacing.lg,
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 5,
    },
    input: {
      backgroundColor: colors.inputBg,
      borderColor: colors.inputBorder,
      borderWidth: 1,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: rs.sp(13),
      fontSize: rs.font(15),
      color: colors.primaryText,
      marginBottom: spacing.md,
    },
    button: {
      borderRadius: radius.md,
      paddingVertical: rs.sp(15),
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonText: {
      fontSize: rs.font(15),
      fontWeight: '700',
      color: colors.white,
      letterSpacing: 1.2,
    },
    errorText: {
      color: colors.error,
      fontSize: rs.font(13),
      marginBottom: spacing.sm,
      fontWeight: '500',
    },
    screenPadding: {
      paddingHorizontal: spacing.lg,
    },
  }),
};

export default theme;
