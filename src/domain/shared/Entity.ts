import { UniqueEntityId } from './UniqueEntityId';

export abstract class Entity<T> {
  protected readonly _id: UniqueEntityId;
  protected props: T;

  constructor(props: T, id?: UniqueEntityId) {
    this._id = id ?? new UniqueEntityId();
    this.props = props;
  }

  get id(): UniqueEntityId {
    return this._id;
  }

  equals(entity?: Entity<T>): boolean {
    if (!entity) return false;
    if (!(entity instanceof Entity)) return false;
    return this._id.equals(entity._id);
  }
}
