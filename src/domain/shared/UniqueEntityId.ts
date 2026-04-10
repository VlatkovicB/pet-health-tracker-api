import { v4 as uuidv4 } from 'uuid';

export class UniqueEntityId {
  private readonly value: string;

  constructor(id?: string) {
    this.value = id ?? uuidv4();
  }

  toString(): string {
    return this.value;
  }

  toValue(): string {
    return this.value;
  }

  equals(id?: UniqueEntityId): boolean {
    if (!id) return false;
    return this.value === id.value;
  }
}
