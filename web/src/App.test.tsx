// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

vi.mock('./scene/Scene', () => ({
  Scene: () => <div data-testid="scene" />,
}));

vi.mock('@/sim/useSimTick', () => ({
  useSimTick: () => {},
  simDevice: {
    resetEStop: vi.fn(),
    send: vi.fn(),
  },
}));

describe('App mobile viewport layout', () => {
  it('keeps the bottom navigation inside the iPhone visible viewport and safe area', async () => {
    const { container } = render(<App />);
    await screen.findByTestId('scene');

    expect(container.firstElementChild).toHaveClass('h-dvh');

    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(nav).toHaveClass('h-[calc(4rem+env(safe-area-inset-bottom))]');
    expect(nav).toHaveClass('pb-[env(safe-area-inset-bottom)]');
  });
});
