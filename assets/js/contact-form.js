// No backend: on submit, open the visitor's mail app with the enquiry pre-filled.
// The form's own mailto: action covers the no-JS case.
export default function initContactForm() {
  const form = document.getElementById('enquiry');
  if (!form) return;

  const to = form.dataset.recipient || 'office@mirupartners.com';
  const status = document.getElementById('enquiry-status');
  const value = (id) => document.getElementById(id)?.value.trim() || '';
  const label = (id) => form.querySelector(`label[for="${id}"]`)?.textContent.trim() || id;

  form.addEventListener('submit', (e) => {
    e.preventDefault(); // only fires once native validation passes

    const services = [...form.querySelectorAll('input[name="service"]:checked')].map((c) => c.value);
    const lines = ['name', 'company', 'email', 'phone', 'hq', 'markets'].map(
      (id) => `${label(id)}: ${value(id) || '—'}`,
    );
    lines.push(
      `Which service interests you?: ${services.join(', ') || '—'}`,
      '',
      label('prompt'),
      value('prompt') || '—',
      '',
      `${label('source')}: ${value('source') || '—'}`,
    );

    const company = value('company');
    const subject = `New enquiry from ${value('name')}${company ? ` (${company})` : ''}`;
    const href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;

    if (status) {
      const link = Object.assign(document.createElement('a'), { href: `mailto:${to}`, textContent: to });
      status.replaceChildren(
        `Your email app should now open with your enquiry addressed to ${to}. Press send there to deliver it. If nothing opens, write to us directly at `,
        link,
        '.',
      );
      status.hidden = false;
    }

    window.location.href = href;
  });
}
