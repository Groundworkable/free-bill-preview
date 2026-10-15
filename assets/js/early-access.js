/* Groundwork public beta request form — shared by homepage and Early Access room.
   Google Apps Script is the primary intake; do not expose service-role secrets here. */
(() => {
  const ENDPOINT = "https://script.google.com/macros/s/AKfycbx1RAO09csshG1c3uPKASm0Sisw9-PmbUChupqetFYaxb1PfCqMRMFj5HXCRgIx5lAUSQ/exec";
  const forms = document.querySelectorAll('form[data-groundwork-intake]');
  const track = eventName => {
    if (typeof window.gtag === 'function') window.gtag('event', eventName);
  };
  document.querySelectorAll('a[href="#early-access"], a[href="#request-form"], a[href="/#early-access"]').forEach(link => {
    link.addEventListener('click', () => track('early_access_cta_clicked'));
  });
  forms.forEach(form => {
    const status = form.querySelector('[data-intake-status]');
    const submitButton = form.querySelector('button[type="submit"]');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      status.textContent = '';
      if (!form.reportValidity()) return;
      const honeypot = form.elements.namedItem('website');
      if (honeypot && String(honeypot.value).trim()) {
        form.reset();
        status.textContent = 'Please check your email if this was your first Groundwork request.';
        return;
      }
      if (!ENDPOINT) {
        status.textContent = 'Requests are temporarily unavailable. Please email hello@groundworkbyable.com.';
        return;
      }
      submitButton.disabled = true;
      submitButton.textContent = 'Submitting…';
      try {
        const data = new URLSearchParams(new FormData(form));
        await fetch(ENDPOINT, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: data
        });
        // no-cors returns an opaque response; it cannot prove backend acceptance.
        status.textContent = 'Please check your inbox (and Spam) for your Groundwork confirmation. First-time requests should receive an email from hello@groundworkbyable.com. If none arrives, contact us at that address.';
        track('early_access_submission_attempted');
        form.reset();
      } catch (error) {
        status.textContent = 'We could not submit your request. Please try again, or email hello@groundworkbyable.com.';
        track('early_access_submission_network_error');
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Request Beta Access';
      }
    });
  });
})();
