import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ScanCameraPanel } from './ScanCameraPanel';

const camera = vi.hoisted(() => ({ instances: [] as Array<any>, pending: false, resolveStart: undefined as (() => void) | undefined }));
vi.mock('html5-qrcode', () => ({
  Html5Qrcode: class {
    isScanning = false;
    decode?: (text: string) => void;
    constructor() { camera.instances.push(this); }
    start = vi.fn((_device, _config, decode) => {
      this.decode = decode;
      return new Promise<void>(resolve => {
        const finish = () => { this.isScanning = true; resolve(); };
        if (camera.pending) camera.resolveStart = finish;
        else finish();
      });
    });
    stop = vi.fn(async () => { this.isScanning = false; });
    clear = vi.fn();
  }
}));

beforeEach(() => { vi.useFakeTimers(); camera.instances = []; camera.pending = false; camera.resolveStart = undefined; });
afterEach(async () => { cleanup(); await act(async () => {}); vi.useRealTimers(); });
const advanceCamera = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(200); }); };

it('keeps the camera running during verification and ignores scans while busy', async () => {
  const onScanToken = vi.fn();
  const view = render(<ScanCameraPanel onScanToken={onScanToken} isVerifying={false} />);
  await advanceCamera();
  expect(camera.instances).toHaveLength(1);
  const scanner = camera.instances[0];
  view.rerender(<ScanCameraPanel onScanToken={onScanToken} isVerifying />);
  await advanceCamera();
  scanner.decode('busy-token');
  expect(onScanToken).not.toHaveBeenCalled();
  expect(scanner.stop).not.toHaveBeenCalled();
  view.rerender(<ScanCameraPanel onScanToken={onScanToken} isVerifying={false} />);
  scanner.decode('ready-token');
  expect(onScanToken).toHaveBeenCalledWith('ready-token');
  expect(camera.instances).toHaveLength(1);
});

it('waits for pending startup and teardown before switching camera', async () => {
  camera.pending = true;
  const onScanToken = vi.fn();
  render(<ScanCameraPanel onScanToken={onScanToken} isVerifying={false} />);
  await advanceCamera();
  const first = camera.instances[0];
  fireEvent.click(screen.getByRole('button', { name: 'Đổi camera trước sau' }));
  first.decode('retired-token');
  expect(onScanToken).not.toHaveBeenCalled();
  await advanceCamera();
  expect(camera.instances).toHaveLength(1);
  expect(first.clear).not.toHaveBeenCalled();
  camera.pending = false;
  await act(async () => { camera.resolveStart!(); });
  expect(first.stop).toHaveBeenCalledTimes(1);
  expect(first.clear).toHaveBeenCalledTimes(1);
  expect(camera.instances).toHaveLength(2);
  expect(camera.instances[1].clear).not.toHaveBeenCalled();
});
