import { AggregateRoot } from '../shared/AggregateRoot';
import { UniqueEntityId } from '../shared/UniqueEntityId';

export type TransferStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';

interface PetOwnershipTransferProps {
  petId: string;
  fromUserId: string;
  toUserId: string | null;
  invitedEmail: string;
  status: TransferStatus;
  expiresAt: Date;
  createdAt: Date;
}

export class PetOwnershipTransfer extends AggregateRoot<PetOwnershipTransferProps> {
  get petId(): string {
    return this.props.petId;
  }

  get fromUserId(): string {
    return this.props.fromUserId;
  }

  get toUserId(): string | null {
    return this.props.toUserId;
  }

  get invitedEmail(): string {
    return this.props.invitedEmail;
  }

  get status(): TransferStatus {
    return this.props.status;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  cancel(): void {
    this.props.status = 'cancelled';
  }

  expire(): void {
    this.props.status = 'expired';
  }

  accept(): void {
    this.props.status = 'accepted';
  }

  decline(): void {
    this.props.status = 'declined';
  }

  linkRecipient(userId: string): void {
    this.props.toUserId = userId;
  }

  static create(
    props: Omit<PetOwnershipTransferProps, 'createdAt' | 'status' | 'expiresAt'>,
    id?: UniqueEntityId,
  ): PetOwnershipTransfer {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return new PetOwnershipTransfer(
      { ...props, status: 'pending', expiresAt, createdAt: new Date() },
      id,
    );
  }

  static reconstitute(
    props: PetOwnershipTransferProps,
    id: UniqueEntityId,
  ): PetOwnershipTransfer {
    return new PetOwnershipTransfer(props, id);
  }
}
