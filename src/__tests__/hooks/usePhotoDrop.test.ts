import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePhotoDrop, imageFiles } from '@/hooks/usePhotoDrop';

const photo = new File(['x'], 'shirt.png', { type: 'image/png' });
const note = new File(['x'], 'notes.txt', { type: 'text/plain' });

/** A drag or drop event carrying files (jsdom has no DataTransfer). */
function dragEvent(type: string, files: File[] = [photo]) {
  const e = new Event(type, { bubbles: true, cancelable: true }) as DragEvent;
  Object.defineProperty(e, 'dataTransfer', {
    value: { types: ['Files'], files: files as unknown as FileList },
  });
  return e;
}

function pasteEvent(files: File[], target: EventTarget = window) {
  const e = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
  Object.defineProperty(e, 'clipboardData', { value: { files: files as unknown as FileList } });
  target.dispatchEvent(e);
  return e;
}

describe('imageFiles', () => {
  it('keeps only images', () => {
    expect(imageFiles([photo, note] as unknown as FileList)).toEqual([photo]);
    expect(imageFiles(null)).toEqual([]);
  });
});

describe('usePhotoDrop', () => {
  it('shows a drop target while files are dragged over, and hands over dropped photos', () => {
    const onFiles = vi.fn();
    const { result } = renderHook(() => usePhotoDrop(true, onFiles));
    act(() => {
      window.dispatchEvent(dragEvent('dragenter'));
    });
    expect(result.current).toBe(true);
    const drop = dragEvent('drop', [photo, note]);
    act(() => {
      window.dispatchEvent(drop);
    });
    expect(result.current).toBe(false);
    expect(drop.defaultPrevented).toBe(true);
    expect(onFiles).toHaveBeenCalledWith([photo]);
  });

  it('stays a drop target while dragging between children, until the drag leaves', () => {
    const { result } = renderHook(() => usePhotoDrop(true, vi.fn()));
    act(() => {
      window.dispatchEvent(dragEvent('dragenter'));
      window.dispatchEvent(dragEvent('dragenter'));
      window.dispatchEvent(dragEvent('dragleave'));
    });
    expect(result.current).toBe(true);
    act(() => {
      window.dispatchEvent(dragEvent('dragleave'));
    });
    expect(result.current).toBe(false);
  });

  it('takes pasted photos, but not while typing in a field', () => {
    const onFiles = vi.fn();
    renderHook(() => usePhotoDrop(true, onFiles));
    act(() => {
      pasteEvent([photo]);
    });
    expect(onFiles).toHaveBeenCalledTimes(1);

    const input = document.createElement('input');
    document.body.appendChild(input);
    act(() => {
      pasteEvent([photo], input);
    });
    expect(onFiles).toHaveBeenCalledTimes(1);
    input.remove();
  });

  it('ignores drops and pastes while disabled', () => {
    const onFiles = vi.fn();
    const { result } = renderHook(() => usePhotoDrop(false, onFiles));
    act(() => {
      window.dispatchEvent(dragEvent('dragenter'));
      window.dispatchEvent(dragEvent('drop'));
      pasteEvent([photo]);
    });
    expect(result.current).toBe(false);
    expect(onFiles).not.toHaveBeenCalled();
  });
});
