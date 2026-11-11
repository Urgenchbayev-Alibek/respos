import { ImagePlus } from 'lucide-react';
import { useEffect, useId, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { MENU_PHOTO_MAX_BYTES, MENU_PHOTO_TYPES } from '@/entities/menu/menu-item.queries';
import { resolveFileUrl } from '@/shared/api/file-url';
import styles from './MenuForms.module.css';

export interface PhotoUploadProps {
  photoUrl: string | null | undefined;
  file: File | null;
  onFileChange: (file: File | null) => void;
}

/** Photo picker (jpg/png/webp ≤ 2 MB, validated before upload; server re-validates). */
export function PhotoUpload({ photoUrl, file, onFileChange }: PhotoUploadProps) {
  const { t } = useTranslation('menu');
  const inputId = useId();
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file || typeof URL.createObjectURL !== 'function') {
      setPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.files?.[0] ?? null;
    event.target.value = '';
    if (!next) return;
    if (!(MENU_PHOTO_TYPES as readonly string[]).includes(next.type)) {
      setError(t('photo.invalidType'));
      return;
    }
    if (next.size > MENU_PHOTO_MAX_BYTES) {
      setError(t('photo.tooLarge'));
      return;
    }
    setError(null);
    onFileChange(next);
  };

  const shown = preview ?? resolveFileUrl(photoUrl);
  return (
    <div className={styles.photo}>
      <div className={styles.photoPreview}>
        {shown ? <img src={shown} alt={t('photo.alt')} /> : <ImagePlus aria-hidden="true" />}
      </div>
      <div className={styles.photoControls}>
        <label htmlFor={inputId} className={styles.photoButton}>
          {t(shown ? 'photo.replace' : 'photo.choose')}
        </label>
        <input id={inputId} type="file" accept={MENU_PHOTO_TYPES.join(',')} className="visually-hidden" onChange={onChange} />
        <span className={styles.hint}>{file ? file.name : t('photo.hint')}</span>
        {error && (
          <span className={styles.error} role="alert">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
