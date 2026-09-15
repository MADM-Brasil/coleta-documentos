export interface ClientMedia {
  id: string;
  url: string | null;
  mimeType: string;
  originalFilename: string;
}

export interface ClientItem {
  id: string;
  type:
    | "RG_FRENTE"
    | "RG_VERSO"
    | "COMPROVANTE"
    | "AUDIO"
    | "VIDEO"
    | "CTPS"
    | "CNIS"
    | "LAUDO_MEDICO"
    | "CARTA_CONCESSAO"
    | "COPIA_PROCESSO"
    | "CAT"
    | "PPP"
    | "HOLERITE"
    | "TERMO_RESCISAO"
    | "DOCUMENTO_CARGO"
    | "COMPROVACAO_AFASTAMENTO";
  title: string;
  description: string | null;
  instructions: string | null;
  required: boolean;
  status: "PENDING" | "UPLOADED" | "APPROVED" | "REJECTED";
  multiple: boolean;
  rejectionReason?: string | null;
  media: ClientMedia[];
}

// Itens em PDF (sem câmera/gravação) usam o MultiItemCard — os demais (foto, áudio,
// vídeo) usam o ItemCard, que já sabe lidar com "multiple" e mantém câmera/microfone.
export const PDF_MULTI_TYPES = new Set([
  "CTPS",
  "LAUDO_MEDICO",
  "CARTA_CONCESSAO",
  "COPIA_PROCESSO",
  "CAT",
  "PPP",
  "HOLERITE",
  "TERMO_RESCISAO",
  "DOCUMENTO_CARGO",
  "COMPROVACAO_AFASTAMENTO",
]);

export interface ClientCollection {
  id: string;
  status: string;
  client: { name: string };
  expiresAt: string;
  items: ClientItem[];
}
