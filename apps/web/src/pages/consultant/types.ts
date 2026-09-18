export interface WatchMedia {
  id: string;
  url: string | null;
  mimeType: string;
  originalFilename: string;
  createdAt: string;
}

export interface WatchItem {
  id: string;
  type: string;
  title: string;
  required: boolean;
  status: "PENDING" | "UPLOADED" | "APPROVED" | "REJECTED";
  multiple: boolean;
  reviewNote: string | null;
  media: WatchMedia[];
}

export interface WatchCollection {
  id: string;
  status: string;
  client: { name: string };
  expiresAt: string;
  clientLink: string | null;
  items: WatchItem[];
}
