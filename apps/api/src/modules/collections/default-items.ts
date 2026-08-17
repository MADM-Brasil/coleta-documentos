export const DEFAULT_ITEMS = [
  {
    type: "RG_FRENTE" as const,
    title: "Documento de identificação (Frente)",
    description: "Envie uma foto legível da frente do seu RG ou CNH.",
    sortOrder: 1,
  },
  {
    type: "RG_VERSO" as const,
    title: "Documento de identificação (Verso)",
    description: "Envie uma foto legível do verso do seu RG ou CNH.",
    sortOrder: 2,
  },
  {
    type: "COMPROVANTE" as const,
    title: "Comprovante",
    description: "Envie uma foto do seu comprovante.",
    sortOrder: 3,
  },
  {
    type: "AUDIO" as const,
    title: "Áudio sobre o acidente",
    description: "Grave um áudio contando com suas palavras o que aconteceu.",
    sortOrder: 4,
  },
  {
    type: "VIDEO" as const,
    title: "Vídeo da limitação",
    description: "Grave um vídeo seguindo as orientações do seu atendimento.",
    instructions:
      "Posicione o celular de forma que seja possível visualizar seu movimento. Siga as orientações recebidas durante o atendimento.",
    sortOrder: 5,
  },
];
