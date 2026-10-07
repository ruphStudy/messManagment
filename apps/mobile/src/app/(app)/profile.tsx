import { useState, type ReactNode } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { DEFAULT_COUNTRY_CODE, STUDENT_STATUS_LABELS, type StudentSelfProfile } from '@mess/shared';
import { Button } from '@/components/button';
import { Card, Screen } from '@/components/layout';
import { NotLinkedCard } from '@/components/not-linked';
import { ProfileEditForm } from '@/components/profile-edit-form';
import { ErrorState, FullScreenLoader } from '@/components/states';
import { AppText } from '@/components/text';
import { useToast } from '@/components/toast';
import { useAuth } from '@/lib/auth';
import { formatDate, studentName, useStudentProfile } from '@/lib/student-profile';
import { colors, spacing } from '@/theme/tokens';

const phone = (mobile: string) => `${DEFAULT_COUNTRY_CODE} ${mobile}`;

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.row}>
      <AppText muted>{label}</AppText>
      <AppText style={[styles.value, !value && { color: colors.placeholder, fontWeight: '400' }]}>{value || 'Not added'}</AppText>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <AppText variant="label" muted>
        {title.toUpperCase()}
      </AppText>
      {children}
    </Card>
  );
}

function LinkedProfile({ profile, onEdit }: { profile: StudentSelfProfile; onEdit: () => void }) {
  const hasFamily = profile.parentName || profile.parentMobile || profile.emergencyContactName || profile.emergencyContactMobile;
  return (
    <>
      <Section title="Mess">
        <Row label="Mess" value={profile.mess.name} />
        <Row label="Joined" value={formatDate(profile.joiningDate)} />
        <Row label="Status" value={STUDENT_STATUS_LABELS[profile.status]} />
        <Row label="Mess contact" value={phone(profile.mess.mobile)} />
      </Section>
      <Section title="Your details">
        <Row label="Mobile" value={phone(profile.mobile)} />
        <Row label="Email" value={profile.email} />
        <Row label="College" value={profile.collegeName} />
        <Row label="Course" value={profile.courseName} />
        <Row label="Hostel / PG" value={profile.hostelOrPg} />
        <Row label="Address" value={profile.localAddress} />
        <Button title="Edit details" variant="secondary" onPress={onEdit} style={{ marginTop: spacing.sm }} />
      </Section>
      {hasFamily && (
        <Section title="Family & emergency">
          <Row label="Parent" value={profile.parentName} />
          <Row label="Parent mobile" value={profile.parentMobile && phone(profile.parentMobile)} />
          <Row label="Emergency contact" value={profile.emergencyContactName} />
          <Row label="Emergency mobile" value={profile.emergencyContactMobile && phone(profile.emergencyContactMobile)} />
        </Section>
      )}
    </>
  );
}

export default function ProfileScreen() {
  const { session, logout } = useAuth();
  const { data, loading, error, reload, update } = useStudentProfile();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  if (!session) return null;
  if (!data && loading) return <FullScreenLoader />;
  if (!data) return <ErrorState title="Couldn't load your profile" description={error ?? undefined} onRetry={reload} />;

  const profile = data.linked ? data.profile : null;
  const name = profile ? studentName(profile) : phone(session.user.mobile);

  const confirmLogout = () =>
    Alert.alert('Sign out?', 'You will need your mobile number and a code to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          await logout().catch(() => toast.show('Signed out on this device', 'info'));
        },
      },
    ]);

  return (
    <Screen edges={[]} onRefresh={editing ? undefined : reload} refreshing={loading}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <AppText variant="title" style={{ color: colors.brand700 }}>
            {(profile?.firstName[0] ?? '#').toUpperCase()}
          </AppText>
        </View>
        <AppText variant="title">{name}</AppText>
      </View>

      {!profile ? (
        <NotLinkedCard mobile={session.user.mobile} />
      ) : editing ? (
        <ProfileEditForm
          profile={profile}
          onCancel={() => setEditing(false)}
          onSave={async (input) => {
            await update(input);
            setEditing(false);
            toast.show('Profile updated', 'success');
          }}
        />
      ) : (
        <LinkedProfile profile={profile} onEdit={() => setEditing(true)} />
      )}

      {profile && !editing && <Button title="Plan history" variant="secondary" onPress={() => router.push('/plans')} />}
      {!editing && <Button title="Sign out" variant="secondary" onPress={confirmLogout} loading={loggingOut} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: spacing.sm, marginVertical: spacing.md },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.brand100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, gap: spacing.md },
  value: { fontWeight: '600', flexShrink: 1, textAlign: 'right' },
});
