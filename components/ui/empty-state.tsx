import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
export function EmptyState({
  title,
  description,
  href = '/shop',
  action = 'Explore the edit',
}: {
  title: string;
  description: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="empty-state">
      <span className="eyebrow">A little room for something good</span>
      <h2>{title}</h2>
      <p>{description}</p>
      <Link className="button" href={href}>
        {action}
        <ArrowUpRight size={16} />
      </Link>
    </div>
  );
}
