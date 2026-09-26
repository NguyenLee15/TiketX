import React from 'react';

export const allowedTicketTabs = ['All', 'Paid', 'Used', 'RefundPending', 'Cancelled'] as const;
export type TicketTabType = (typeof allowedTicketTabs)[number];

interface TicketFilterTabsProps {
  currentTab: TicketTabType;
  onTabChange: (tab: TicketTabType) => void;
}

const TAB_LABELS: Record<TicketTabType, string> = {
  All: 'Tất cả',
  Paid: 'Còn hạn',
  Used: 'Đã qua cửa',
  RefundPending: 'Đang hoàn',
  Cancelled: 'Đã hủy',
};

export const TicketFilterTabs: React.FC<TicketFilterTabsProps> = React.memo(({
  currentTab,
  onTabChange,
}) => {
  return (
    <div className="flex gap-1.5 bg-surface-1/80 p-1.5 rounded-xl border border-border-subtle self-start sm:self-center shrink-0 overflow-x-auto max-w-full">
      {allowedTicketTabs.map(tab => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
            currentTab === tab 
              ? 'bg-brand-primary text-surface-0 shadow-md shadow-brand-glow'
              : 'text-text-secondary hover:text-white hover:bg-surface-2'
          }`}
        >
          {TAB_LABELS[tab]}
        </button>
      ))}
    </div>
  );
});
