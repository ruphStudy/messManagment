import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { User } from '@prisma/client';
import { ATTACHMENT_LIMITS, can, ErrorCode, Permission, type UploadedFile } from '@mess/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type { RequestAuth } from '../../common/auth.types';
import { AppException } from '../../common/http/app.exception';
import { StudentsService } from '../students/students.service';
import { STORAGE_PROVIDER, type StorageProvider } from './storage.provider';

export interface IncomingFile {
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** Detects the real image type from the first bytes; the client's MIME type and filename are not trusted. */
function sniffImage(buffer: Buffer): { mime: string; ext: string } | null {
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', ext: 'png' };
  if (buffer.length > 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  return null;
}

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly students: StudentsService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  /** A student's complaint photo, stored privately under their mess. */
  async uploadComplaintPhoto(user: User, file: IncomingFile | undefined): Promise<UploadedFile> {
    const student = await this.students.resolveSelf(user);
    if (!student) throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.STUDENT_NOT_LINKED, 'Your mess has not linked your mobile number yet');
    if (!file) throw this.invalid('Choose a photo to upload');
    if (file.size > ATTACHMENT_LIMITS.maxBytes) throw this.invalid('Photo is larger than 5 MB');
    const kind = sniffImage(file.buffer);
    if (!kind) throw this.invalid('Only JPEG, PNG or WebP photos are allowed');

    const storageKey = `${randomUUID()}.${kind.ext}`;
    await this.storage.put(storageKey, file.buffer, kind.mime);
    const row = await this.prisma.storedFile.create({
      data: { messId: student.messId, uploadedById: user.id, storageKey, mimeType: kind.mime, sizeBytes: file.size },
    });
    return { id: row.id, mimeType: row.mimeType, sizeBytes: row.sizeBytes };
  }

  /**
   * Bytes for an authorized viewer: the uploader, or a team member of the file's mess who can view complaints.
   * Everyone else gets "not found" (no hint that the file exists).
   */
  async read(auth: RequestAuth, id: string) {
    const file = await this.prisma.storedFile.findUnique({ where: { id } });
    const allowed =
      !!file &&
      (file.uploadedById === auth.user.id || (auth.membership?.messId === file.messId && can(auth.role, Permission.COMPLAINT_VIEW)));
    if (!file || !allowed) throw this.notFound();
    const data = await this.storage.get(file.storageKey);
    if (!data) throw this.notFound();
    return { data, mimeType: file.mimeType };
  }

  /** A file the student uploaded themselves and that isn't attached to anything yet. */
  async requireAttachable(userId: string, messId: string, id: string) {
    const file = await this.prisma.storedFile.findFirst({ where: { id, uploadedById: userId, messId, complaint: null }, select: { id: true } });
    if (!file) throw this.invalid('That photo cannot be attached. Please upload it again.');
  }

  private invalid(message: string) {
    return new AppException(HttpStatus.BAD_REQUEST, ErrorCode.ATTACHMENT_INVALID, message, { file: [message] });
  }

  private notFound() {
    return new AppException(HttpStatus.NOT_FOUND, ErrorCode.FILE_NOT_FOUND, 'File not found');
  }
}
