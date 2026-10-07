'use client';

import { useRouter } from 'next/navigation';
import { Permission, type StudentDetail } from '@mess/shared';
import { StudentForm } from '@/components/students/student-form';
import { PageHeader } from '@/components/ui/page-header';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { RequireAuth } from '@/lib/auth/guards';
import { fullName } from '@/lib/format';
import { emptyStudentForm, toStudentInput } from '@/lib/student-form';

function AddStudent() {
  const router = useRouter();
  const toast = useToast();

  return (
    <>
      <PageHeader title="Add student" description="Only name, mobile and joining date are required." />
      <StudentForm
        initial={emptyStudentForm()}
        submitLabel="Save student"
        cancelHref="/students"
        onSubmit={async (values) => {
          const student = await api<StudentDetail>('/students', { method: 'POST', body: toStudentInput(values) });
          toast.success(
            'Student added',
            student.appAccount.linked ? `${fullName(student)} is already using the app and has been linked.` : fullName(student),
          );
          router.replace(`/students/${student.id}`);
        }}
      />
    </>
  );
}

export default function AddStudentPage() {
  return (
    <RequireAuth permission={Permission.STUDENT_MANAGE}>
      <AddStudent />
    </RequireAuth>
  );
}
