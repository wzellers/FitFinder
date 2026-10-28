import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const area = { x: 10, y: 10, width: 80, height: 80 };

// react-easy-crop needs real layout; this stand-in reports a crop area and
// shows the rotation it was given.
function FakeCropper({
  rotation,
  aspect,
  onCropComplete,
  onMediaLoaded,
}: {
  rotation: number;
  aspect?: number;
  onCropComplete: (a: typeof area) => void;
  onMediaLoaded?: (m: {
    width: number;
    height: number;
    naturalWidth: number;
    naturalHeight: number;
  }) => void;
}) {
  React.useEffect(() => onCropComplete(area), [onCropComplete]);
  // A tall photo, 300 × 600.
  React.useEffect(
    () => onMediaLoaded?.({ width: 150, height: 300, naturalWidth: 300, naturalHeight: 600 }),
    [onMediaLoaded],
  );
  return <div data-testid="cropper" data-rotation={rotation} data-aspect={aspect ?? ''} />;
}
vi.mock('react-easy-crop', () => ({ default: FakeCropper }));

const mockCrop = vi.hoisted(() => vi.fn(() => Promise.resolve(new Blob(['png']))));
vi.mock('@/lib/imageCrop', () => ({ getCroppedBlob: mockCrop }));

import ImageCropper from '@/components/ui/ImageCropper';

const rotation = () => Number(screen.getByTestId('cropper').dataset.rotation);

beforeEach(() => mockCrop.mockClear());

describe('ImageCropper', () => {
  it('tilts the photo with a slider, and rotates it in quarter turns', () => {
    render(<ImageCropper imageSrc="blob:x" onCancel={vi.fn()} onCropComplete={vi.fn()} />);
    expect(rotation()).toBe(0);
    fireEvent.change(screen.getByLabelText('Tilt'), { target: { value: '12' } });
    expect(rotation()).toBe(12);
    fireEvent.click(screen.getByRole('button', { name: 'Rotate 90 degrees' }));
    expect(rotation()).toBe(102);
  });

  it('saves the crop with its rotation', async () => {
    const onCropComplete = vi.fn();
    render(<ImageCropper imageSrc="blob:x" onCancel={vi.fn()} onCropComplete={onCropComplete} />);
    fireEvent.change(screen.getByLabelText('Tilt'), { target: { value: '-8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply crop' }));
    await waitFor(() => expect(onCropComplete).toHaveBeenCalled());
    expect(mockCrop).toHaveBeenCalledWith('blob:x', area, -8);
  });

  it('resets the tilt and rotation', () => {
    render(<ImageCropper imageSrc="blob:x" onCancel={vi.fn()} onCropComplete={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Tilt'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rotate 90 degrees' }));
    fireEvent.click(screen.getByRole('button', { name: /Reset/ }));
    expect(rotation()).toBe(0);
  });

  it("starts the crop box at the photo's own shape, so nothing is cut off", () => {
    render(<ImageCropper imageSrc="blob:x" onCancel={vi.fn()} onCropComplete={vi.fn()} />);
    const aspect = () => Number(screen.getByTestId('cropper').dataset.aspect);
    expect(aspect()).toBe(0.5); // the tall photo, not a fixed 4:3 box
    fireEvent.click(screen.getByRole('button', { name: 'Rotate 90 degrees' }));
    expect(aspect()).toBe(2); // turned on its side
    fireEvent.click(screen.getByRole('button', { name: '1:1' }));
    expect(aspect()).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Photo' }));
    expect(aspect()).toBe(2);
  });
});
