import { useCallback } from 'react';

/**
 * Custom hook for mobile haptic feedback.
 * Uses the Vibration API to provide tactile feedback for user actions.
 */
export const useVibration = () => {
  const vibrate = useCallback((pattern: number | number[] = 10) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {
        // Silent fail if browser blocks vibration
      }
    }
  }, []);

  const patterns = {
    light: 10,
    medium: 30,
    heavy: 50,
    success: [10, 50, 10],
    error: [50, 100, 50, 100],
    warning: [30, 30, 30],
  };

  return {
    vibrate,
    vibrateLight: () => vibrate(patterns.light),
    vibrateMedium: () => vibrate(patterns.medium),
    vibrateHeavy: () => vibrate(patterns.heavy),
    vibrateSuccess: () => vibrate(patterns.success),
    vibrateError: () => vibrate(patterns.error),
    vibrateWarning: () => vibrate(patterns.warning),
  };
};
