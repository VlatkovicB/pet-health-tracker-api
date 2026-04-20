import { ValueObject } from '../../shared/ValueObject';
import { ValidationError } from '../../../shared/errors/AppError';

export interface AdvanceNotice {
  amount: number;
  unit: 'minutes' | 'hours' | 'days';
}

export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

const DAY_CRON: Record<DayOfWeek, number> = {
  SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
};

export type DailySchedule   = { type: 'daily';   times: string[] };
export type WeeklySchedule  = { type: 'weekly';  days: DayOfWeek[];     times: string[] };
export type MonthlySchedule = { type: 'monthly'; daysOfMonth: number[]; times: string[] };

export type ReminderScheduleProps = DailySchedule | WeeklySchedule | MonthlySchedule;

function validateTimes(times: string[]): void {
  const uniqueTimes = Array.from(new Set(times));
  if (!uniqueTimes.length) throw new ValidationError('times must not be empty');
  for (const t of uniqueTimes) {
    if (!/^\d{2}:\d{2}$/.test(t)) throw new ValidationError(`Invalid time format: ${t}`);
    const [h, m] = t.split(':').map(Number);
    if (h < 0 || h > 23) throw new ValidationError(`Invalid hour: ${h}`);
    if (m < 0 || m > 59) throw new ValidationError(`Invalid minute: ${m}`);
  }
}

/** Subtract advanceNotice from a HH:MM time string. Returns { time: 'HH:MM', dayOffset: -1 | 0 }. */
function applyOffset(time: string, notice: AdvanceNotice): { time: string; dayOffset: number } {
  const [h, m] = time.split(':').map(Number);
  let totalMinutes = h * 60 + m;

  switch (notice.unit) {
    case 'minutes': totalMinutes -= notice.amount; break;
    case 'hours':   totalMinutes -= notice.amount * 60; break;
    case 'days':    totalMinutes -= notice.amount * 24 * 60; break;
  }

  let dayOffset = 0;
  if (totalMinutes < 0) {
    dayOffset = -1;
    totalMinutes += 24 * 60;
  }

  const hh = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const mm = String(totalMinutes % 60).padStart(2, '0');
  return { time: `${hh}:${mm}`, dayOffset };
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

  toCronExpressions(advanceNotice?: AdvanceNotice): string[] {
    const p = this.props;

    if (!advanceNotice) {
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
          throw new ValidationError(`Unknown schedule type: ${(p as any).type}`);
      }
    }

    switch (p.type) {
      case 'daily':
        return p.times.map((t) => {
          const { time } = applyOffset(t, advanceNotice);
          const [h, m] = time.split(':');
          return `${Number(m)} ${Number(h)} * * *`;
        });
      case 'weekly': {
        const days = p.days.map((d) => DAY_CRON[d]);
        return p.times.map((t) => {
          const { time, dayOffset } = applyOffset(t, advanceNotice);
          const [h, m] = time.split(':');
          const adjustedDays = dayOffset === 0
            ? days
            : days.map((d) => ((d + 7 + dayOffset) % 7));
          return `${Number(m)} ${Number(h)} * * ${adjustedDays.join(',')}`;
        });
      }
      case 'monthly': {
        return p.times.map((t) => {
          const { time, dayOffset } = applyOffset(t, advanceNotice);
          const [h, m] = time.split(':');
          const domPart = dayOffset === 0
            ? p.daysOfMonth.join(',')
            : p.daysOfMonth.map((d) => Math.max(1, d + dayOffset)).join(',');
          return `${Number(m)} ${Number(h)} ${domPart} * *`;
        });
      }
      default:
        throw new ValidationError(`Unknown schedule type: ${(p as any).type}`);
    }
  }

  static create(props: ReminderScheduleProps): ReminderSchedule {
    validateTimes(props.times);
    if (props.type === 'weekly') {
      if (!props.days.length) throw new ValidationError('weekly schedule requires at least one day');
    }
    if (props.type === 'monthly') {
      if (!props.daysOfMonth.length) throw new ValidationError('monthly schedule requires at least one day of month');
      for (const d of props.daysOfMonth) {
        if (d < 1 || d > 31) throw new ValidationError(`Invalid day of month: ${d}`);
      }
    }
    return new ReminderSchedule(props);
  }
}
