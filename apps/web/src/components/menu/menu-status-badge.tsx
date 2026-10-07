import { Badge } from '@/components/ui/badge';

export function MenuStatusBadge({ menu }: { menu: { isPublished: boolean } | null }) {
  if (!menu) return <Badge>Not created</Badge>;
  return menu.isPublished ? <Badge tone="success">Published</Badge> : <Badge tone="warning">Draft</Badge>;
}
