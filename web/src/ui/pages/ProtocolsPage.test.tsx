// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProtocolsPage } from './ProtocolsPage';
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

describe('ProtocolsPage', () => {
  beforeEach(() => {
    resetStore();
  });

  it('renders production protocol cards only', () => {
    render(<ProtocolsPage />);
    expect(screen.getByRole('button', { name: /Protocol 1.*Axial/s })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Protocol 2.*Left Lateral/s })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Protocol 3.*Right Lateral/s })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Protocol 4/s })).not.toBeInTheDocument();
  });

  it('shows lateral angle sliders only for protocols that need them', async () => {
    const user = userEvent.setup();
    render(<ProtocolsPage />);

    expect(screen.queryByText('Max Left Angle')).not.toBeInTheDocument();
    expect(screen.queryByText('Max Right Angle')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Protocol 2.*Left Lateral/s }));
    expect(screen.getByText('Max Left Angle')).toBeInTheDocument();
    expect(screen.queryByText('Max Right Angle')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Protocol 3.*Right Lateral/s }));
    expect(screen.queryByText('Max Left Angle')).not.toBeInTheDocument();
    expect(screen.getByText('Max Right Angle')).toBeInTheDocument();
  });

  it('toggling Pulse flips session.usePulse', async () => {
    const user = userEvent.setup();
    render(<ProtocolsPage />);
    expect(useAppStore.getState().session.usePulse).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Pulse: Off' }));
    expect(useAppStore.getState().session.usePulse).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Pulse: On' }));
    expect(useAppStore.getState().session.usePulse).toBe(false);
  });

  it('does not render the model-only Test Pulse button', () => {
    render(<ProtocolsPage />);

    expect(screen.queryByRole('button', { name: 'Test Pulse' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Stop Pulse' })).not.toBeInTheDocument();
  });

  it('Start Protocol sets running state and shows the running banner', async () => {
    const user = userEvent.setup();
    render(<ProtocolsPage />);

    await user.click(screen.getByRole('button', { name: 'Start Protocol 1' }));
    expect(useAppStore.getState().session.runningProtocol).toBe(1);
    expect(screen.getByText(/Protocol 1 — Axial/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop Protocol' })).toBeInTheDocument();
  });

  it('Stop Protocol clears running state', async () => {
    const user = userEvent.setup();
    render(<ProtocolsPage />);

    await user.click(screen.getByRole('button', { name: 'Start Protocol 1' }));
    expect(useAppStore.getState().session.runningProtocol).toBe(1);

    await user.click(screen.getByRole('button', { name: 'Stop Protocol' }));
    expect(useAppStore.getState().session.runningProtocol).toBe(null);
  });

  it('disables Start button when E-Stop is latched', () => {
    useAppStore.setState((s) => ({ device: { ...s.device, eStop: true } }));
    render(<ProtocolsPage />);
    expect(screen.getByRole('button', { name: 'Start Protocol 1' })).toBeDisabled();
  });
});
