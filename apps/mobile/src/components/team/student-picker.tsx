import { useEffect, useState } from 'react';
import { StudentStatus, type StudentListItem } from '@mess/shared';
import { Card } from '@/components/layout';
import { AppText } from '@/components/text';
import { api } from '@/lib/api';
import { Button } from '../button';
import { ListItem, SearchBar } from './kit';
import { useDebounced } from './use-debounced';

/** Search and pick an active student (or show the one already chosen). */
export function StudentPicker({ value, onChange }: { value: StudentListItem | null; onChange: (s: StudentListItem | null) => void }) {
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim(), 300);
  const [results, setResults] = useState<StudentListItem[] | null>(null);
  useEffect(() => {
    if (q.length < 2) return setResults(null);
    api<StudentListItem[]>(`/students?search=${encodeURIComponent(q)}&status=${StudentStatus.ACTIVE}&pageSize=8&sortBy=name&sortOrder=asc`).then(setResults).catch(() => setResults([]));
  }, [q]);
  if (value) {
    return (
      <Card>
        <AppText variant="label">{[value.firstName, value.lastName].filter(Boolean).join(' ')}</AppText>
        <AppText variant="caption" muted>{value.mobile}</AppText>
        <Button title="Change student" variant="ghost" onPress={() => onChange(null)} />
      </Card>
    );
  }
  return (
    <>
      <SearchBar value={search} onChange={setSearch} placeholder="Search student (name or mobile)" />
      {results?.map((s) => <ListItem key={s.id} avatar={[s.firstName, s.lastName].filter(Boolean).join(' ')} title={[s.firstName, s.lastName].filter(Boolean).join(' ')} subtitle={s.mobile} onPress={() => onChange(s)} />)}
      {results && !results.length && <AppText muted>No active students match.</AppText>}
    </>
  );
}
