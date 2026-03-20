import { render, screen } from '@testing-library/react';
import ChaosSyncOverlay from '../components/ChaosSyncOverlay';

describe('ChaosSyncOverlay', () => {
  it('should render nothing when isSyncing is false', () => {
    const { container } = render(<ChaosSyncOverlay isSyncing={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render the sync message when isSyncing is true', () => {
    render(<ChaosSyncOverlay isSyncing={true} />);
    expect(screen.getByText(/Chaos Sync in progress/i)).toBeInTheDocument();
    expect(screen.getByText(/Democracy is choosing the next track/i)).toBeInTheDocument();
  });

  it('should have neon styles', () => {
    render(<ChaosSyncOverlay isSyncing={true} />);
    const overlay = screen.getByTestId('chaos-sync-overlay');
    expect(overlay).toHaveClass('bg-black/80');
    
    const heading = screen.getByText(/Chaos Sync in progress/i);
    expect(heading).toHaveClass('text-neon-cyan');
  });
});
