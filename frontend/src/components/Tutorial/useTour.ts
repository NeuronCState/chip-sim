import { useState, useCallback, useEffect } from 'react';
import { TOUR_STEPS } from './tour-steps';

const TOUR_STORAGE_KEY = 'chip-sim-tour-completed';
const TOUR_STEP_KEY = 'chip-sim-tour-step';

export function useTour() {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // 首次打开检查：如果没完成过引导，检查是否有保存的步骤
  useEffect(() => {
    const completed = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!completed) {
      const savedStep = localStorage.getItem(TOUR_STEP_KEY);
      const startStep = savedStep ? Math.min(parseInt(savedStep, 10), TOUR_STEPS.length - 1) : 0;
      const timer = setTimeout(() => {
        setCurrentStep(startStep);
        setIsActive(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const startTour = useCallback(() => {
    setCurrentStep(0);
    localStorage.removeItem(TOUR_STEP_KEY);
    setIsActive(true);
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => {
      const next = prev + 1;
      if (next >= TOUR_STEPS.length) {
        setIsActive(false);
        localStorage.setItem(TOUR_STORAGE_KEY, 'true');
        localStorage.removeItem(TOUR_STEP_KEY);
        return prev;
      }
      return next;
    });
  }, []);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  }, []);

  const skipTour = useCallback(() => {
    setIsActive(false);
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    localStorage.removeItem(TOUR_STEP_KEY);
  }, []);

  const finishTour = useCallback(() => {
    setIsActive(false);
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    localStorage.removeItem(TOUR_STEP_KEY);
  }, []);

  const resetTour = useCallback(() => {
    localStorage.removeItem(TOUR_STORAGE_KEY);
    localStorage.removeItem(TOUR_STEP_KEY);
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  /** 稍后继续：保存当前步骤到 localStorage */
  const resumeLater = useCallback(() => {
    setIsActive(false);
    localStorage.setItem(TOUR_STEP_KEY, String(currentStep));
    // 注意：不设置 TOUR_STORAGE_KEY，这样下次会继续
  }, [currentStep]);

  return {
    isActive,
    currentStep,
    startTour,
    nextStep,
    prevStep,
    skipTour,
    finishTour,
    resetTour,
    resumeLater,
  };
}
