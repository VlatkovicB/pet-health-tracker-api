import { AggregateRoot } from '../shared/AggregateRoot';
import { UniqueEntityId } from '../shared/UniqueEntityId';
import { PetPermission } from './PetPermission';

interface PetShareProps {
  petId: string;
  ownerId: string;
  sharedWithUserId: string | null;
  invitedEmail: string;
  status: 'pending' | 'accepted';
  canViewVetVisits: boolean;
  canEditVetVisits: boolean;
  canViewMedications: boolean;
  canEditMedications: boolean;
  canViewNotes: boolean;
  canEditNotes: boolean;
  createdAt: Date;
}

export class PetShare extends AggregateRoot<PetShareProps> {
  get petId(): string { return this.props.petId; }
  get ownerId(): string { return this.props.ownerId; }
  get sharedWithUserId(): string | null { return this.props.sharedWithUserId; }
  get invitedEmail(): string { return this.props.invitedEmail; }
  get status(): 'pending' | 'accepted' { return this.props.status; }
  get canViewVetVisits(): boolean { return this.props.canViewVetVisits; }
  get canEditVetVisits(): boolean { return this.props.canEditVetVisits; }
  get canViewMedications(): boolean { return this.props.canViewMedications; }
  get canEditMedications(): boolean { return this.props.canEditMedications; }
  get canViewNotes(): boolean { return this.props.canViewNotes; }
  get canEditNotes(): boolean { return this.props.canEditNotes; }
  get createdAt(): Date { return this.props.createdAt; }

  accept(): void { this.props.status = 'accepted'; }

  linkUser(userId: string): void { this.props.sharedWithUserId = userId; }

  updatePermissions(perms: {
    canViewVetVisits: boolean;
    canEditVetVisits: boolean;
    canViewMedications: boolean;
    canEditMedications: boolean;
    canViewNotes: boolean;
    canEditNotes: boolean;
  }): void {
    this.props.canViewVetVisits = perms.canViewVetVisits;
    this.props.canEditVetVisits = perms.canEditVetVisits;
    this.props.canViewMedications = perms.canViewMedications;
    this.props.canEditMedications = perms.canEditMedications;
    this.props.canViewNotes = perms.canViewNotes;
    this.props.canEditNotes = perms.canEditNotes;
  }

  hasPermission(permission: PetPermission): boolean {
    if (permission === 'owner') return false;
    if (permission === 'view_pet') return true;
    if (permission === 'view_vet_visits') return this.props.canViewVetVisits || this.props.canEditVetVisits;
    if (permission === 'edit_vet_visits') return this.props.canEditVetVisits;
    if (permission === 'view_medications') return this.props.canViewMedications || this.props.canEditMedications;
    if (permission === 'edit_medications') return this.props.canEditMedications;
    if (permission === 'view_notes') return this.props.canViewNotes || this.props.canEditNotes;
    if (permission === 'edit_notes') return this.props.canEditNotes;
    return false;
  }

  static create(
    props: Omit<PetShareProps, 'createdAt' | 'status'>,
    id?: UniqueEntityId,
  ): PetShare {
    return new PetShare({ ...props, status: 'pending', createdAt: new Date() }, id);
  }

  static reconstitute(props: PetShareProps, id: UniqueEntityId): PetShare {
    return new PetShare(props, id);
  }
}
