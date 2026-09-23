import { api } from './api-client.js';
import { ApiError } from './api-error.js';

const AUTH_MESSAGES = {
  INVALID_EMAIL_OR_PASSWORD: 'E-mail ou senha incorretos.',
  INVALID_EMAIL: 'Informe um e-mail válido.',
  INVALID_PASSWORD: 'Senha incorreta.',
  USER_NOT_FOUND: 'Não encontramos uma conta com este e-mail.',
  USER_ALREADY_EXISTS: 'Já existe uma conta com este e-mail.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'Já existe uma conta com este e-mail.',
  CREDENTIAL_ACCOUNT_NOT_FOUND: 'Esta conta não entra com senha.',
  PASSWORD_TOO_SHORT: 'A senha deve ter ao menos 8 caracteres.',
  PASSWORD_TOO_LONG: 'A senha é longa demais.',
  EMAIL_NOT_VERIFIED: 'Confirme seu e-mail antes de entrar.',
  SESSION_EXPIRED: 'Sua sessão expirou. Entre novamente.',
  FAILED_TO_CREATE_USER: 'Não foi possível criar a conta. Tente novamente.',
  FAILED_TO_CREATE_SESSION: 'Não foi possível iniciar sua sessão. Tente novamente.',
  VALIDATION_ERROR: 'Verifique os dados informados.',
  MISSING_FIELD: 'Preencha todos os campos.',
  BODY_MUST_BE_AN_OBJECT: 'Verifique os dados informados.',
  FIELD_NOT_ALLOWED: 'Verifique os dados informados.',
  INVALID_ORIGIN: 'Este endereço não está autorizado a acessar o Fluxo.',
  MISSING_OR_NULL_ORIGIN: 'Este endereço não está autorizado a acessar o Fluxo.',
  CROSS_SITE_NAVIGATION_LOGIN_BLOCKED: 'Entre pela própria tela de login do Fluxo.',
  INVALID_TOKEN: 'Este link de redefinição não é mais válido. Peça outro.',
  TOKEN_EXPIRED: 'Este link expirou. Peça outro para continuar.',
  PASSWORD_COMPROMISED: 'Escolha uma senha diferente desta.',
  INVALID_EMAIL_OR_PASSWORD_OR_ACCOUNT_NOT_FOUND: 'E-mail ou senha incorretos.',
};

const UNMAPPED_AUTH_FAILURE = 'Não foi possível concluir. Tente novamente em instantes.';

/* O better-auth responde em inglês e sempre com um code; o filtro do backend
   responde em português e sem code. Traduzimos pelo code e nunca reaproveitamos
   o texto do better-auth, para que nenhuma mensagem em inglês chegue à tela. */
function inPortuguese(error) {
  if (!(error instanceof ApiError) || error.code === null) {
    return error;
  }

  return new ApiError(
    error.statusCode,
    AUTH_MESSAGES[error.code] ?? UNMAPPED_AUTH_FAILURE,
    error.code,
  );
}

export class SessionStore {
  #user = null;

  get user() {
    return this.#user;
  }

  async load() {
    try {
      this.#user = await api.get('/me');
    } catch (error) {
      if (error instanceof ApiError && error.isUnauthorized) {
        this.#user = null;
      } else {
        throw error;
      }
    }

    return this.#user;
  }

  async signIn(email, password) {
    try {
      await api.post('/auth/sign-in/email', { email, password });
    } catch (error) {
      throw inPortuguese(error);
    }

    return this.load();
  }

  async signUp(name, email, password) {
    try {
      await api.post('/auth/sign-up/email', { name, email, password });
    } catch (error) {
      throw inPortuguese(error);
    }

    return this.load();
  }

  async requestPasswordReset(email) {
    try {
      await api.post('/auth/request-password-reset', {
        email,
        redirectTo: `${window.location.origin}/reset-password.html`,
      });
    } catch (error) {
      throw inPortuguese(error);
    }
  }

  async resetPassword(token, newPassword) {
    try {
      await api.post('/auth/reset-password', { token, newPassword });
    } catch (error) {
      throw inPortuguese(error);
    }
  }

  async signOut() {
    await api.post('/auth/sign-out', {});
    this.#user = null;
  }

  async updateName(name) {
    try {
      await api.post('/auth/update-user', { name });
    } catch (error) {
      throw inPortuguese(error);
    }

    return this.load();
  }

  async changePassword(currentPassword, newPassword) {
    try {
      await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
    } catch (error) {
      throw inPortuguese(error);
    }
  }

  async revokeOtherSessions() {
    try {
      await api.post('/auth/revoke-other-sessions', {});
    } catch (error) {
      throw inPortuguese(error);
    }
  }

  async requireSession(loginUrl = '/login.html') {
    const user = await this.load();

    if (!user) {
      window.location.replace(loginUrl);
    }

    return user;
  }
}

export const session = new SessionStore();
