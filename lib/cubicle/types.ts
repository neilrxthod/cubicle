export type CartStatus = "ready" | "maintenance" | "offline";

export type BookingStatus = "confirmed" | "cancelled";

export type IssueStatus = "open" | "in_progress" | "resolved";

export type IssueSeverity = "low" | "medium" | "high";

export type PeriodId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type Cart = {
  id: string;
  name: string;
  location: string;
  laptopCount: number;
  status: CartStatus;
  notes?: string;
};

export type Period = {
  id: PeriodId;
  label: string;
  start: string;
  end: string;
};

export type Booking = {
  id: string;
  cartId: string;
  date: string; // YYYY-MM-DD
  periodId: PeriodId;
  teacherEmail: string;
  teacherName: string;
  className: string;
  room: string;
  status: BookingStatus;
  createdAt: string;
};

export type Issue = {
  id: string;
  cartId: string;
  reportedByEmail: string;
  reportedByName: string;
  title: string;
  description: string;
  severity: IssueSeverity;
  status: IssueStatus;
  createdAt: string;
  updatedAt: string;
};

export type CubicleState = {
  carts: Cart[];
  bookings: Booking[];
  issues: Issue[];
  version: number;
};
