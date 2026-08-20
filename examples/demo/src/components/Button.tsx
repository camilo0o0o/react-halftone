import type { ReactNode } from 'react';

interface ButtonProps {
  children: ReactNode;
  onClick: () => void;
  /** `ink` for secondary actions, `accent` for the primary one in a card. */
  variant?: 'ink' | 'accent';
  /** Stretches the button across the card. */
  block?: boolean;
}

export function Button({ children, onClick, variant = 'ink', block }: ButtonProps) {
  return (
    <button
      type="button"
      className={`btn btn-${variant}${block ? ' btn-block' : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
