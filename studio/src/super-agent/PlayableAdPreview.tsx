import { useI18n } from '../i18n/I18n';
import { RemixIcon } from '../icons/RemixIcons';

export function PlayableAdPreview() {
  const { t } = useI18n();
  return (
    <div className="om-sa-screw-preview">
      <div className="om-sa-screw-plank" />
      <div className="om-sa-screw-head" />
      <span className="om-sa-screw-pointer"><RemixIcon name="cursor-fill" size={22} /></span>
      <div className="om-sa-screw-result">
        <RemixIcon name="check-line" size={24} />
        <span>{t('Play again')}</span>
        <strong>{t('Go to store')}</strong>
      </div>
    </div>
  );
}
