import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from './layout';
import { EmptyState } from './states';

/** Placeholder for tabs whose features ship in later sprints. */
export function ComingSoon({ title, description, icon }: { title: string; description: string; icon: ComponentProps<typeof Ionicons>['name'] }) {
  return (
    <Screen scroll={false} edges={[]}>
      <EmptyState icon={icon} title={title} description={description} />
    </Screen>
  );
}
