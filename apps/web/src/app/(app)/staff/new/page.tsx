'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Permission, Role, STAFF_ASSIGNABLE_ROLES, TEAM_MANAGEABLE_ROLES, type CreateStaffResult } from '@mess/shared';
import { generateTemporaryPassword, StaffForm } from '@/components/staff/staff-form';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth/auth-context';
import { RequireAuth } from '@/lib/auth/guards';

function AddStaff() {
  const { session } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const roles = STAFF_ASSIGNABLE_ROLES.filter((r) => !!session && TEAM_MANAGEABLE_ROLES[session.role].includes(r));

  return (
    <>
      <Link href="/staff" className="mb-2 inline-flex min-h-9 items-center gap-1 text-sm font-medium text-brand-700 hover:underline"><ArrowLeft className="size-4" aria-hidden /> Team</Link>
      <PageHeader title="Add staff" description="They sign in on the web with their mobile number and password" />
      <Card className="max-w-2xl">
        <StaffForm
          mode="create"
          roles={roles}
          submitLabel="Add to team"
          initial={{ firstName: '', lastName: '', mobile: '', email: '', role: roles.includes(Role.MESS_STAFF) ? Role.MESS_STAFF : roles[0], temporaryPassword: generateTemporaryPassword() }}
          onCancel={() => router.push('/staff')}
          onSubmit={async (v) => {
            const res = await api<CreateStaffResult>('/staff', {
              method: 'POST',
              body: { firstName: v.firstName.trim(), lastName: v.lastName.trim() || null, mobile: v.mobile, email: v.email.trim() || null, role: v.role, temporaryPassword: v.temporaryPassword || undefined },
            });
            toast.success(res.reusedAccount ? 'Existing account added to your team. They keep their current password.' : 'Team member added. Share the temporary password with them in person.');
            router.replace(`/staff/${res.staff.id}`);
          }}
        />
      </Card>
    </>
  );
}

export default function AddStaffPage() {
  return (
    <RequireAuth permission={Permission.STAFF_MANAGE}>
      <AddStaff />
    </RequireAuth>
  );
}
