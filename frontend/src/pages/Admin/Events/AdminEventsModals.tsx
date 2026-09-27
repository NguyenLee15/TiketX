import EventModal, { EventFormValues } from '../../../components/Admin/EventModal';
import ConfirmModal from '../../../components/Admin/ConfirmModal';
import CancelEventModal from '../../../components/Admin/CancelEventModal';
import { Event } from '../../../types';

interface AdminEventsModalsProps {
  isModalOpen: boolean;
  selectedEvent: Event | null;
  deleteEventTarget: Event | null;
  cancelEventTarget: Event | null;
  isSubmitting: boolean;
  onCloseForm: () => void;
  onSubmitForm: (data: EventFormValues) => Promise<void>;
  onCloseDelete: () => void;
  onConfirmDelete: () => Promise<void>;
  onCloseCancel: () => void;
  onConfirmCancel: (reason: string) => Promise<void>;
}

export function AdminEventsModals({
  isModalOpen,
  selectedEvent,
  deleteEventTarget,
  cancelEventTarget,
  isSubmitting,
  onCloseForm,
  onSubmitForm,
  onCloseDelete,
  onConfirmDelete,
  onCloseCancel,
  onConfirmCancel
}: AdminEventsModalsProps) {
  return (
    <>
      <EventModal isOpen={isModalOpen} onClose={onCloseForm} onSubmit={onSubmitForm} event={selectedEvent} isLoading={isSubmitting} />
      <ConfirmModal
        isOpen={!!deleteEventTarget}
        onClose={onCloseDelete}
        onConfirm={onConfirmDelete}
        title="Xóa vĩnh viễn sự kiện"
        message={`Bạn có chắc chắn muốn xóa sự kiện "${deleteEventTarget?.title}"? Hành động này sẽ chuyển trạng thái sự kiện sang Đã xóa.`}
        confirmText="Xác nhận xóa"
        type="danger"
        isLoading={isSubmitting}
      />
      <CancelEventModal
        isOpen={!!cancelEventTarget}
        onClose={onCloseCancel}
        onConfirm={onConfirmCancel}
        eventTitle={cancelEventTarget?.title || ''}
        isLoading={isSubmitting}
      />
    </>
  );
}
