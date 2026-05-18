import { describe, expect, it } from 'vitest';
import flags from '../src/flags';

const { isCalibrationEnabled } = flags;

describe('runtime flags', () => {
  it('keeps calibration disabled by default', () => {
    expect(isCalibrationEnabled(['electron', '.'])).toBe(false);
  });

  it('enables calibration with supported positioning flags', () => {
    expect(isCalibrationEnabled(['electron', '.', '--calibrate'])).toBe(true);
    expect(isCalibrationEnabled(['electron', '.', '--debug-positioning'])).toBe(true);
  });
});
