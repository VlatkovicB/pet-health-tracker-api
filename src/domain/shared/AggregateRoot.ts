import { Entity } from './Entity';
import { UniqueEntityId } from './UniqueEntityId';

export abstract class AggregateRoot<T> extends Entity<T> {
  constructor(props: T, id?: UniqueEntityId) {
    super(props, id);
  }
}
