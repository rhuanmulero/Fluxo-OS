import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '../styles/tokens.css';
import '../styles/auth.css';
import '../styles/components.css';
import { session } from '../core/session-store.js';
import { PendingButton } from '../components/pending-button.js';
import { FormFields } from '../components/form-field.js';

const MINIMUM_PASSWORD_LENGTH = 8;

const token = new URLSearchParams(window.location.search).get('token');
const form = document.getElementById('resetForm');
const invalidNotice = document.getElementById('resetInvalid');

if (!token) {
  form.hidden = true;
  invalidNotice.hidden = false;
}

const fields = new FormFields(form, [
  { name: 'password', required: true, message: 'Informe a nova senha.' },
  { name: 'confirmation', required: true, message: 'Repita a nova senha.' },
]);

const button = new PendingButton(form.querySelector('button[type="submit"]'));

form.addEventListener('submit', (event) => {
  event.preventDefault();

  if (!fields.validate()) {
    return;
  }

  const password = form.querySelector('[name="password"]').value;
  const confirmation = form.querySelector('[name="confirmation"]').value;

  if (password.length < MINIMUM_PASSWORD_LENGTH) {
    fields.showError(
      'password',
      `A senha deve ter ao menos ${MINIMUM_PASSWORD_LENGTH} caracteres.`,
    );
    return;
  }

  if (password !== confirmation) {
    fields.showError('confirmation', 'As duas senhas precisam ser iguais.');
    return;
  }

  void button
    .during(() => session.resetPassword(token, password))
    .then(() => window.location.assign('/login.html?redefinida=1'))
    .catch((error) => fields.showError('password', error.message));
});
