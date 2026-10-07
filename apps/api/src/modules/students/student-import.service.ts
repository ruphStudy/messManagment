import { HttpStatus, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ErrorCode,
  normalizeMobile,
  STUDENT_CSV_COLUMNS,
  STUDENT_CSV_REQUIRED,
  STUDENT_IMPORT_LIMITS,
  todayDateString,
  type StudentCsvColumn,
  type StudentImportIssue,
  type StudentImportResult,
} from '@mess/shared';
import { AppException, type AppErrorPayload } from '../../common/http/app.exception';
import { parseCsv, toIsoDate } from './csv';
import { CreateStudentDto } from './dto/student.dto';
import { StudentsService } from './students.service';

export interface UploadedCsv {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const CSV_MIME_TYPES = ['text/csv', 'application/csv', 'text/plain', 'application/vnd.ms-excel'];
const SKIP_CODES: string[] = [ErrorCode.STUDENT_DUPLICATE, ErrorCode.STUDENT_ARCHIVED];

/** "First Name", "first_name" and "firstName" all map to firstName. */
const headerKey = (header: string) => header.toLowerCase().replace(/[^a-z]/g, '');
const COLUMN_BY_KEY = new Map(STUDENT_CSV_COLUMNS.map((c) => [headerKey(c), c]));

/**
 * Controlled partial import: each valid row is created on its own through the normal create path
 * (same validation, duplicate checks and account linking). Invalid or duplicate rows are reported, never half-written.
 */
@Injectable()
export class StudentImportService {
  constructor(private readonly students: StudentsService) {}

  async import(messId: string, file: UploadedCsv | undefined): Promise<StudentImportResult> {
    const rows = this.readRows(file);
    const [header, ...records] = rows;
    const columns = header.map((h) => COLUMN_BY_KEY.get(headerKey(h)));
    const missing = STUDENT_CSV_REQUIRED.filter((c) => !columns.includes(c));
    if (missing.length) throw this.fileError(`Missing required column(s): ${missing.join(', ')}`);

    const dataRows = records
      .map((cells, index) => ({ cells, row: index + 2 }))
      .filter(({ cells }) => cells.some((c) => c.trim()));
    if (dataRows.length === 0) throw this.fileError('The file has no student rows');
    if (dataRows.length > STUDENT_IMPORT_LIMITS.maxRows) {
      throw this.fileError(`Import up to ${STUDENT_IMPORT_LIMITS.maxRows} students at a time`);
    }

    const result: StudentImportResult = { total: dataRows.length, imported: 0, skipped: 0, failed: 0, issues: [] };
    const seenMobiles = new Map<string, number>();
    const today = todayDateString();
    const report = (issue: StudentImportIssue) => {
      result.issues.push(issue);
      result[issue.kind]++;
    };

    for (const { cells, row } of dataRows) {
      const raw: Partial<Record<StudentCsvColumn, string>> = {};
      columns.forEach((column, i) => {
        if (column) raw[column] = (cells[i] ?? '').trim();
      });
      raw.joiningDate = raw.joiningDate ? toIsoDate(raw.joiningDate) : today;

      const dto = plainToInstance(CreateStudentDto, raw);
      const errors = await validate(dto);
      if (errors.length) {
        const first = errors[0];
        report({ row, field: first.property, message: Object.values(first.constraints ?? {})[0] ?? 'Invalid value', kind: 'failed' });
        continue;
      }

      const mobile = normalizeMobile(dto.mobile) ?? dto.mobile;
      const firstRow = seenMobiles.get(mobile);
      if (firstRow) {
        report({ row, field: 'mobile', message: `Same mobile number as row ${firstRow}`, kind: 'skipped' });
        continue;
      }
      seenMobiles.set(mobile, row);

      try {
        await this.students.create(messId, dto);
        result.imported++;
      } catch (error) {
        if (!(error instanceof AppException)) throw error;
        const { code, message, fields } = error.getResponse() as AppErrorPayload;
        const field = fields ? Object.keys(fields)[0] : undefined;
        report({ row, field, message, kind: SKIP_CODES.includes(code) ? 'skipped' : 'failed' });
      }
    }
    return result;
  }

  private readRows(file: UploadedCsv | undefined): string[][] {
    if (!file) throw this.fileError('Choose a CSV file to import');
    const isCsv = file.originalname.toLowerCase().endsWith('.csv') && CSV_MIME_TYPES.includes(file.mimetype);
    if (!isCsv) throw this.fileError('Only .csv files are supported. In Excel use "Save as → CSV".');
    if (file.size > STUDENT_IMPORT_LIMITS.maxBytes) throw this.fileError('The file is too large (max 1 MB)');

    const text = file.buffer.toString('utf8');
    if (text.includes('\0')) throw this.fileError('This does not look like a CSV text file');
    try {
      const rows = parseCsv(text);
      if (!rows.length) throw new Error('empty');
      return rows;
    } catch {
      throw this.fileError('Could not read the CSV file. Check that quotes are closed.');
    }
  }

  private fileError(message: string) {
    return new AppException(HttpStatus.BAD_REQUEST, ErrorCode.FILE_INVALID, message);
  }
}
