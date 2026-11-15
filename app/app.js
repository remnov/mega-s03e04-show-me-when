import { fetchIncidents, ack } from './api.js';
import { formatLocalTime } from './time.js';

const list = document.querySelector('[data-testid="incident-list"]');
const loader = document.querySelector('[data-testid="loader"]');
const empty = document.querySelector('[data-testid="empty"]');
const status = document.querySelector('[data-testid="status"]');
const rows = new Map();
const acked = new Map();
const pending = new Set();
let loading = false;
let refreshFailed = false;
const confirmation = document.querySelector('[data-testid="confirm"]');
const confirmAck = document.querySelector('[data-testid="confirm-ack"]');
const confirmCancel = document.querySelector('[data-testid="confirm-cancel"]');
const confirmError = document.querySelector('[data-testid="confirm-error"]');
let selected = null;

function cancelConfirmation() {
  if (selected && pending.has(selected.id)) return;
  selected = null;
  confirmation.close();
}

confirmCancel.addEventListener('click', cancelConfirmation);
confirmation.addEventListener('cancel', event => {
  event.preventDefault();
  cancelConfirmation();
});
confirmAck.addEventListener('click', async () => {
  if (!selected || pending.has(selected.id)) return;
  const incident = selected;
  const row = rows.get(incident.id);
  pending.add(incident.id);
  confirmAck.disabled = true;
  confirmCancel.disabled = true;
  confirmAck.textContent = 'Acknowledging…';
  confirmError.textContent = '';
  if (row) renderAction(row, incident);
  try {
    const result = await ack(incident.id);
    acked.set(incident.id, result);
    status.textContent = `${incident.id} acknowledged.`;
    selected = null;
    confirmation.close();
  } catch {
    confirmError.textContent = `Could not acknowledge ${incident.id}. Please try again.`;
  } finally {
    pending.delete(incident.id);
    confirmAck.disabled = false;
    confirmCancel.disabled = false;
    confirmAck.textContent = 'Confirm Ack';
    if (row) renderAction(row, incident);
  }
});

function askToAcknowledge(incident) {
  selected = incident;
  document.querySelector('[data-testid="confirm-id"]').textContent = incident.id;
  document.querySelector('[data-testid="confirm-description"]').textContent = `${incident.service} · ${incident.region} · ${incident.summary}`;
  confirmError.textContent = '';
  confirmation.showModal();
  confirmCancel.focus();
}

function text(className, value) {
  const element = document.createElement('span');
  element.className = className;
  element.textContent = value;
  return element;
}

function createRow(incident) {
  const row = document.createElement('li');
  row.dataset.testid = 'incident-row';
  row.dataset.id = incident.id;
  row.append(text('id', incident.id), text('sev', incident.severity));
  const description = document.createElement('div');
  description.className = 'what';
  description.append(text('service', `${incident.service} · ${incident.region}`), text('summary', incident.summary));
  const time = document.createElement('time');
  const action = document.createElement('div');
  action.className = 'action';
  row.append(description, time, action);
  return row;
}

function renderAction(row, incident) {
  const action = row.querySelector('.action');
  if (acked.has(incident.id)) {
    const mark = text('acked', 'Acked');
    mark.dataset.testid = 'acked';
    action.replaceChildren(mark);
    return;
  }
  let button = action.querySelector('button');
  if (!button) {
    button = document.createElement('button');
    button.dataset.testid = 'ack';
    button.type = 'button';
    button.setAttribute('aria-label', `Acknowledge ${incident.id}`);
    button.addEventListener('click', () => askToAcknowledge(incident));
    action.replaceChildren(button);
  }
  button.disabled = pending.has(incident.id);
  button.textContent = button.disabled ? 'Acking…' : 'Ack';
}

function render(incidents) {
  const ordered = [...incidents].sort((a, b) => Date.parse(b.openedAt) - Date.parse(a.openedAt));
  const ids = new Set(ordered.map(incident => incident.id));
  for (const [id, row] of rows) {
    if (!ids.has(id)) { row.remove(); rows.delete(id); }
  }
  ordered.forEach((incident, index) => {
    let row = rows.get(incident.id);
    if (!row) { row = createRow(incident); rows.set(incident.id, row); }
    row.className = `row ${incident.severity}`;
    row.querySelector('.sev').textContent = incident.severity;
    row.querySelector('.service').textContent = `${incident.service} · ${incident.region}`;
    row.querySelector('.summary').textContent = incident.summary;
    const time = row.querySelector('time');
    time.dateTime = incident.openedAt;
    time.textContent = formatLocalTime(incident.openedAt);
    time.title = incident.openedAt;
    renderAction(row, incident);
    if (list.children[index] !== row) list.insertBefore(row, list.children[index] || null);
  });
  empty.hidden = ordered.length !== 0;
}

async function refresh() {
  if (loading) return;
  loading = true;
  try {
    const page = await fetchIncidents();
    render(page.incidents);
    loader.hidden = true;
    list.hidden = false;
    if (refreshFailed) status.textContent = '';
    refreshFailed = false;
    document.querySelector('[data-testid="updated"]').textContent = `Updated ${formatLocalTime(page.updatedAt)}`;
  } catch {
    refreshFailed = true;
    status.textContent = 'Could not refresh incidents. Retrying in 2 seconds.';
  } finally { loading = false; }
}

refresh();
setInterval(refresh, 2000);
