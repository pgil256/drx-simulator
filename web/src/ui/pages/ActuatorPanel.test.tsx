// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActuatorPanel } from './ActuatorPanel';
import { useAppStore } from '@/store/useAppStore';
import { INITIAL_DEVICE_STATE } from '@/sim/types';

function resetStore() {
  useAppStore.setState({
    device: structuredClone(INITIAL_DEVICE_STATE),
    session: {
      runningProtocol: null,
      phase: 'idle',
      progressPct: 0,
      elapsedSec: 0,
      durationSec: 30,
      maxPressure: 40,
      maxLeft: 10,
      maxRight: 10,
      usePulse: false,
      timeScale: 1,
    },
  });
}

describe('ActuatorPanel', () => {
  beforeEach(() => {
    resetStore();
  });

  it('renders position and target readouts for axial', () => {
    render(<ActuatorPanel actuator="axial" />);
    expect(screen.getByText('Position')).toBeInTheDocument();
    expect(screen.getByText('Target: 0.0 in')).toBeInTheDocument();
    expect(screen.getByText('Pressure')).toBeInTheDocument();
  });

  it('Forward nudges axial target by stepNormal (0.5 in)', async () => {
    const user = userEvent.setup();
    render(<ActuatorPanel actuator="axial" />);

    await user.click(screen.getByRole('button', { name: 'Forward' }));
    expect(useAppStore.getState().device.axial.target).toBe(0.5);
  });

  it('Fast Forward nudges axial target by stepFast (1.0 in)', async () => {
    const user = userEvent.setup();
    render(<ActuatorPanel actuator="axial" />);

    await user.click(screen.getByRole('button', { name: 'Fast Forward' }));
    expect(useAppStore.getState().device.axial.target).toBe(1);
  });

  it('clamps target to actuator max', async () => {
    const user = userEvent.setup();
    useAppStore.setState((s) => ({
      device: { ...s.device, axial: { ...s.device.axial, target: 4 } },
    }));
    render(<ActuatorPanel actuator="axial" />);

    await user.click(screen.getByRole('button', { name: 'Fast Forward' }));
    expect(useAppStore.getState().device.axial.target).toBe(4);
  });

  it('Reverse nudges axial target by -stepNormal', async () => {
    const user = userEvent.setup();
    useAppStore.setState((s) => ({
      device: { ...s.device, axial: { ...s.device.axial, target: 2 } },
    }));
    render(<ActuatorPanel actuator="axial" />);

    await user.click(screen.getByRole('button', { name: 'Reverse' }));
    expect(useAppStore.getState().device.axial.target).toBe(1.5);
  });

  it('Reset sends actuator target to 0', async () => {
    const user = userEvent.setup();
    useAppStore.setState((s) => ({
      device: { ...s.device, axial: { ...s.device.axial, target: 2.5 } },
    }));
    render(<ActuatorPanel actuator="axial" />);

    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(useAppStore.getState().device.axial.target).toBe(0);
  });

  it('Stop Pressure sends pressure target to 0', async () => {
    const user = userEvent.setup();
    useAppStore.setState((s) => ({
      device: { ...s.device, pressure: { ...s.device.pressure, target: 30 } },
    }));
    render(<ActuatorPanel actuator="axial" />);

    await user.click(screen.getByRole('button', { name: 'Stop Pressure' }));
    expect(useAppStore.getState().device.pressure.target).toBe(0);
  });

  it('horizontal panel uses degrees', () => {
    render(<ActuatorPanel actuator="horizontal" />);
    expect(screen.getByText(/Target: -15 deg/)).toBeInTheDocument();
  });

  it('lateral panel allows negative nudge', async () => {
    const user = userEvent.setup();
    render(<ActuatorPanel actuator="lateral" />);

    await user.click(screen.getByRole('button', { name: 'Reverse' }));
    expect(useAppStore.getState().device.lateral.target).toBe(-5);
  });
});
