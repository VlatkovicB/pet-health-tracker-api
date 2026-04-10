import { ValueObject } from '../../shared/ValueObject';

type DosageUnit = 'mg' | 'ml' | 'g' | 'tablet' | 'drop' | 'unit';

interface DosageProps {
  amount: number;
  unit: DosageUnit;
}

export class Dosage extends ValueObject<DosageProps> {
  get amount(): number {
    return this.props.amount;
  }

  get unit(): DosageUnit {
    return this.props.unit;
  }

  toString(): string {
    return `${this.props.amount} ${this.props.unit}`;
  }

  static create(amount: number, unit: DosageUnit): Dosage {
    if (amount <= 0) throw new Error('Dosage amount must be positive');
    return new Dosage({ amount, unit });
  }
}
