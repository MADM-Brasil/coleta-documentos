export interface ClientMedia {
  id: string;
  url: string | null;
  mimeType: string;
}

export interface ClientItem {
  id: string;
  type: "ID_DOCUMENT" | "PROOF_OF_ADDRESS" | "ACCIDENT_AUDIO" | "LIMITATION_VIDEO";
  title: string;
  description: string | null;
  instructions: string | null;
  required: boolean;
  status: "PENDING" | "UPLOADED";
  media: ClientMedia[];
}

export interface ClientCollection {
  id: string;
  status: string;
  client: { name: string };
  expiresAt: string;
  items: ClientItem[];
}
