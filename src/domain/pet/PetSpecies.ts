export const PET_SPECIES = ['dog', 'cat', 'rabbit', 'bird', 'fish', 'other'] as const;
export type PetSpecies = typeof PET_SPECIES[number];
