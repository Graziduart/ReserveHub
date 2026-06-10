/**
 * Recalcula dashboard_summaries no service-data a partir do Postgres (core).
 * Uso: node scripts/reconcile-dashboard.mjs
 */
const iam = process.env.IAM_BASE ?? 'http://127.0.0.1:3001';
const core = process.env.CORE_BASE ?? 'http://127.0.0.1:3000';
const data = process.env.DATA_BASE ?? 'http://127.0.0.1:3002';
const adminEmail = process.env.IAM_ADMIN_EMAIL ?? 'admin@reservehub.local';
const adminPassword = process.env.IAM_ADMIN_PASSWORD ?? 'ReserveHub1!';

async function main() {
  const loginRes = await fetch(`${iam}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  if (!loginRes.ok) throw new Error(`Login failed ${loginRes.status}`);
  const { accessToken } = await loginRes.json();
  const headers = { Authorization: `Bearer ${accessToken}` };

  const [deps, resources, reservations] = await Promise.all([
    fetch(`${core}/departments`, { headers }).then((r) => r.json()),
    fetch(`${core}/resources`, { headers }).then((r) => r.json()),
    fetch(`${core}/reservations`, { headers }).then((r) => r.json()),
  ]);

  const reservationsByStatus = {};
  for (const r of reservations) {
    reservationsByStatus[r.status] = (reservationsByStatus[r.status] ?? 0) + 1;
  }

  const body = {
    departmentsActive: Array.isArray(deps) ? deps.filter((d) => d.active).length : 0,
    resourcesActive: Array.isArray(resources) ? resources.length : 0,
    reservationsByStatus,
  };

  const res = await fetch(`${data}/cards/reconcile`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Reconcile failed ${res.status}: ${await res.text()}`);
  }
  console.log('Dashboard reconciliado:', await res.json());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
