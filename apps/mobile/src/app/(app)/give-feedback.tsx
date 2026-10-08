import { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { router } from 'expo-router';
import { FEEDBACK_LIMITS } from '@mess/shared';
import { Button } from '@/components/button';
import { Card, Screen } from '@/components/layout';
import { StarInput } from '@/components/star-input';
import { AppText } from '@/components/text';
import { useToast } from '@/components/toast';
import { api, errorMessage } from '@/lib/api';
import { colors, radius, spacing } from '@/theme/tokens';

/** General feedback about the mess. For a specific problem, use "Raise a complaint". */
export default function GiveFeedbackScreen() {
  const toast = useToast();
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const canSubmit = rating !== null || comment.trim().length > 0;

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await api('/students/me/feedback/general', {
        method: 'POST',
        body: { ...(rating !== null ? { overallRating: rating } : {}), ...(comment.trim() ? { comment: comment.trim() } : {}) },
      });
      toast.show('Thanks! Your mess will see your feedback.', 'success');
      router.back();
    } catch (e) {
      toast.show(errorMessage(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen edges={[]}>
      <Card style={{ gap: spacing.md }}>
        <StarInput label="How is the mess overall? (optional)" value={rating} onChange={setRating} large />
        <AppText variant="label">Your feedback</AppText>
        <TextInput
          value={comment}
          onChangeText={setComment}
          maxLength={FEEDBACK_LIMITS.commentMax}
          multiline
          placeholder="Suggestions, praise, ideas…"
          placeholderTextColor={colors.placeholder}
          style={styles.input}
          accessibilityLabel="Your feedback"
        />
        <AppText variant="caption" muted>Add a rating, a comment, or both. Only your mess sees this.</AppText>
        <Button title="Send feedback" onPress={submit} loading={saving} disabled={!canSubmit} />
      </Card>
      <Button title="Have a problem? Raise a complaint" variant="ghost" onPress={() => router.replace('/complaint-new')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.control, minHeight: 120, padding: spacing.md, fontSize: 16, color: colors.ink, textAlignVertical: 'top' },
});
