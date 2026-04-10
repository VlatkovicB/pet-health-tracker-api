import { ValueObject } from '../../shared/ValueObject';

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

interface SeverityProps {
  level: SeverityLevel;
}

export class Severity extends ValueObject<SeverityProps> {
  get level(): SeverityLevel {
    return this.props.level;
  }

  static create(level: SeverityLevel): Severity {
    const valid: SeverityLevel[] = ['low', 'medium', 'high', 'critical'];
    if (!valid.includes(level)) throw new Error(`Invalid severity level: ${level}`);
    return new Severity({ level });
  }
}
