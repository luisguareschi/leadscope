export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

export const notFound = (message = "No encontrado") => new HttpError(404, message, "not_found");
export const badRequest = (message: string, code = "bad_request") => new HttpError(400, message, code);
