import { describe, it, expect, beforeEach } from 'vitest';
import { SimulatedDevice } from './SimulatedDevice';
import { useAppStore } from '../store/useAppStore';
import { INITIAL_DEVICE_STATE } from './types';

describe('SimulatedDevice', () => {
  beforeEach(() => {
    useAppStore.setState({ device: structuredClone(INITIAL_DEVICE_STATE) });
  });

  it('sets axial target on valid A12 command', () => {
    const dev = new SimulatedDevice();
    dev.send('A12 2.5');
    expect(useAppStore.getState().device.axial.target).toBe(2.5);
    expect(useAppStore.getState().device.axial.moving).toBe(true);
  });

  it('clamps axial target within limits', () => {
    const dev = new SimulatedDevice();
    dev.send('A12 99');
    expect(useAppStore.getState().device.axial.target).toBe(4);
    dev.send('A12 -5');
    expect(useAppStore.getState().device.axial.target).toBe(0);
  });

  it('latches eStop on X command and freezes motion', () => {
    const dev = new SimulatedDevice();
    dev.send('A12 2');
    dev.send('X');
    expect(useAppStore.getState().device.eStop).toBe(true);
    dev.tick(1.0);
    expect(useAppStore.getState().device.axial.pos).toBe(0);
  });

  it('eStop clears pulsing flag', () => {
    const dev = new SimulatedDevice();
    dev.send('J');
    expect(useAppStore.getState().device.pulsing).toBe(true);
    dev.send('X');
    expect(useAppStore.getState().device.pulsing).toBe(false);
  });

  it('eStop bleeds pressure to zero while latched', () => {
    const dev = new SimulatedDevice();
    useAppStore.setState((s) => ({
      device: { ...s.device, pressure: { lbs: 60, target: 60 } },
    }));
    dev.send('X');
    expect(useAppStore.getState().device.pressure.target).toBe(0);
    // SPEEDS.pressure = 20 lbs/sec, 3s should fully drain 60 lbs.
    dev.tick(3);
    expect(useAppStore.getState().device.pressure.lbs).toBe(0);
  });

  it('eStop freezes actuator pos even while pressure decays', () => {
    const dev = new SimulatedDevice();
    dev.send('A12 3');
    dev.tick(2);
    const posBefore = useAppStore.getState().device.axial.pos;
    dev.send('X');
    dev.tick(5);
    expect(useAppStore.getState().device.axial.pos).toBe(posBefore);
  });

  it('tick advances actuators toward targets', () => {
    const dev = new SimulatedDevice();
    dev.send('A12 2');
    dev.tick(1.0);
    expect(useAppStore.getState().device.axial.pos).toBeCloseTo(1, 5);
  });

  it('maps pressure commands to outward axial traction', () => {
    const dev = new SimulatedDevice();
    dev.send('P40');
    expect(useAppStore.getState().device.pressure.target).toBe(40);
    expect(useAppStore.getState().device.axial.target).toBe(2);

    dev.send('P0');
    expect(useAppStore.getState().device.axial.target).toBe(0);
  });

  it('ignores unknown commands silently', () => {
    const dev = new SimulatedDevice();
    expect(() => dev.send('ZZZ')).not.toThrow();
  });
});
