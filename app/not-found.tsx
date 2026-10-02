import { EmptyState } from '@/components/ui/empty-state';
export default function NotFound() {
  return (
    <EmptyState
      title="This page has slipped out of the edit."
      description="The link may have changed, or this piece may no longer be available."
    />
  );
}
