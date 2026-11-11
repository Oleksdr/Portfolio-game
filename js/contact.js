// Formulaire de contact via EmailJS, messages en français ou en anglais.
document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('.contact-form');
  if (!form) return;

  const t = (k) => (window.I18N ? window.I18N.t(k) : k);
  const status = form.querySelector('.form-status');
  const button = form.querySelector('button[type="submit"]');
  const buttonHTML = button.innerHTML;

  if (window.emailjs) emailjs.init({ publicKey: 'peRslZGzwUqzU_CmQ' });

  const showStatus = (text, type) => {
    status.textContent = text;
    status.className = `form-status ${type ? `is-${type}` : ''}`;
  };

  const validate = () => {
    let firstInvalid = null;
    form.querySelectorAll('input, textarea').forEach((field) => {
      const ok = field.checkValidity() && field.value.trim() !== '';
      field.setAttribute('aria-invalid', String(!ok));
      if (!ok && !firstInvalid) firstInvalid = field;
    });
    return firstInvalid;
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const invalid = validate();
    if (invalid) {
      showStatus(invalid.type === 'email' && invalid.value ? t('formEmail') : t('formMissing'), 'error');
      invalid.focus();
      return;
    }
    if (!window.emailjs) {
      showStatus(t('formNoService'), 'error');
      return;
    }
    button.disabled = true;
    button.textContent = t('formSending');
    showStatus('', null);
    try {
      await emailjs.sendForm('service_prvoiro', 'template_0vbbsm7', form);
      form.reset();
      form.querySelectorAll('[aria-invalid]').forEach((f) => f.removeAttribute('aria-invalid'));
      showStatus(t('formSent'), 'success');
    } catch (err) {
      console.error(err);
      showStatus(t('formError'), 'error');
    } finally {
      button.disabled = false;
      button.innerHTML = buttonHTML;
    }
  });

  form.querySelectorAll('input, textarea').forEach((field) => {
    field.addEventListener('input', () => field.removeAttribute('aria-invalid'));
  });
});
