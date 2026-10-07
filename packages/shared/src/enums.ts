export const UserStatus = {
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const MessStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const;
export type MessStatus = (typeof MessStatus)[keyof typeof MessStatus];

export const MembershipStatus = {
  ACTIVE: 'ACTIVE',
  INVITED: 'INVITED',
  REMOVED: 'REMOVED',
} as const;
export type MembershipStatus = (typeof MembershipStatus)[keyof typeof MembershipStatus];

export const MessType = {
  STUDENT_MESS: 'STUDENT_MESS',
  PG_HOSTEL: 'PG_HOSTEL',
  TIFFIN_SERVICE: 'TIFFIN_SERVICE',
  OTHER: 'OTHER',
} as const;
export type MessType = (typeof MessType)[keyof typeof MessType];

export const MESS_TYPE_LABELS: Record<MessType, string> = {
  STUDENT_MESS: 'Student mess',
  PG_HOSTEL: 'PG / Hostel mess',
  TIFFIN_SERVICE: 'Tiffin / meal service',
  OTHER: 'Other',
};

export const FoodType = {
  VEG: 'VEG',
  VEG_NON_VEG: 'VEG_NON_VEG',
} as const;
export type FoodType = (typeof FoodType)[keyof typeof FoodType];

export const FOOD_TYPE_LABELS: Record<FoodType, string> = {
  VEG: 'Veg only',
  VEG_NON_VEG: 'Veg + Non-veg',
};

export const ClientType = {
  WEB: 'WEB',
  MOBILE: 'MOBILE',
} as const;
export type ClientType = (typeof ClientType)[keyof typeof ClientType];

/** Header used by clients to identify themselves (mobile receives refresh tokens in the body). */
export const CLIENT_HEADER = 'x-client-type';
