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
  canViewPhotos: boolean;
  canEditPhotos: boolean;
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
  get canViewPhotos(): boolean { return this.props.canViewPhotos; }
  get canEditPhotos(): boolean { return this.props.canEditPhotos; }
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
    canViewPhotos: boolean;
    canEditPhotos: boolean;
  }): void {
    this.props.canViewVetVisits = perms.canViewVetVisits;
    this.props.canEditVetVisits = perms.canEditVetVisits;
    this.props.canViewMedications = perms.canViewMedications;
    this.props.canEditMedications = perms.canEditMedications;
    this.props.canViewNotes = perms.canViewNotes;
    this.props.canEditNotes = perms.canEditNotes;
    this.props.canViewPhotos = perms.canViewPhotos;
    this.props.canEditPhotos = perms.canEditPhotos;
  }

  hasPermission(permission: PetPermission): boolean {
    if (this.props.status !== 'accepted') return false;
    if (permission === 'owner') return false;
    if (permission === 'view_pet') return true;
    if (permission === 'view_vet_visits') return this.props.canViewVetVisits || this.props.canEditVetVisits;
    if (permission === 'edit_vet_visits') return this.props.canEditVetVisits;
    if (permission === 'view_medications') return this.props.canViewMedications || this.props.canEditMedications;
    if (permission === 'edit_medications') return this.props.canEditMedications;
    if (permission === 'view_notes') return this.props.canViewNotes || this.props.canEditNotes;
    if (permission === 'edit_notes') return this.props.canEditNotes;
    if (permission === 'view_photos') return this.props.canViewPhotos || this.props.canEditPhotos;
    if (permission === 'edit_photos') return this.props.canEditPhotos;
    return false;
  }

  static create(
    props: Omit<PetShareProps, 'createdAt' | 'status' | 'canViewPhotos' | 'canEditPhotos'> & { canViewPhotos?: boolean; canEditPhotos?: boolean },
    id?: UniqueEntityId,
  ): PetShare {
    return new PetShare({
      canViewPhotos: false,
      canEditPhotos: false,
      ...props,
      status: 'pending',
      createdAt: new Date(),
    }, id);
  }

  static reconstitute(props: PetShareProps, id: UniqueEntityId): PetShare {
    return new PetShare(props, id);
  }
}
