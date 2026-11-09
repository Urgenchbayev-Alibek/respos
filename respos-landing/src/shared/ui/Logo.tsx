import styles from './Logo.module.css';

interface LogoProps {
  inverse?: boolean;
}

/** Wordmark: a stylised plate with a cloche line. Decorative; text carries the name. */
export function Logo({ inverse = false }: LogoProps) {
  return (
    <span className={inverse ? `${styles.logo} ${styles.inverse}` : styles.logo}>
      <svg className={styles.mark} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <rect width="32" height="32" rx="9" fill="var(--color-primary)" />
        <circle cx="16" cy="17.5" r="7.5" fill="none" stroke="#fff" strokeWidth="2.5" />
        <path d="M9 9.5h14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="16" cy="17.5" r="2.4" fill="#fff" />
      </svg>
      <span className={styles.word}>
        Restaurant<span className={styles.accent}>OS</span>
      </span>
    </span>
  );
}
