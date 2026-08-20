import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  /** Rendered at the right end of the header row, opposite the title. */
  action?: ReactNode;
  children: ReactNode;
}

export function Card({ title, action, children }: CardProps) {
  return (
    <section className="card">
      {(title || action) && (
        <header className="card-header">
          {title && <h2 className="card-title">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
