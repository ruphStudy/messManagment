import { useRef, useState } from 'react';
import { Alert, Image, Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import {
  ATTACHMENT_LIMITS,
  COMPLAINT_CATEGORY_LABELS,
  ComplaintCategory,
  FEEDBACK_LIMITS,
  type StudentComplaintDetail,
  type UploadedFile,
} from '@mess/shared';
import { Button } from '@/components/button';
import { Card, Screen } from '@/components/layout';
import { AppText } from '@/components/text';
import { useToast } from '@/components/toast';
import { api, errorMessage } from '@/lib/api';
import { colors, radius, spacing, TOUCH_TARGET, themed } from '@/theme/tokens';

/** Not security-sensitive: only stops a double-tap/retry from creating two complaints. */
const newKey = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;

export default function NewComplaintScreen() {
  const toast = useToast();
  const [category, setCategory] = useState<ComplaintCategory | null>(null);
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [saving, setSaving] = useState(false);
  const key = useRef(newKey());
  const uploadedId = useRef<string | null>(null);

  const pick = async (camera: boolean) => {
    const permission = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      // Permanently denied: the OS won't ask again, so point to Settings instead of failing silently.
      if (!permission.canAskAgain) {
        return Alert.alert(camera ? 'Camera access is off' : 'Photo access is off', 'You can allow it in Settings, or send the complaint without a photo.', [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => void Linking.openSettings() },
        ]);
      }
      return toast.show('Permission needed to add a photo', 'error');
    }
    const result = await (camera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync)({ mediaTypes: ['images'], quality: 0.6 });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > ATTACHMENT_LIMITS.maxBytes) return toast.show('Photo is larger than 5 MB', 'error');
    uploadedId.current = null;
    setPhoto(asset);
  };

  const choosePhoto = () =>
    Alert.alert('Add photo', undefined, [
      { text: 'Take photo', onPress: () => void pick(true) },
      { text: 'Choose from gallery', onPress: () => void pick(false) },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const submit = async () => {
    if (!category || !description.trim()) return;
    setSaving(true);
    try {
      if (photo && !uploadedId.current) {
        const form = new FormData();
        const type = photo.mimeType ?? 'image/jpeg';
        form.append('file', { uri: photo.uri, name: `photo.${type.split('/')[1] ?? 'jpg'}`, type } as unknown as Blob);
        uploadedId.current = (await api<UploadedFile>('/students/me/uploads/complaint-photo', { method: 'POST', body: form })).id;
      }
      const created = await api<StudentComplaintDetail>('/students/me/complaints', {
        method: 'POST',
        body: { category, description: description.trim(), idempotencyKey: key.current, ...(uploadedId.current ? { attachmentId: uploadedId.current } : {}) },
      });
      toast.show('Complaint sent', 'success');
      router.replace({ pathname: '/complaint', params: { id: created.id } });
    } catch (e) {
      toast.show(errorMessage(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen edges={[]}>
      <Card style={{ gap: spacing.md }}>
        <AppText variant="label">What is it about?</AppText>
        <View style={styles.chips}>
          {Object.values(ComplaintCategory).map((c) => (
            <Pressable key={c} onPress={() => setCategory(c)} style={[styles.chip, category === c && styles.chipOn]} accessibilityRole="radio" accessibilityState={{ selected: category === c }}>
              <AppText style={[{ fontWeight: '600' }, category === c && { color: '#fff' }]}>{COMPLAINT_CATEGORY_LABELS[c]}</AppText>
            </Pressable>
          ))}
        </View>

        <AppText variant="label">Describe the problem</AppText>
        <TextInput
          value={description}
          onChangeText={setDescription}
          maxLength={FEEDBACK_LIMITS.complaintMax}
          multiline
          placeholder="What happened, and when?"
          placeholderTextColor={colors.placeholder}
          style={styles.input}
          accessibilityLabel="Describe the problem"
        />
        <AppText variant="caption" muted style={{ textAlign: 'right' }}>{description.length}/{FEEDBACK_LIMITS.complaintMax}</AppText>

        {photo ? (
          <View style={styles.photoRow}>
            <Image source={{ uri: photo.uri }} style={styles.thumb} accessibilityLabel="Selected photo" />
            <Button title="Remove photo" variant="ghost" onPress={() => { setPhoto(null); uploadedId.current = null; }} />
          </View>
        ) : (
          <Pressable onPress={choosePhoto} style={styles.addPhoto} accessibilityRole="button">
            <Ionicons name="camera-outline" size={22} color={colors.brand700} />
            <AppText style={{ color: colors.brand700, fontWeight: '600' }}>Add photo (optional)</AppText>
          </Pressable>
        )}

        <AppText variant="caption" muted>Your mess owner/manager will review this.</AppText>
        <Button title="Send complaint" onPress={submit} loading={saving} disabled={!category || !description.trim()} />
      </Card>
    </Screen>
  );
}

const styles = themed(() => StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { minHeight: TOUCH_TARGET - 6, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, justifyContent: 'center', backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.brand600, borderColor: colors.brand600 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.control, minHeight: 130, padding: spacing.md, fontSize: 16, color: colors.ink, textAlignVertical: 'top' },
  addPhoto: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: TOUCH_TARGET, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, borderRadius: radius.control, paddingHorizontal: spacing.md },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thumb: { width: 88, height: 88, borderRadius: radius.control },
}));
