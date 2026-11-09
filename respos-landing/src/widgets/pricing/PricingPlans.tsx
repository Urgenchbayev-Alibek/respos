import { useTranslation } from 'react-i18next';
import { Building2, Check, Info, Users } from 'lucide-react';
import type { PublicPlan } from '@/shared/api/publicApi';
import { ROUTES } from '@/shared/config/routes';
import { useTList } from '@/shared/i18n/useTList';
import { cx } from '@/shared/lib/cx';
import { ButtonLink } from '@/shared/ui/Button';
import { Container } from '@/shared/ui/Container';
import { usePublicPlans } from './usePublicPlans';
import styles from './PricingPlans.module.css';

const TIERS = ['starter', 'business', 'enterprise'] as const;
type Tier = (typeof TIERS)[number];

function PlanCard({ tier, livePlan }: { tier: Tier; livePlan: PublicPlan | undefined }) {
  const { t } = useTranslation();
  const features = useTList(`pricing.plans.${tier}.features`);
  const featured = tier === 'business';

  return (
    <li className={cx(styles.card, featured && styles.featured)}>
      <h2 className={styles.name}>{livePlan?.name || t(`pricing.plans.${tier}.name`)}</h2>
      <p className={styles.audience}>{t(`pricing.plans.${tier}.audience`)}</p>
      <p className={styles.price}>{t('pricing.priceTbd')}</p>

      {livePlan && (
        <div className={styles.limits} aria-label={t('pricing.limitsFromServer')}>
          <span>
            <Building2 aria-hidden="true" />
            {t('pricing.branches', { count: livePlan.maxBranches })}
          </span>
          <span>
            <Users aria-hidden="true" />
            {t('pricing.users', { count: livePlan.maxUsers })}
          </span>
        </div>
      )}

      <ul className={styles.features}>
        {features.map((feature) => (
          <li key={feature}>
            <Check aria-hidden="true" className={styles.check} />
            {feature}
          </li>
        ))}
      </ul>

      <ButtonLink to={ROUTES.demo} variant={featured ? 'primary' : 'secondary'} block className={styles.cta}>
        {t('actions.contactUs')}
      </ButtonLink>
    </li>
  );
}

export function PricingPlans() {
  const { t } = useTranslation();
  const { plans } = usePublicPlans();
  const findPlan = (tier: Tier) => plans.find((plan) => plan.code?.toLowerCase() === tier);

  return (
    <Container>
      <ul className={styles.grid}>
        {TIERS.map((tier) => (
          <PlanCard key={tier} tier={tier} livePlan={findPlan(tier)} />
        ))}
      </ul>
      <p className={styles.note}>
        <Info aria-hidden="true" />
        {t('pricing.note')}
      </p>
    </Container>
  );
}
