function sendGroundworkEvent(eventName) {
  if (typeof gtag === 'function') {
    gtag('event', eventName);
  }
}

const money = value =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  }).format(value);

function splitWorkingTime(decimalHours) {
  const totalMinutes = Math.round(decimalHours * 60);
  return {
    totalMinutes,
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60
  };
}

function formatMainTime(decimalHours) {
  const { hours, minutes } = splitWorkingTime(decimalHours);
  return minutes === 0
    ? hours.toLocaleString('en-US')
    : `${hours.toLocaleString('en-US')}h ${minutes}m`;
}

function plural(value, singular, pluralForm = `${singular}s`) {
  return `${value} ${value === 1 ? singular : pluralForm}`;
}

function formatWeekBreakdown(decimalHours) {
  const { totalMinutes } = splitWorkingTime(decimalHours);
  const weekMinutes = 40 * 60;
  const dayMinutes = 8 * 60;
  const fullWeeks = Math.floor(totalMinutes / weekMinutes);
  let remainder = totalMinutes % weekMinutes;
  const fullDays = Math.floor(remainder / dayMinutes);
  remainder %= dayMinutes;
  const hours = Math.floor(remainder / 60);
  const minutes = remainder % 60;
  const parts = [];

  if (fullWeeks) parts.push(plural(fullWeeks, 'full 40-hour workweek'));
  if (fullDays) parts.push(plural(fullDays, 'workday'));
  if (hours) parts.push(plural(hours, 'hour'));
  if (minutes) parts.push(plural(minutes, 'minute'));

  if (!parts.length) return 'less than one minute of working hours';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}

const billTab = document.getElementById('billTab');
const variableTab = document.getElementById('variableTab');
const billPreview = document.getElementById('billPreview');
const variablePreview = document.getElementById('variablePreview');
const previewEyebrow = document.getElementById('previewEyebrow');
const previewTitle = document.getElementById('previewTitle');
const previewText = document.getElementById('previewText');

function setPreview(mode) {
  const billActive = mode === 'bill';

  billTab.classList.toggle('active', billActive);
  variableTab.classList.toggle('active', !billActive);
  billTab.setAttribute('aria-selected', String(billActive));
  variableTab.setAttribute('aria-selected', String(!billActive));
  billPreview.classList.toggle('active', billActive);
  variablePreview.classList.toggle('active', !billActive);

  if (billActive) {
    previewEyebrow.textContent = 'Free Bill Preview';
    previewTitle.textContent = 'How many hours of your life does this cost?';
    previewText.textContent = 'Translate a bill, purchase, or expense into working hours—in under a minute.';
    sendGroundworkEvent('preview_bill_selected');
  } else {
    previewEyebrow.textContent = 'Free Variable Income Preview';
    previewTitle.textContent = 'What do you need to earn per earning day?';
    previewText.textContent = 'Turn one responsibility into a clear gross earning target—in under a minute.';
    sendGroundworkEvent('preview_variable_selected');
  }
}

billTab.addEventListener('click', () => setPreview('bill'));
variableTab.addEventListener('click', () => setPreview('variable'));

const billForm = document.getElementById('billForm');
const billError = document.getElementById('billError');
const billResults = document.getElementById('billResults');
const billCta = document.getElementById('billCta');

billForm.addEventListener('submit', event => {
  event.preventDefault();

  const pay = Number(document.getElementById('pay').value);
  const amount = Number(document.getElementById('billAmount').value);
  const name = document.getElementById('billName').value.trim() || 'This bill';

  billError.style.display = 'none';
  billError.textContent = '';

  if (!Number.isFinite(pay) || pay <= 0) {
    billError.textContent = 'Enter an hourly pay amount greater than $0.';
    billError.style.display = 'block';
    billResults.classList.remove('show');
    billCta.classList.remove('show');
    return;
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    billError.textContent = 'Enter a bill amount greater than $0.';
    billError.style.display = 'block';
    billResults.classList.remove('show');
    billCta.classList.remove('show');
    return;
  }

  const workingHours = amount / pay;

  document.getElementById('resultName').textContent =
    `${name} at ${money(amount)} costs`;

  document.getElementById('hours').textContent =
    formatMainTime(workingHours);

  document.getElementById('meaning').textContent =
    `In Groundwork language: this costs ${formatWeekBreakdown(workingHours)} of your working time.`;

  billResults.classList.add('show');
  billCta.classList.add('show');
  sendGroundworkEvent('bill_calculation_completed');

  setTimeout(() => {
    billResults.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 80);
});

const variableForm = document.getElementById('variableForm');
const variableError = document.getElementById('variableError');
const variableResults = document.getElementById('variableResults');
const variableCta = document.getElementById('variableCta');
const taxMethod = document.getElementById('taxMethod');
const percentageField = document.getElementById('percentageField');
const fixedField = document.getElementById('fixedField');

taxMethod.addEventListener('change', () => {
  percentageField.hidden = taxMethod.value !== 'percentage';
  fixedField.hidden = taxMethod.value !== 'fixed';
});

variableForm.addEventListener('submit', event => {
  event.preventDefault();

  const name = document.getElementById('responsibilityName').value.trim() || 'This responsibility';
  const amount = Number(document.getElementById('responsibilityAmount').value);
  const funds = Number(document.getElementById('fundsAvailable').value || 0);
  const days = Number(document.getElementById('earningDays').value);
  const method = taxMethod.value;
  const percentage = Number(document.getElementById('taxPercentage').value || 0);
  const fixedPerDay = Number(document.getElementById('fixedTax').value || 0);

  variableError.style.display = 'none';
  variableError.textContent = '';

  if (!Number.isFinite(amount) || amount <= 0) {
    variableError.textContent = 'Enter a responsibility amount greater than $0.';
    variableError.style.display = 'block';
    variableResults.classList.remove('show');
    variableCta.classList.remove('show');
    return;
  }

  if (!Number.isFinite(funds) || funds < 0) {
    variableError.textContent = 'Funds already available cannot be below $0.';
    variableError.style.display = 'block';
    variableResults.classList.remove('show');
    variableCta.classList.remove('show');
    return;
  }

  if (!Number.isFinite(days) || days < 1 || days > 365 || !Number.isInteger(days)) {
    variableError.textContent = 'Enter a whole number of earning days between 1 and 365.';
    variableError.style.display = 'block';
    variableResults.classList.remove('show');
    variableCta.classList.remove('show');
    return;
  }

  if (method === 'percentage' &&
      (!Number.isFinite(percentage) || percentage < 0 || percentage >= 100)) {
    variableError.textContent = 'Enter a tax reserve percentage from 0 up to 99.99.';
    variableError.style.display = 'block';
    variableResults.classList.remove('show');
    variableCta.classList.remove('show');
    return;
  }

  if (method === 'fixed' && (!Number.isFinite(fixedPerDay) || fixedPerDay < 0)) {
    variableError.textContent = 'Enter a fixed reserve amount of $0 or more.';
    variableError.style.display = 'block';
    variableResults.classList.remove('show');
    variableCta.classList.remove('show');
    return;
  }

  const remainingUsable = Math.max(amount - funds, 0);
  let grossTarget = remainingUsable;

  if (method === 'percentage') {
    grossTarget = remainingUsable / (1 - percentage / 100);
  } else if (method === 'fixed') {
    grossTarget = remainingUsable + fixedPerDay * days;
  }

  const dailyTarget = grossTarget / days;

  document.getElementById('variableResultName').textContent =
    `${name} at ${money(amount)}`;

  document.getElementById('usableNeeded').textContent = money(remainingUsable);
  document.getElementById('grossTarget').textContent = money(grossTarget);
  document.getElementById('dailyGrossTarget').textContent = money(dailyTarget);
  document.getElementById('earningDaysResult').textContent = days.toLocaleString('en-US');

  variableResults.classList.add('show');
  variableCta.classList.add('show');
  sendGroundworkEvent('variable_calculation_completed');

  setTimeout(() => {
    variableResults.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 80);
});

const EARLY_ACCESS_ENDPOINT = "https://script.google.com/macros/s/AKfycbx1RAO09csshG1c3uPKASm0Sisw9-PmbUChupqetFYaxb1PfCqMRMFj5HXCRgIx5lAUSQ/exec";
const earlyAccessForm = document.getElementById('earlyAccessForm');
const earlyAccessStatus = document.getElementById('earlyAccessStatus');

document.querySelectorAll('a[href="#early-access"]').forEach(link => {
  link.addEventListener('click', () => sendGroundworkEvent('early_access_cta_clicked'));
});

earlyAccessForm.addEventListener('submit', async event => {
  event.preventDefault();
  earlyAccessStatus.textContent = '';

  if (!earlyAccessForm.reportValidity()) return;

  if (!EARLY_ACCESS_ENDPOINT) {
    earlyAccessStatus.textContent = 'This draft form is ready, but the Google Sheet connection still needs to be activated.';
    return;
  }

  const submitButton = earlyAccessForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = 'Joining...';

  try {
    const body = new URLSearchParams(new FormData(earlyAccessForm));
    await fetch(EARLY_ACCESS_ENDPOINT, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });

    earlyAccessForm.reset();
    earlyAccessStatus.textContent = 'Thanks — your Early Access request was sent.';
    sendGroundworkEvent('early_access_submitted');
  } catch (error) {
    earlyAccessStatus.textContent = 'The form could not be submitted. Please try again.';
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Join Early Access';
  }
});
