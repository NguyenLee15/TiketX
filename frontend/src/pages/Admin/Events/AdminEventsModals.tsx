import EventModal, { EventFormValues } from '../../../components/Admin/EventModal';
import ConfirmModal from '../../../components/Admin/ConfirmModal';
import CancelEventModal from '../../../components/Admin/CancelEventModal';
import { Event } from '../../../types';

export interface AdminEventModalState {
  form: { open: boolean; event: Event | null };
  deleteTarget: Event | null;
  cancelTarget: Event | null;
}

export interface AdminEventModalActions {
  closeForm: () => void;
  submitForm: (data: EventFormValues) => Promise<void>;
  closeDelete: () => void;
  confirmDelete: () => Promise<void>;
  closeCancel: () => void;
  confirmCancel: (reason: string) => Promise<void>;
}

interface AdminEventsModalsProps {
  state: AdminEventModalState;
  isSubmitting: boolean;
  actions: AdminEventModalActions;
}

export function AdminEventsModals({
  state,
  isSubmitting,
  actions
}: AdminEventsModalsProps) {
  return (
    <>
      <EventModal isOpen={state.form.open} onClose={actions.closeForm} onSubmit={actions.submitForm} event={state.form.event} isLoading={isSubmitting} />
      <ConfirmModal
        isOpen={!!state.deleteTarget}
        onClose={actions.closeDelete}
        onConfirm={actions.confirmDelete}
        title="Xóa vĩnh viễn sự kiện"
        message={`Bạn có chắc chắn muốn xóa sự kiện "${state.deleteTarget?.title}"? Hành động này sẽ chuyển trạng thái sự kiện sang Đã xóa.`}
        confirmText="Xác nhận xóa"
        type="danger"
        isLoading={isSubmitting}
      />
      <CancelEventModal
        isOpen={!!state.cancelTarget}
        onClose={actions.closeCancel}
        onConfirm={actions.confirmCancel}
        eventTitle={state.cancelTarget?.title || ''}
        isLoading={isSubmitting}
      />
    </>
  );
}
