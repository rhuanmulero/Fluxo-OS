export class ApiError extends Error {
  constructor(statusCode, message, code = null) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
  }

  get isUnauthorized() {
    return this.statusCode === 401;
  }
}
