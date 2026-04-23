import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ColorCombinationModal from '@/components/ColorCombinationModal';
import type { ColorCombination } from '@/lib/types';

const combination: ColorCombination = {
  id: 'combo-1',
  topColor: 'blue',
  bottomColor: 'navy blue',
};

describe('ColorCombinationModal', () => {
  it('does not render when isOpen is false', () => {
    render(
      <ColorCombinationModal
        isOpen={false}
        onClose={vi.fn()}
        combination={combination}

        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.queryByText('Edit Combination')).toBeNull();
  });

  it('renders when isOpen is true', () => {
    render(
      <ColorCombinationModal
        isOpen={true}
        onClose={vi.fn()}
        combination={combination}

        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText('Edit Combination')).toBeTruthy();
  });

  it('clicking Delete button opens ConfirmDialog', () => {
    render(
      <ColorCombinationModal
        isOpen={true}
        onClose={vi.fn()}
        combination={combination}

        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Delete'));
    expect(screen.getByText('Delete this color combination?')).toBeTruthy();
  });

  it('ConfirmDialog cancel does NOT call onDelete', () => {
    const onDelete = vi.fn();
    render(
      <ColorCombinationModal
        isOpen={true}
        onClose={vi.fn()}
        combination={combination}

        onUpdate={vi.fn()}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByText('Delete'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('ConfirmDialog confirm calls onDelete', async () => {
    const onDelete = vi.fn().mockResolvedValue(true);
    render(
      <ColorCombinationModal
        isOpen={true}
        onClose={vi.fn()}
        combination={combination}

        onUpdate={vi.fn()}
        onDelete={onDelete}
      />,
    );
    // Open the ConfirmDialog (header Delete button)
    const deleteBtns = screen.getAllByText('Delete');
    // Header "Delete" button — has a Trash2 icon, is inside the modal header
    // The last one is in the modal header, the one inside ConfirmDialog doesn't exist yet
    fireEvent.click(deleteBtns[0]);
    // Now ConfirmDialog is open — click its confirm button
    // ConfirmDialog comes first in DOM, so confirmBtns[0] is its "Delete" confirm button
    const allDeleteBtns = screen.getAllByText('Delete');
    // ConfirmDialog confirm button is index 0 in DOM order (ConfirmDialog renders first)
    fireEvent.click(allDeleteBtns[0]);
    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
  });

  it('Update button calls onUpdate with current selections', async () => {
    const onUpdate = vi.fn().mockResolvedValue(true);
    render(
      <ColorCombinationModal
        isOpen={true}
        onClose={vi.fn()}
        combination={combination}

        onUpdate={onUpdate}
        onDelete={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Update'));
    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ topColor: 'blue', bottomColor: 'navy blue' }),
      );
    });
  });

  it('Reset button restores original colors', async () => {
    const onUpdate = vi.fn();
    render(
      <ColorCombinationModal
        isOpen={true}
        onClose={vi.fn()}
        combination={combination}

        onUpdate={onUpdate}
        onDelete={vi.fn()}
      />,
    );
    // Click a different top color
    const colorButtons = screen.getAllByTitle('red');
    if (colorButtons.length > 0) fireEvent.click(colorButtons[0]);
    // Reset
    fireEvent.click(screen.getByText('Reset'));
    // Click Update
    fireEvent.click(screen.getByText('Update'));
    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ topColor: 'blue' }),
      );
    });
  });
});
