'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { Permission, StudentStatus, type StudentDetail } from '@mess/shared';
import { StudentForm } from '@/components/students/student-form';
import { StudentDetailSkeleton, StudentLoadError } from '@/components/students/student-page-states';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { RequireAuth } from '@/lib/auth/guards';
import { fullName } from '@/lib/format';
import { studentToForm, toStudentInput } from '@/lib/student-form';
import { useStudent } from '@/lib/use-student';

function EditStudent({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const { student, error, reload } = useStudent(id);

  if (error) return <StudentLoadError error={error} onRetry={reload} />;
  if (!student) return <StudentDetailSkeleton />;
  if (student.status === StudentStatus.ARCHIVED) {
    return <Alert tone="info">This student is archived. Restore them from their profile before editing.</Alert>;
  }

  return (
    <>
      <PageHeader title={`Edit ${fullName(student)}`} />
      <StudentForm
        key={student.updatedAt}
        initial={studentToForm(student)}
        appLinked={student.appAccount.linked}
        submitLabel="Save changes"
        cancelHref={`/students/${id}`}
        onSubmit={async (values) => {
          await api<StudentDetail>(`/students/${id}`, { method: 'PATCH', body: toStudentInput(values) });
          toast.success('Changes saved');
          router.replace(`/students/${id}`);
        }}
      />
    </>
  );
}

export default function EditStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequireAuth permission={Permission.STUDENT_MANAGE}>
      <EditStudent id={id} />
    </RequireAuth>
  );
}
