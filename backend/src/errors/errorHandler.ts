import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

import { AppError } from './AppError.js';

interface ErrorBody {
  error: { code: string; message: string };
}

function body(code: string, message: string): ErrorBody {
  return { error: { code, message } };
}

// Handler central: detalhe completo vai para o log do servidor; o cliente recebe
// sempre uma mensagem genérica em pt-BR, sem stack trace nem detalhe interno.
export function errorHandler(
  error: FastifyError | AppError,
  request: FastifyRequest,
  reply: FastifyReply,
): FastifyReply {
  if (error instanceof AppError) {
    request.log.warn({ err: error, code: error.code }, 'app error');
    return reply.status(error.statusCode).send(body(error.code, error.publicMessage));
  }

  // Erros de validação de schema do Fastify.
  if ((error as FastifyError).validation) {
    request.log.warn({ err: error }, 'validation error');
    return reply.status(400).send(body('BAD_REQUEST', 'Requisição inválida.'));
  }

  const statusCode = (error as FastifyError).statusCode ?? 500;

  if (statusCode >= 500) {
    request.log.error({ err: error }, 'unhandled error');
    return reply
      .status(500)
      .send(body('INTERNAL_ERROR', 'Ocorreu um erro interno. Tente novamente mais tarde.'));
  }

  request.log.warn({ err: error, statusCode }, 'client error');
  return reply.status(statusCode).send(body('BAD_REQUEST', 'Requisição inválida.'));
}

export function notFoundHandler(_request: FastifyRequest, reply: FastifyReply): FastifyReply {
  return reply.status(404).send(body('NOT_FOUND', 'Recurso não encontrado.'));
}
