'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, FileSpreadsheet } from 'lucide-react';
import {
  Permission,
  STUDENT_CSV_COLUMNS,
  STUDENT_CSV_REQUIRED,
  STUDENT_IMPORT_LIMITS,
  type StudentImportResult,
} from '@mess/shared';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { RequireAuth } from '@/lib/auth/guards';

const SAMPLE_ROWS = [
  ['Raj', 'Kumar', '9876543210', 'raj@example.com', 'COEP', 'B.Tech', 'Shivaji Hostel', '2026-07-01', 'Suresh Kumar', '9822000000', '', '', ''],
  ['Priya', '', '+91 98765 43211', '', 'Fergusson College', 'B.Com', 'Sai PG', '15/07/2026', '', '', '', '', ''],
];

function downloadSample() {
  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const csv = [STUDENT_CSV_COLUMNS, ...SAMPLE_ROWS].map((row) => row.map(escape).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: 'students-sample.csv' });
  link.click();
  URL.revokeObjectURL(url);
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-control border border-border p-3">
      <p className={`text-2xl font-bold ${tone}`}>{value}</p>
      <p className="text-sm text-ink-muted">{label}</p>
    </div>
  );
}

function ImportStudents() {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<StudentImportResult | null>(null);

  const pick = (picked: File | undefined) => {
    setResult(null);
    setFileError(null);
    if (!picked) return setFile(null);
    if (!picked.name.toLowerCase().endsWith('.csv')) return setFileError('Choose a .csv file. In Excel use "Save as → CSV".');
    if (picked.size > STUDENT_IMPORT_LIMITS.maxBytes) return setFileError('This file is larger than 1 MB.');
    setFile(picked);
  };

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    setFileError(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await api<StudentImportResult>('/students/import', { method: 'POST', body });
      setResult(res);
      if (res.imported) toast.success(`${res.imported} ${res.imported === 1 ? 'student' : 'students'} imported`);
    } catch (error) {
      setFileError(errorMessage(error));
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setFile(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <>
      <Link href="/students" className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> All students
      </Link>
      <PageHeader title="Import students" description="Add many students at once from a CSV file." />

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader title="File format" />
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-ink-muted">
            <li>First row must be the column names.</li>
            <li>
              Required: <strong className="text-ink">{STUDENT_CSV_REQUIRED.join(', ')}</strong>.
            </li>
            <li>joiningDate as YYYY-MM-DD or DD/MM/YYYY. Leave it blank to use today.</li>
            <li>Students already in your list are skipped, not duplicated.</li>
            <li>Up to {STUDENT_IMPORT_LIMITS.maxRows} students and 1 MB per file.</li>
          </ul>
          <p className="mt-4 text-sm font-medium">Columns</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {STUDENT_CSV_COLUMNS.map((c) => (
              <Badge key={c} tone={STUDENT_CSV_REQUIRED.includes(c) ? 'brand' : 'neutral'}>{c}</Badge>
            ))}
          </div>
          <Button variant="secondary" className="mt-5" onClick={downloadSample}>
            <Download className="size-4" aria-hidden /> Download sample CSV
          </Button>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader title="Upload" />
          <label
            htmlFor="csv-file"
            className="flex cursor-pointer flex-col items-center gap-2 rounded-card border-2 border-dashed border-border px-4 py-8 text-center hover:border-brand-500 hover:bg-brand-50"
          >
            <FileSpreadsheet className="size-8 text-brand-600" aria-hidden />
            <span className="font-semibold">{file ? file.name : 'Choose CSV file'}</span>
            <span className="text-sm text-ink-muted">{file ? `${(file.size / 1024).toFixed(1)} KB` : 'Tap to browse'}</span>
          </label>
          <input
            ref={inputRef}
            id="csv-file"
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => pick(e.target.files?.[0])}
          />
          {fileError && <Alert tone="danger" className="mt-4">{fileError}</Alert>}
          <Button size="lg" fullWidth className="mt-4" disabled={!file || !!result} loading={uploading} onClick={upload}>
            {uploading ? 'Importing…' : 'Import students'}
          </Button>
        </Card>
      </div>

      {result && (
        <Card className="mt-4">
          <CardHeader
            title="Import result"
            action={
              <Button variant="ghost" size="sm" onClick={reset}>
                Import another file
              </Button>
            }
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Rows in file" value={result.total} tone="text-ink" />
            <Stat label="Imported" value={result.imported} tone="text-success" />
            <Stat label="Skipped" value={result.skipped} tone="text-warning" />
            <Stat label="Failed" value={result.failed} tone="text-danger" />
          </div>

          {result.issues.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-sm font-medium">Rows that were not imported</p>
              <div className="max-h-96 overflow-auto rounded-control border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-canvas text-ink-muted">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">Row</th>
                      <th scope="col" className="px-3 py-2 font-medium">Result</th>
                      <th scope="col" className="px-3 py-2 font-medium">Column</th>
                      <th scope="col" className="px-3 py-2 font-medium">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {result.issues.map((issue) => (
                      <tr key={`${issue.row}-${issue.field}`}>
                        <td className="px-3 py-2 font-medium">{issue.row}</td>
                        <td className="px-3 py-2">
                          <Badge tone={issue.kind === 'failed' ? 'danger' : 'warning'}>{issue.kind === 'failed' ? 'Failed' : 'Skipped'}</Badge>
                        </td>
                        <td className="px-3 py-2 text-ink-muted">{issue.field ?? '—'}</td>
                        <td className="px-3 py-2">{issue.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-ink-muted">Fix the failed rows in your file and import it again — imported students will be skipped automatically.</p>
            </div>
          )}

          {result.imported > 0 && (
            <Link href="/students" className="mt-5 inline-flex font-semibold text-brand-700 hover:underline">
              View students →
            </Link>
          )}
        </Card>
      )}
    </>
  );
}

export default function ImportStudentsPage() {
  return (
    <RequireAuth permission={Permission.STUDENT_IMPORT}>
      <ImportStudents />
    </RequireAuth>
  );
}
