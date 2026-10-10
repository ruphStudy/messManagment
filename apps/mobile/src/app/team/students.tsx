import { useState } from 'react';
import { router } from 'expo-router';
import { Permission, STUDENT_STATUS_LABELS, StudentStatus, type StudentListItem } from '@mess/shared';
import { Button } from '@/components/button';
import { Screen } from '@/components/layout';
import { EmptyState, ErrorState, FullScreenLoader } from '@/components/states';
import { Chips, ListItem, Pill, SearchBar } from '@/components/team/kit';
import { useDebounced } from '@/components/team/use-debounced';
import { PlanRequests } from '@/components/team/plan-requests';
import { useCan, useLoadMore } from '@/lib/team';

const FILTERS = [
  { value: '', label: 'All' },
  { value: StudentStatus.ACTIVE, label: 'Active' },
  { value: StudentStatus.INACTIVE, label: 'Inactive' },
  { value: StudentStatus.ARCHIVED, label: 'Archived' },
];

export default function StudentsScreen() {
  const can = useCan();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const q = useDebounced(search.trim(), 350);
  const { items, meta, error, loading, load, hasMore } = useLoadMore<StudentListItem>(`/students?search=${encodeURIComponent(q)}${status ? `&status=${status}` : ''}&sortBy=name&sortOrder=asc`);
  return (
    <Screen edges={[]} onRefresh={() => load(1)} refreshing={loading && meta?.page === 1}>
      {can(Permission.STUDENT_MANAGE) && <Button title="Add student" onPress={() => router.push('/team/student-form')} />}
      {can(Permission.SUBSCRIPTION_VIEW) && <PlanRequests onApproved={() => load(1)} />}
      <SearchBar value={search} onChange={setSearch} placeholder="Search name or mobile" />
      <Chips options={FILTERS} value={status} onChange={setStatus} />
      {!meta && error ? (
        <ErrorState title="Couldn't load students" description={error} onRetry={() => load(1)} />
      ) : !meta ? (
        <FullScreenLoader />
      ) : !items.length ? (
        <EmptyState icon="people-outline" title={q || status ? 'No students match.' : 'No students yet.'} />
      ) : (
        <>
          {items.map((s) => (
            <ListItem
              key={s.id}
              avatar={[s.firstName, s.lastName].filter(Boolean).join(' ')}
              title={[s.firstName, s.lastName].filter(Boolean).join(' ')}
              subtitle={[s.mobile, s.hostelOrPg ?? s.collegeName].filter(Boolean).join(' · ')}
              right={s.status !== StudentStatus.ACTIVE ? <Pill label={STUDENT_STATUS_LABELS[s.status]} /> : undefined}
              onPress={() => router.push({ pathname: '/team/student', params: { id: s.id } })}
            />
          ))}
          {hasMore && <Button title="Load more" variant="secondary" loading={loading} onPress={() => load(meta.page + 1)} />}
        </>
      )}
    </Screen>
  );
}
