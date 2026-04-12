import { ValueObject } from '../../shared/ValueObject';

export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

const DAY_CRON: Record<DayOfWeek, number> = {
  SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
};

export type DailySchedule   = { type: 'daily';   times: string[] };
export type WeeklySchedule  = { type: 'weekly';  days: DayOfWeek[];     times: string[] };
export type MonthlySchedule = { type: 'monthly'; daysOfMonth: number[]; times: string[] };

export type ReminderScheduleProps = DailySchedule | WeeklySchedule | MonthlySchedule;

function validateTimes(times: string[]): void {
  // Deduplicate times to prevent duplicate schedulers
  const uniqueTimes = Array.from(new Set(times));
  if (!uniqueTimes.length) throw new Error('times must not be empty');
  for (const t of uniqueTimes) {
    if (!/^\d{2}:\d{2}$/.test(t)) throw new Error(`Invalid time format: ${t}`);
    const [h, m] = t.split(':').map(Number);
    if (h < 0 || h > 23) throw new Error(`Invalid hour: ${h}`);
    if (m < 0 || m > 59) throw new Error(`Invalid minute: ${m}`);
  }
}

export class ReminderSchedule extends ValueObject<ReminderScheduleProps> {
  get type(): 'daily' | 'weekly' | 'monthly' { return this.props.type; }
  get times(): string[] { return this.props.times; }

  get days(): DayOfWeek[] | undefined {
    return this.props.type === 'weekly' ? this.props.days : undefined;
  }

  get daysOfMonth(): number[] | undefined {
    return this.props.type === 'monthly' ? this.props.daysOfMonth : undefined;
  }

  toJSON(): ReminderScheduleProps {
    return { ...this.props } as ReminderScheduleProps;
  }

  toCronExpressions(): string[] {
    const p = this.props;
    switch (p.type) {
      case 'daily':
        return p.times.map((t) => {
          const [h, m] = t.split(':');
          return `${Number(m)} ${Number(h)} * * *`;
        });
      case 'weekly': {
        const dayPart = p.days.map((d) => DAY_CRON[d]).join(',');
        return p.times.map((t) => {
          const [h, m] = t.split(':');
          return `${Number(m)} ${Number(h)} * * ${dayPart}`;
        });
      }
      case 'monthly': {
        const domPart = p.daysOfMonth.join(',');
        return p.times.map((t) => {
          const [h, m] = t.split(':');
          return `${Number(m)} ${Number(h)} ${domPart} * *`;
        });
      }
      default:
        throw new Error(`Unknown schedule type: ${(p as any).type}`);
    }
  }

  static create(props: ReminderScheduleProps): ReminderSchedule {
    validateTimes(props.times);
    if (props.type === 'weekly') {
      if (!props.days.length) throw new Error('weekly schedule requires at least one day');
    }
    if (props.type === 'monthly') {
      if (!props.daysOfMonth.length) throw new Error('monthly schedule requires at least one day of month');
      for (const d of props.daysOfMonth) {
        if (d < 1 || d > 31) throw new Error(`Invalid day of month: ${d}`);
      }
    }
    return new ReminderSchedule(props);
  }
}
