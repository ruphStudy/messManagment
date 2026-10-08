import type { PaginationQuery } from './api';
import type { MealType } from './attendance';
import { addDays } from './meal-plans';

export const FeedbackType = { MEAL: 'MEAL', GENERAL: 'GENERAL' } as const;
export type FeedbackType = (typeof FeedbackType)[keyof typeof FeedbackType];

/** Every rating everywhere is a whole number 1–5. */
export const RATING_MIN = 1;
export const RATING_MAX = 5;
export const RATING_DIMENSIONS = ['overall', 'taste', 'quality', 'quantity', 'cleanliness'] as const;
export type RatingDimension = (typeof RATING_DIMENSIONS)[number];
export const RATING_LABELS: Record<RatingDimension, string> = {
  overall: 'Overall',
  taste: 'Taste',
  quality: 'Quality',
  quantity: 'Quantity',
  cleanliness: 'Cleanliness',
};

/** A served meal can be rated within this many days. */
export const FEEDBACK_WINDOW_DAYS = 7;

export const FEEDBACK_LIMITS = { commentMax: 1000, complaintMax: 1000, responseMax: 1000 } as const;

/** Complaint photos: one image, ≤ 5 MB, JPEG/PNG/WebP. */
export const ATTACHMENT_LIMITS = { maxBytes: 5 * 1024 * 1024, mimeTypes: ['image/jpeg', 'image/png', 'image/webp'] as const } as const;

/** The single feedback-window rule. */
export function isFeedbackWindowOpen(mealDate: string, today: string): boolean {
  return mealDate <= today && mealDate >= addDays(today, -FEEDBACK_WINDOW_DAYS);
}

export interface Ratings {
  overallRating: number;
  tasteRating: number | null;
  qualityRating: number | null;
  quantityRating: number | null;
  cleanlinessRating: number | null;
}

export interface EligibleMeal {
  attendanceId: string;
  date: string;
  mealType: MealType;
  planName: string;
}

export interface MealFeedbackRequest extends Partial<Omit<Ratings, 'overallRating'>> {
  attendanceId: string;
  overallRating: number;
  comment?: string;
}

/** Either a rating or a comment is required. */
export interface GeneralFeedbackRequest {
  overallRating?: number;
  comment?: string;
}

export interface FeedbackItem {
  id: string;
  type: FeedbackType;
  date: string;
  mealType: MealType | null;
  overallRating: number | null;
  tasteRating: number | null;
  qualityRating: number | null;
  quantityRating: number | null;
  cleanlinessRating: number | null;
  comment: string | null;
  createdAt: string;
  /** The rated meal was later reversed; kept for history, excluded from averages. */
  mealReversed: boolean;
  student: { id: string; firstName: string; lastName: string | null; mobile: string };
}

export type StudentFeedbackItem = Omit<FeedbackItem, 'student' | 'mealReversed'>;

export interface FeedbackListQuery extends PaginationQuery {
  type?: FeedbackType;
  from?: string;
  to?: string;
  mealType?: MealType;
  /** Exact overall rating 1–5. */
  rating?: number;
  search?: string;
}

/** Averages (one decimal) of meal feedback; null when there is nothing to average. */
export interface RatingSummary {
  from: string;
  to: string;
  mealCount: number;
  averages: Record<RatingDimension, number | null>;
  generalCount: number;
  generalAverage: number | null;
}

// ── Complaints ──

export const ComplaintCategory = {
  FOOD_QUALITY: 'FOOD_QUALITY',
  QUANTITY: 'QUANTITY',
  CLEANLINESS: 'CLEANLINESS',
  WRONG_OR_MISSING_ITEM: 'WRONG_OR_MISSING_ITEM',
  STAFF_BEHAVIOUR: 'STAFF_BEHAVIOUR',
  PAYMENT: 'PAYMENT',
  QR_ATTENDANCE: 'QR_ATTENDANCE',
  MENU: 'MENU',
  OTHER: 'OTHER',
} as const;
export type ComplaintCategory = (typeof ComplaintCategory)[keyof typeof ComplaintCategory];

export const COMPLAINT_CATEGORY_LABELS: Record<ComplaintCategory, string> = {
  FOOD_QUALITY: 'Food quality',
  QUANTITY: 'Quantity',
  CLEANLINESS: 'Cleanliness',
  WRONG_OR_MISSING_ITEM: 'Wrong or missing item',
  STAFF_BEHAVIOUR: 'Staff behaviour',
  PAYMENT: 'Payment',
  QR_ATTENDANCE: 'QR / attendance',
  MENU: 'Menu',
  OTHER: 'Other',
};

export const ComplaintStatus = { OPEN: 'OPEN', IN_PROGRESS: 'IN_PROGRESS', RESOLVED: 'RESOLVED' } as const;
export type ComplaintStatus = (typeof ComplaintStatus)[keyof typeof ComplaintStatus];

export const COMPLAINT_STATUS_LABELS: Record<ComplaintStatus, string> = { OPEN: 'Open', IN_PROGRESS: 'In progress', RESOLVED: 'Resolved' };

/** The single complaint workflow. Resolved is final in the MVP. */
export const COMPLAINT_TRANSITIONS: Record<ComplaintStatus, readonly ComplaintStatus[]> = {
  OPEN: [ComplaintStatus.IN_PROGRESS, ComplaintStatus.RESOLVED],
  IN_PROGRESS: [ComplaintStatus.RESOLVED],
  RESOLVED: [],
};

export function canTransition(from: ComplaintStatus, to: ComplaintStatus): boolean {
  return COMPLAINT_TRANSITIONS[from].includes(to);
}

export const MessageAuthor = { STUDENT: 'STUDENT', MESS: 'MESS' } as const;
export type MessageAuthor = (typeof MessageAuthor)[keyof typeof MessageAuthor];

export interface ComplaintMessage {
  id: string;
  author: MessageAuthor;
  authorName: string | null;
  message: string;
  createdAt: string;
}

export interface CreateComplaintRequest {
  category: ComplaintCategory;
  description: string;
  /** From the photo upload endpoint. */
  attachmentId?: string;
  /** Same key on a retried submit returns the first complaint. */
  idempotencyKey?: string;
}

export interface ComplaintSummaryItem {
  id: string;
  category: ComplaintCategory;
  description: string;
  status: ComplaintStatus;
  hasAttachment: boolean;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  responseCount: number;
  lastResponseAt: string | null;
}

export interface ComplaintListItem extends ComplaintSummaryItem {
  student: { id: string; firstName: string; lastName: string | null; mobile: string };
}

export interface ComplaintDetail extends ComplaintListItem {
  /** Fetch with auth from /files/:id. */
  attachmentId: string | null;
  inProgressAt: string | null;
  resolvedBy: string | null;
  messages: ComplaintMessage[];
}

export type StudentComplaintDetail = Omit<ComplaintDetail, 'student'>;

export interface ComplaintListQuery extends PaginationQuery {
  status?: ComplaintStatus;
  category?: ComplaintCategory;
  from?: string;
  to?: string;
  search?: string;
}

export interface ComplaintCounts {
  OPEN: number;
  IN_PROGRESS: number;
  RESOLVED: number;
}

export interface UploadedFile {
  id: string;
  mimeType: string;
  sizeBytes: number;
}
