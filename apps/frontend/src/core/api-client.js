import { ApiError } from './api-error.js';

export class ApiClient {
  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl;
  }

  get(path) {
    return this.#request('GET', path);
  }

  post(path, body) {
    return this.#request('POST', path, body);
  }

  patch(path, body) {
    return this.#request('PATCH', path, body);
  }

  put(path, body) {
    return this.#request('PUT', path, body);
  }

  delete(path) {
    return this.#request('DELETE', path);
  }

  async postForm(path, formData) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    const payload = await this.#readJson(response);

    if (!response.ok) {
      throw new ApiError(
        response.status,
        payload?.message ?? 'Falha na comunicação com o servidor.',
        payload?.code ?? null,
      );
    }

    return payload;
  }

  async #request(method, path, body) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      credentials: 'include',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (response.status === 204) {
      return null;
    }

    const payload = await this.#readJson(response);

    if (!response.ok) {
      throw new ApiError(
        response.status,
        payload?.message ?? 'Falha na comunicação com o servidor.',
        payload?.code ?? null,
      );
    }

    return payload;
  }

  async #readJson(response) {
    const text = await response.text();

    if (text === '') {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new ApiError(response.status, 'Resposta do servidor em formato inesperado.');
    }
  }
}

export const api = new ApiClient();
