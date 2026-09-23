import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '../styles/tokens.css';
import '../styles/auth.css';
import '../styles/components.css';
import { session } from '../core/session-store.js';
import { ApiError } from '../core/api-error.js';
import { PendingButton } from '../components/pending-button.js';
import { FormFields } from '../components/form-field.js';

const FIELD_LABELS = {
  name: 'nome completo',
  email: 'e-mail',
  password: 'senha',
};

function toggleCard() {
  document.getElementById('authCard').classList.toggle('is-flipped');
  document.body.classList.toggle('light-mode');
}

document.querySelectorAll('[data-action="toggle-card"]').forEach((button) => {
  button.addEventListener('click', toggleCard);
});

function togglePassword(button) {
  const input = button.parentElement.querySelector('input');
  const revealed = button.getAttribute('aria-pressed') === 'true';
  const label = revealed ? 'Mostrar senha' : 'Ocultar senha';

  input.type = revealed ? 'password' : 'text';
  button.setAttribute('aria-pressed', String(!revealed));
  button.setAttribute('aria-label', label);
  button.title = label;
}

document.querySelectorAll('[data-action="toggle-password"]').forEach((button) => {
  button.addEventListener('click', () => togglePassword(button));
});

function showError(form, message) {
  let box = form.querySelector('.form-error');

  if (!box) {
    box = document.createElement('p');
    box.className = 'form-error';
    box.setAttribute('role', 'alert');
    form.appendChild(box);
  }

  box.textContent = message;
}

function clearError(form) {
  form.querySelector('.form-error')?.remove();
}

/* As mensagens nativas do navegador seguem o idioma do navegador, entao a
   validacao usa a Constraint Validation API apenas para saber qual regra
   falhou e escreve o texto em portugues. */
function firstInvalidMessage(form) {
  for (const input of form.querySelectorAll('input')) {
    if (input.validity.valueMissing) {
      return `Preencha o campo ${FIELD_LABELS[input.name]}.`;
    }

    if (input.validity.typeMismatch) {
      return 'Informe um e-mail válido.';
    }

    if (input.validity.tooShort) {
      return `A senha deve ter ao menos ${input.minLength} caracteres.`;
    }
  }

  return null;
}

async function submit(form, pendingButton, action) {
  const invalid = firstInvalidMessage(form);

  if (invalid) {
    showError(form, invalid);
    return;
  }

  clearError(form);

  try {
    await pendingButton.during(action);
    window.location.replace('/workspace.html');
  } catch (error) {
    showError(form, error instanceof ApiError ? error.message : 'Não foi possível concluir.');
  }
}

const loginForm = document.getElementById('loginForm');
const loginButton = new PendingButton(loginForm.querySelector('.btn-primary'));
loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const { email, password } = loginForm.elements;
  void submit(loginForm, loginButton, () => session.signIn(email.value, password.value));
});

const registerForm = document.getElementById('registerForm');
const registerButton = new PendingButton(registerForm.querySelector('.btn-primary'));
registerForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const { name, email, password } = registerForm.elements;
  void submit(registerForm, registerButton, () => session.signUp(name.value, email.value, password.value));
});

const forgotForm = document.getElementById('forgotForm');
const forgotFields = new FormFields(forgotForm, [
  { name: 'email', required: true, message: 'Informe o e-mail da conta.' },
]);

document.querySelector('[data-action="forgot"]').addEventListener('click', () => {
  clearError(loginForm);
  forgotFields.clear();
  loginForm.hidden = true;
  forgotForm.hidden = false;
  forgotForm.querySelector('[name="email"]').focus();
});

document.querySelector('[data-action="back-to-login"]').addEventListener('click', () => {
  forgotForm.hidden = true;
  loginForm.hidden = false;
});

const forgotButton = new PendingButton(forgotForm.querySelector('button[type="submit"]'));

forgotForm.addEventListener('submit', (event) => {
  event.preventDefault();
  clearError(forgotForm);

  if (!forgotFields.validate()) {
    return;
  }

  const email = forgotForm.querySelector('[name="email"]').value.trim();

  void forgotButton
    .during(() => session.requestPasswordReset(email))
    .then(() => {
      forgotForm.innerHTML =
        '<p class="form-notice">Se existir uma conta com esse e-mail, enviamos o link de redefinição. Confira sua caixa de entrada.</p>';
    })
    .catch((error) =>
      showError(
        forgotForm,
        error instanceof ApiError ? error.message : 'Não foi possível concluir.',
      ),
    );
});
