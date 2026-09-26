import { useState } from 'react';
import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { Image as ImageIcon } from 'lucide-react';
import { EventFormValues } from './eventModalSchemas';

interface EventImagePreviewSectionProps {
  register: UseFormRegister<EventFormValues>;
  errors: FieldErrors<EventFormValues>;
  watchedImageUrl?: string;
}

export function EventImagePreviewSection({ register, errors, watchedImageUrl }: EventImagePreviewSectionProps) {
  const [imageError, setImageError] = useState(false);

  return (
    <div>
      <label htmlFor="event-image-url" className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-1">
        URL Hình ảnh bìa <span className="text-danger-readable">*</span>
      </label>
      <input 
        id="event-image-url"
        {...register('imageUrl')}
        aria-label="URL hình ảnh bìa"
        aria-invalid={Boolean(errors.imageUrl)}
        aria-describedby={errors.imageUrl ? 'event-image-url-error' : undefined}
        className="w-full bg-surface-2 border border-border-subtle rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus:border-brand-primary/50 transition-colors"
        placeholder="https://images.unsplash.com/photo-..."
      />
      {errors.imageUrl && <p id="event-image-url-error" role="alert" className="text-danger-readable text-xs mt-1">{errors.imageUrl.message}</p>}
      
      {/* Image Preview Box */}
      {watchedImageUrl && (
        <div className="mt-2 p-2.5 bg-surface-2/40 border border-border-subtle rounded-xl flex items-center gap-3">
          <div className="w-20 h-14 rounded-lg overflow-hidden bg-surface-3 shrink-0 border border-border-subtle relative">
            {!imageError ? (
              <img 
                src={watchedImageUrl} 
                alt="Xem trước" 
                width="80"
                height="56"
                loading="lazy"
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
                onLoad={() => setImageError(false)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-text-secondary">
                <ImageIcon className="w-5 h-5" />
              </div>
            )}
          </div>
          <div className="truncate">
            <p className="text-xs font-bold text-text-primary">Xem trước ảnh bìa</p>
            <p className="text-[11px] text-text-secondary truncate">{imageError ? 'Đường dẫn ảnh không hợp lệ' : watchedImageUrl}</p>
          </div>
        </div>
      )}
    </div>
  );
}
