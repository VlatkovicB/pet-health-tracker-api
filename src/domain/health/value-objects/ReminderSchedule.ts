import { ValueObject } from '../../shared/ValueObject';

export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

const DAY_CRON_MAP: Record<DayOfWeek, number> = {
  SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
};

interface ReminderScheduleProps {
  /** Fixed times of day, e.g. ["08:00", "20:00"]. Mutually exclusive with intervalHours. */
  times?: string[];
  /** Repeat every N hours, e.g. 8. Mutually exclusive with times. */
  intervalHours?: number;
  /** Restrict to specific days. If omitted, runs every day. */
  days?: DayOfWeek[];
  timezone: string;
}

export class ReminderSchedule extends ValueObject<ReminderScheduleProps> {
  get times(): string[] | undefined {
    return this.props.times;
  }

  get intervalHours(): number | undefined {
    return this.props.intervalHours;
  }

  get days(): DayOfWeek[] | undefined {
    return this.props.days;
  }

  get timezone(): string {
    return this.props.timezone;
  }

  /** Returns one cron expression per trigger point */
  toCronExpressions(): string[] {
    const dayPart = this.props.days
      ? this.props.days.map((d) => DAY_CRON_MAP[d]).join(',')
      : '*';

    if (this.props.intervalHours) {
      return [`0 */${this.props.intervalHours} * * ${dayPart}`];
    }

    if (this.props.times && this.props.times.length > 0) {
      return this.props.times.map((time) => {
        const [hour, minute] = time.split(':');
        return `${minute} ${hour} * * ${dayPart}`;
      });
    }

    throw new Error('ReminderSchedule must have either times or intervalHours');
  }

  static create(props: ReminderScheduleProps): ReminderSchedule {
    if (!props.times?.length && !props.intervalHours) {
      throw new Error('ReminderSchedule requires times or intervalHours');
    }
    if (props.times?.length && props.intervalHours) {
      throw new Error('ReminderSchedule cannot have both times and intervalHours');
    }
    if (!props.timezone) {
      throw new Error('ReminderSchedule requires a timezone');
    }
    return new ReminderSchedule(props);
  }
}
