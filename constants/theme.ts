/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

// Deep Teal/Green: Primary sophisticated accent color
const primaryAccent = '#00796B'; 
// Rich Gold/Amber: Luxurious highlight color
const secondaryAccent = '#FFC107'; 

export const Colors = {
  light: {
    // Elegant Light Mode
    text: '#1C1C1E', // Very dark text
    background: '#F8F8F8', // Slightly off-white background
    tint: primaryAccent, // Main UI color
    highlight: secondaryAccent, // Gold highlight for important info (countdown)
    card: '#FFFFFF', // Clean white cards
    border: '#E0E0E0',
    icon: '#424242',
    tabIconDefault: '#8E8E93',
    tabIconSelected: primaryAccent,
  },
  dark: {
    // Luxurious Dark Mode
    text: '#E5E5E5', // Light text
    background: '#121212', // Deep black background
    tint: secondaryAccent, // Gold tint for main UI
    highlight: secondaryAccent, // Gold highlight for important info (countdown)
    card: '#1C1C1E', // Very dark card background
    border: '#333333',
    icon: '#A0A0A0',
    tabIconDefault: '#636366',
    tabIconSelected: secondaryAccent,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});