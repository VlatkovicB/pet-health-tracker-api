import { Service } from 'typedi';
import { PetShareModel } from '../db/models/PetShareModel';
import { PetShare } from '../../domain/share/PetShare';
import { PetShareDetails } from '../../domain/share/PetShareDetails';
import { UniqueEntityId } from '../../domain/shared/UniqueEntityId';

export interface SharePermissionsDto {
  canViewVetVisits: boolean;
  canEditVetVisits: boolean;
  canViewMedications: boolean;
  canEditMedications: boolean;
  canViewNotes: boolean;
  canEditNotes: boolean;
}

export interface PetShareResponseDto {
  id: string;
  petId: string;
  petName: string;
  petSpecies: string;
  sharedByEmail: string;
  status: 'pending' | 'accepted';
  permissions: SharePermissionsDto;
  createdAt: string;
}

export interface PetShareOwnerResponseDto {
  id: string;
  petId: string;
  invitedEmail: string;
  status: 'pending' | 'accepted';
  permissions: SharePermissionsDto;
  createdAt: string;
}

@Service()
export class PetShareMapper {
  toDomain(model: PetShareModel): PetShare {
    return PetShare.reconstitute(
      {
        petId: model.petId,
        ownerId: model.ownerId,
        sharedWithUserId: model.sharedWithUserId,
        invitedEmail: model.invitedEmail,
        status: (() => {
          if (model.status !== 'pending' && model.status !== 'accepted') {
            throw new Error(`Invalid PetShare status from DB: ${model.status}`);
          }
          return model.status;
        })(),
        canViewVetVisits: model.canViewVetVisits,
        canEditVetVisits: model.canEditVetVisits,
        canViewMedications: model.canViewMedications,
        canEditMedications: model.canEditMedications,
        canViewNotes: model.canViewNotes,
        canEditNotes: model.canEditNotes,
        createdAt: model.createdAt,
      },
      new UniqueEntityId(model.id),
    );
  }

  toPersistence(share: PetShare): object {
    return {
      id: share.id.toValue(),
      petId: share.petId,
      ownerId: share.ownerId,
      sharedWithUserId: share.sharedWithUserId,
      invitedEmail: share.invitedEmail,
      status: share.status,
      canViewVetVisits: share.canViewVetVisits,
      canEditVetVisits: share.canEditVetVisits,
      canViewMedications: share.canViewMedications,
      canEditMedications: share.canEditMedications,
      canViewNotes: share.canViewNotes,
      canEditNotes: share.canEditNotes,
      createdAt: share.createdAt,
    };
  }

  toResponse(details: PetShareDetails): PetShareResponseDto {
    return {
      id: details.id,
      petId: details.petId,
      petName: details.petName,
      petSpecies: details.petSpecies,
      sharedByEmail: details.sharedByEmail,
      status: details.status,
      permissions: details.permissions,
      createdAt: details.createdAt.toISOString(),
    };
  }

  toOwnerResponse(share: PetShare): PetShareOwnerResponseDto {
    return {
      id: share.id.toValue(),
      petId: share.petId,
      invitedEmail: share.invitedEmail,
      status: share.status,
      permissions: {
        canViewVetVisits: share.canViewVetVisits,
        canEditVetVisits: share.canEditVetVisits,
        canViewMedications: share.canViewMedications,
        canEditMedications: share.canEditMedications,
        canViewNotes: share.canViewNotes,
        canEditNotes: share.canEditNotes,
      },
      createdAt: share.createdAt.toISOString(),
    };
  }
}
