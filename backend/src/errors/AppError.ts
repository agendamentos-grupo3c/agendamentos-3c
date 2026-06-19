// Erro de aplicação tipado. `publicMessage` é o que volta ao cliente (genérico,
// pt-BR, sem detalhe interno); `message`/`cause` ficam só no log do servidor.

export interface AppErrorParams {
  code: string;
  statusCode: number;
  publicMessage: string;
  message?: string;
  cause?: unknown;
}

export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly publicMessage: string;

  constructor(params: AppErrorParams) {
    super(params.message ?? params.publicMessage, { cause: params.cause });
    this.name = 'AppError';
    this.code = params.code;
    this.statusCode = params.statusCode;
    this.publicMessage = params.publicMessage;
  }
}
