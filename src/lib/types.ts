export type PhotoMeta = {
  id: string;
  listingId: string;
  originalName: string;
  filename: string;
  mime: string;
  ext: string;
  createdAt: number;
};

export type Listing = {
  id: string;
  title?: string;
  address: string;
  sanitizedAddress: string;
  photoIds: string[];
  photos: Record<string, PhotoMeta>;
  createdAt: number;
  updatedAt: number;
};