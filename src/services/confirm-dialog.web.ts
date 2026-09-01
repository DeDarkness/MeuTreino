import type { ConfirmDialogOptions } from './confirm-dialog';

export function confirmDialog({ title, message }: ConfirmDialogOptions): Promise<boolean> {
  return Promise.resolve(window.confirm(`${title}\n\n${message}`));
}
