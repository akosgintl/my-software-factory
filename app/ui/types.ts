export type ReminderState = 'unscheduled' | 'active' | 'completed';

export type Reminder = {
  id: string;
  n: number;
  text: string;
  state: ReminderState;
  tz: string | null;
  rule: string | null;
  ruleText: string;
  ruleLabel: string;
  ruleDetail: string;
  nextDue: string | null;
  nextLocal: string | null;
  pending: { occurrence: string; run: string | null; markedAt: string | null; uncertain: boolean } | null;
  lastDelivered: string | null;
  ackedAt: string | null;
  destination: string;
  destinationText: string;
  rev: number;
  createdAt: string;
  updatedAt: string;
};

export type Snapshot = {
  reminders: Reminder[];
  defaultTimezone: string | null;
  nextId: string;
  now: string;
  pollSeconds: number;
  isolated: boolean;
};

export type FormValues = {
  text: string;
  kind: 'none' | 'once' | 'daily' | 'weekly' | 'monthly' | 'every';
  date: string;
  time: string;
  days: string[];
  dayOfMonth: string;
  everyN: string;
  everyUnit: 'm' | 'h' | 'd';
  from: string;
  tz: string;
};

export type ApiError = {
  code: string;
  message: string;
  field: string | null;
  fields: Record<string, string> | null;
  current: Reminder | null;
  incomplete?: boolean;
};

export type Preview = { tz: string; rule: string; next: string; local: string; note: string; ruleLabel: string };
