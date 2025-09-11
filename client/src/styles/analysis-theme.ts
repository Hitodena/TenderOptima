// Analysis Theme Configuration - Easy to change colors
export const analysisTheme = {
  primary: 'cyan-600',      // #0891B2 - Ясность, технологичность
  accent: 'cyan-500',       // #06B6D4 - Свежесть, интерактивность  
  background: 'cyan-50',    // #ECFEFF - Воздушность, фокус
  text: 'cyan-700',         // #0E7490 - Читаемость без напряжения
  borders: 'cyan-200',      // #A5F3FC - Современное разделение
  
  // Status colors remain standard
  success: 'green-500',     // Compliance
  warning: 'amber-500',     // Partial compliance
  error: 'red-500'          // Non-compliance
} as const;

// Helper function to get theme classes
export const getAnalysisThemeClasses = () => ({
  // Backgrounds
  bgPrimary: `bg-${analysisTheme.primary}`,
  bgAccent: `bg-${analysisTheme.accent}`,
  bgBackground: `bg-${analysisTheme.background}`,
  backgroundLight: `bg-${analysisTheme.background}`,
  
  // Text colors
  textPrimary: `text-${analysisTheme.primary}`,
  textAccent: `text-${analysisTheme.accent}`,
  textMain: `text-${analysisTheme.text}`,
  
  // Borders
  borderColor: `border-${analysisTheme.borders}`,
  
  // Hover states
  hoverPrimary: `hover:bg-${analysisTheme.primary}`,
  hoverAccent: `hover:bg-${analysisTheme.accent}`,
  
  // Button styles
  buttonPrimary: `bg-${analysisTheme.primary} hover:bg-${analysisTheme.primary}/90 text-white`,
  buttonSecondary: `border-${analysisTheme.borders} text-${analysisTheme.primary} hover:bg-${analysisTheme.background}`,
  
  // Tab styles
  tabTrigger: `data-[state=active]:bg-${analysisTheme.background} data-[state=active]:text-${analysisTheme.primary}`,
  
  // Status colors
  success: `text-${analysisTheme.success}`,
  warning: `text-${analysisTheme.warning}`,
  error: `text-${analysisTheme.error}`,
  
  successBg: `bg-${analysisTheme.success}`,
  warningBg: `bg-${analysisTheme.warning}`,
  errorBg: `bg-${analysisTheme.error}`
});