export const DEFAULT_ITEMS = [
  {
    type: "ID_DOCUMENT" as const,
    title: "Documento de identificação",
    description: "Envie uma foto legível do seu RG ou CNH.",
    sortOrder: 1,
  },
  {
    type: "PROOF_OF_ADDRESS" as const,
    title: "Comprovante",
    description: "Envie uma foto do seu comprovante.",
    sortOrder: 2,
  },
  {
    type: "ACCIDENT_AUDIO" as const,
    title: "Áudio sobre o acidente",
    description: "Grave um áudio contando com suas palavras o que aconteceu.",
    sortOrder: 3,
  },
  {
    type: "LIMITATION_VIDEO" as const,
    title: "Vídeo da limitação",
    description: "Grave um vídeo seguindo as orientações do seu atendimento.",
    instructions:
      "Posicione o celular de forma que seja possível visualizar seu movimento. Siga as orientações recebidas durante o atendimento.",
    sortOrder: 4,
  },
];
