import styles from './Toggle.module.css';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, className, disabled }: ToggleProps) {
  return (
    <button
      className={`${styles.toggle} ${className ?? ''}`}
      onClick={() => !disabled && onChange(!checked)}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
    >
      <div className={`${styles.track} ${checked ? styles.trackOn : ''}`}>
        <div className={`${styles.knob} ${checked ? styles.knobOn : ''}`} />
      </div>
    </button>
  );
}
