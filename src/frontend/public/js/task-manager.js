// Progressive enhancement for the Caseworker Task Manager.
//
// Every action works without JavaScript: forms POST to the page routes, which
// validate, re-render with accessible errors on failure, and redirect with a
// success toast on success. Alpine only *enhances* those same forms — it does
// not replace them.
//
// Two enhancements:
//  1. The filter/sort bar submits automatically when a dropdown changes, so the
//     "Apply filters" button is only needed as a no-JS fallback.
//  2. The create/edit task forms get instant client-side validation, showing the
//     same GOV.UK error summary and inline messages before the round trip. When
//     the input is valid the form submits natively to the page route.

// Auto-submit the filter/sort form whenever a dropdown changes.
function enhanceFilterForm() {
  const form = document.querySelector('[data-filter-form]');
  if (!form) return;
  form.querySelectorAll('select').forEach((select) => {
    select.addEventListener('change', () => form.submit());
  });
}

// Turn server-rendered success toasts into temporary feedback for JS
// users. Without JavaScript the same GOV.UK notification remains on the page.
function enhanceSuccessToasts() {
  const toasts = document.querySelectorAll('[data-success-toast]');
  if (toasts.length === 0) return;

  const url = new URL(window.location.href);
  const notice = url.searchParams.get('notice');
  if (notice) {
    url.searchParams.delete('notice');
    if (notice === 'status') url.searchParams.delete('status');
    window.history.replaceState(
      {},
      '',
      `${url.pathname}${url.search}${url.hash}`,
    );
  }

  toasts.forEach((toast) => {
    window.setTimeout(() => {
      toast.classList.add('app-toast--leaving');
      window.setTimeout(() => toast.remove(), 250);
    }, 5000);
  });
}

// Show the delete confirmation as a modal on the task detail page.
function enhanceDeleteModal() {
  const modal = document.querySelector('[data-delete-modal]');
  const openButton = document.querySelector('[data-delete-modal-open]');
  if (!modal || !openButton) return;

  const closeButtons = modal.querySelectorAll('[data-delete-modal-cancel]');
  let closeTimer;

  const closeModal = () => {
    window.clearTimeout(closeTimer);
    if (typeof modal.close === 'function') {
      modal.classList.add('app-modal--closing');
      closeTimer = window.setTimeout(() => {
        modal.classList.remove('app-modal--closing');
        modal.close();
      }, 180);
    } else {
      modal.classList.remove('app-modal--open');
      modal.removeAttribute('open');
      openButton.focus();
    }
  };

  openButton.addEventListener('click', () => {
    modal.classList.remove('app-modal--closing');
    if (typeof modal.showModal === 'function') {
      modal.showModal();
    } else {
      modal.setAttribute('open', '');
    }
    modal.classList.add('app-modal--open');
  });

  closeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      closeModal();
    });
  });

  modal.addEventListener('close', () => {
    window.clearTimeout(closeTimer);
    modal.classList.remove('app-modal--open', 'app-modal--closing');
    openButton.focus();
  });

  modal.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeModal();
  });

  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    enhanceFilterForm();
    enhanceSuccessToasts();
    enhanceDeleteModal();
  });
} else {
  enhanceFilterForm();
  enhanceSuccessToasts();
  enhanceDeleteModal();
}

document.addEventListener('alpine:init', () => {
  // Shared create/edit task form: validates on submit, mirroring the server-side
  // Zod rules. On error it populates `errors` (driving the GOV.UK summary and
  // inline messages) and prevents the submit; when valid it lets the native POST
  // proceed to the page route.
  Alpine.data('taskForm', () => ({
    errors: {},

    get hasErrors() {
      return Object.keys(this.errors).length > 0;
    },

    submit(event) {
      const form = event.target;
      const errors = {};

      const title = (form.title.value || '').trim();
      if (!title) errors.title = 'Enter a task title';
      else if (title.length > 100)
        errors.title = 'Title must be 100 characters or fewer';

      const description = form.description.value || '';
      if (description.length > 500)
        errors.description = 'Description must be 500 characters or fewer';

      if (!form.dueDateTime.value)
        errors.dueDateTime = 'Enter a valid due date and time';

      this.errors = errors;

      if (Object.keys(errors).length > 0) {
        event.preventDefault();
        this.$nextTick(() => this.$refs.summary && this.$refs.summary.focus());
      }
    },
  }));
});
