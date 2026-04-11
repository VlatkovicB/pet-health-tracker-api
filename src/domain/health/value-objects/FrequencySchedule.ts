import { ValueObject } from '../../shared/ValueObject';

export type FrequencyType = 'hourly' | 'daily' | 'weekly' | 'monthly';

interface FrequencyScheduleProps {
  type: FrequencyType;
  interval: number;
}

const MS_PER_HOUR = 60 * 60 * 1000;

export class FrequencySchedule extends ValueObject<FrequencyScheduleProps> {
  get type(): FrequencyType { return this.props.type; }
  get interval(): number { return this.props.interval; }

  toMilliseconds(): number {
    switch (this.props.type) {
      case 'hourly':  return this.props.interval * MS_PER_HOUR;
      case 'daily':   return this.props.interval * 24 * MS_PER_HOUR;
      case 'weekly':  return this.props.interval * 7 * 24 * MS_PER_HOUR;
      case 'monthly': return this.props.interval * 30 * 24 * MS_PER_HOUR;
    }
  }

  toLabel(): string {
    const n = this.props.interval;
    switch (this.props.type) {
      case 'hourly':  return n === 1 ? 'Every hour' : `Every ${n} hours`;
      case 'daily':   return n === 1 ? 'Once daily' : n === 2 ? 'Twice daily' : `${n} times daily`;
      case 'weekly':  return n === 1 ? 'Once a week' : `Every ${n} weeks`;
      case 'monthly': return n === 1 ? 'Once a month' : `Every ${n} months`;
    }
  }

  static create(props: FrequencyScheduleProps): FrequencySchedule {
    if (!Number.isInteger(props.interval) || props.interval < 1) {
      throw new Error('FrequencySchedule interval must be a positive integer');
    }
    return new FrequencySchedule(props);
  }
}
