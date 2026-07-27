export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 400,
    public code: string = "BAD_REQUEST"
  ) {
    super(message);
  }
}

export const Errors = {
  unauthorized: (message = "Não autorizado.") => new AppError(message, 401, "UNAUTHORIZED"),
  forbidden: (message = "Acesso negado.") => new AppError(message, 403, "FORBIDDEN"),
  notFound: (message = "Recurso não encontrado.") => new AppError(message, 404, "NOT_FOUND"),
  expired: (message = "Seu link de coleta expirou. Entre em contato com o atendimento.") =>
    new AppError(message, 410, "EXPIRED"),
  tooLarge: (message = "Esse arquivo é muito grande.") => new AppError(message, 413, "FILE_TOO_LARGE"),
  invalidFileType: (message = "Precisamos de uma imagem JPG, PNG ou PDF.") =>
    new AppError(message, 415, "INVALID_FILE_TYPE"),
  validation: (message = "Dados inválidos.") => new AppError(message, 422, "VALIDATION_ERROR"),
};
