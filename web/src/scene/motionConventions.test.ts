import { describe, expect, it } from 'vitest';
import { patientLateralDegToCadDeg } from './motionConventions';

describe('patientLateralDegToCadDeg', () => {
  it('flips patient-frame lateral sign for the CAD hinge axis', () => {
    expect(patientLateralDegToCadDeg(-20)).toBe(20);
    expect(patientLateralDegToCadDeg(0)).toBe(-0);
    expect(patientLateralDegToCadDeg(20)).toBe(-20);
  });
});
