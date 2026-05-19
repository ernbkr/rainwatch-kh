import { useEffect, useState } from 'react';
import { radar } from '../lib/radar';

/** Reads the Electron runtime config once (currently: calibration mode). */
export function useRuntimeConfig(): { calibrationEnabled: boolean } {
  const [calibrationEnabled, setCalibrationEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    radar
      .getRuntimeConfig()
      .then((config) => {
        if (!cancelled) {
          setCalibrationEnabled(Boolean(config?.calibrationEnabled));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCalibrationEnabled(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { calibrationEnabled };
}
