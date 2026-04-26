export interface PetShareDetails {
  id: string;
  petId: string;
  petName: string;
  petSpecies: string;
  sharedByEmail: string;
  status: 'pending' | 'accepted';
  permissions: {
    canViewVetVisits: boolean;
    canEditVetVisits: boolean;
    canViewMedications: boolean;
    canEditMedications: boolean;
    canViewNotes: boolean;
    canEditNotes: boolean;
  };
  createdAt: Date;
}
