import type { EventStatus } from '../types';

export type EventFormStatus = 'Draft' | 'Published' | 'Completed' | 'Cancelled';

const numericStatus: Record<EventFormStatus, number> = {
  Draft: 0,
  Published: 1,
  Completed: 2,
  Cancelled: 3,
};

export const eventStatusToFormValue = (status: EventStatus | string | number | undefined): EventFormStatus => {
  const normalized = String(status).toLowerCase();
  if (normalized === '0' || normalized === 'draft') return 'Draft';
  if (normalized === '2' || normalized === 'completed') return 'Completed';
  if (normalized === '3' || normalized === 'cancelled') return 'Cancelled';
  return 'Published';
};

export const formValueToEventStatus = (status: EventFormStatus): number => numericStatus[status];
