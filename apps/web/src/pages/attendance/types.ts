export type Role = "CLIENT" | "AGENT";

export type CallState = "idle" | "waiting_peer" | "incoming" | "connecting" | "active" | "ended";

export interface AgentItem {
  id: string;
  type: string;
  title: string;
  required: boolean;
  status: "PENDING" | "UPLOADED" | "APPROVED" | "REJECTED";
  multiple: boolean;
  rejectionReason: string | null;
  media: { id: string; url: string | null; mimeType: string; originalFilename: string }[];
}

export interface AgentCollection {
  id: string;
  status: string;
  client: { name: string };
  items: AgentItem[];
}
