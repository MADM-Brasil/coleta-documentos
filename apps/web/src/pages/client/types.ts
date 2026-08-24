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
    | "COPIA_PROCESSO";
  title: string;
  description: string | null;
  instructions: string | null;
  required: boolean;
  status: "PENDING" | "UPLOADED";
  multiple: boolean;
  media: ClientMedia[];
}

export interface ClientCollection {
  id: string;
  status: string;
  client: { name: string };
  expiresAt: string;
  items: ClientItem[];
}
