/**

 * Fluxo rápido: health → login no IAM (JWT) → RBAC → audit + data → refresh/cancel.

 * Pré-requisito: docker compose up -d (ou serviços no host com mesmas portas).

 */



const iam = process.env.IAM_BASE ?? 'http://127.0.0.1:3001';

const core = process.env.CORE_BASE ?? 'http://127.0.0.1:3000';

const data = process.env.DATA_BASE ?? 'http://127.0.0.1:3002';

const audit = process.env.AUDIT_BASE ?? 'http://127.0.0.1:3003';



const adminEmail = process.env.IAM_ADMIN_EMAIL ?? process.env.CORE_ADMIN_EMAIL ?? 'admin@reservehub.local';

const adminPassword =

  process.env.IAM_ADMIN_PASSWORD ?? process.env.CORE_ADMIN_PASSWORD ?? 'ReserveHub1!';



async function waitOk(url, label, retries = 30, ms = 2000) {

  for (let i = 0; i < retries; i++) {

    try {

      const r = await fetch(url, { signal: AbortSignal.timeout(5000) });

      if (r.ok) {

        console.log(`OK ${label}`);

        return;

      }

    } catch {

      /* retry */

    }

    await new Promise((r) => setTimeout(r, ms));

  }

  throw new Error(`Timeout: ${label}`);

}



async function login(email, password) {

  const loginRes = await fetch(`${iam}/auth/login`, {

    method: 'POST',

    headers: { 'Content-Type': 'application/json' },

    body: JSON.stringify({ email, password }),

  });

  const loginText = await loginRes.text();

  if (!loginRes.ok) {

    throw new Error(`Login IAM failed ${loginRes.status}: ${loginText}`);

  }

  return JSON.parse(loginText);

}



async function main() {

  console.log('1) Health checks…');

  await waitOk(`${iam}/health`, 'iam');

  await waitOk(`${core}/health`, 'core');

  await waitOk(`${data}/health`, 'data');

  await waitOk(`${audit}/health`, 'audit');



  console.log('\n2) POST /auth/login (IAM)…');

  const { accessToken, refreshToken } = await login(adminEmail, adminPassword);

  if (!accessToken) {

    throw new Error('Login response missing accessToken');

  }

  console.log('   token ok (prefix):', accessToken.slice(0, 12) + '…');



  const deptName = 'Dept smoke';
  const sigla = `D${Date.now().toString(36).toUpperCase()}`;

  console.log('\n3) POST /departments (core, Bearer do IAM)…');

  const create = await fetch(`${core}/departments`, {

    method: 'POST',

    headers: {

      'Content-Type': 'application/json',

      Authorization: `Bearer ${accessToken}`,

    },

    body: JSON.stringify({ name: deptName, sigla }),

  });

  const createText = await create.text();

  if (create.status === 409) {
    console.log('   nome já existe (409) — OK para re-execução do smoke');
  } else if (!create.ok) {

    throw new Error(`Create department failed ${create.status}: ${createText}`);

  } else {

    console.log('   created:', createText.slice(0, 120) + (createText.length > 120 ? '…' : ''));
  }

  console.log('\n3b) Nome duplicado deve falhar (409)…');
  const duplicate = await fetch(`${core}/departments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      name: deptName,
      sigla: `D${Date.now().toString(36).toUpperCase()}X`,
    }),
  });
  if (duplicate.status !== 409) {
    const dupText = await duplicate.text();
    throw new Error(`Expected 409 for duplicate department name, got ${duplicate.status}: ${dupText}`);
  }
  console.log('   duplicate name → 409 OK');



  console.log('\n4) RBAC: EMPLOYEE não pode criar departamento…');

  const empLogin = await login('ana.silva@reservehub.local', adminPassword).catch(() => null);

  if (empLogin?.accessToken) {

    const forbidden = await fetch(`${core}/departments`, {

      method: 'POST',

      headers: {

        'Content-Type': 'application/json',

        Authorization: `Bearer ${empLogin.accessToken}`,

      },

      body: JSON.stringify({ name: 'Hack', sigla: `X${Date.now()}` }),

    });

    if (forbidden.status !== 403) {

      throw new Error(`Expected 403 for EMPLOYEE create dept, got ${forbidden.status}`);

    }

    console.log('   EMPLOYEE → 403 OK');

  } else {

    console.warn('   ana.silva não disponível — saltar teste RBAC');

  }



  console.log('\n5) Refresh token…');

  if (refreshToken) {

    const ref = await fetch(`${iam}/auth/refresh`, {

      method: 'POST',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify({ refreshToken }),

    });

    if (!ref.ok) {

      throw new Error(`Refresh failed ${ref.status}: ${await ref.text()}`);

    }

    console.log('   refresh OK');

  } else {

    console.warn('   sem refreshToken na resposta');

  }



  console.log('\n6) Aguardando consumo Rabbit (~3s)…');

  await new Promise((r) => setTimeout(r, 3000));



  console.log('\n7) GET /audit/events (com Bearer)…');

  const ev = await fetch(`${audit}/audit/events?limit=3`, {

    headers: { Authorization: `Bearer ${accessToken}` },

  });

  const evJson = await ev.json();

  if (!ev.ok) {

    throw new Error(`Audit failed ${ev.status}`);

  }

  const last = evJson[0];

  console.log(

    '   último routingKey:',

    last?.routingKey,

    '| eventId:',

    last?.eventId?.slice(0, 8),

  );



  console.log('\n8) GET /reservations, /resources, /departments (core)…');

  const authHeaders = { Authorization: `Bearer ${accessToken}` };

  for (const path of ['/reservations', '/resources', '/departments']) {

    const r = await fetch(`${core}${path}`, { headers: authHeaders });

    const text = await r.text();

    if (!r.ok) {

      throw new Error(`GET ${path} failed ${r.status}: ${text.slice(0, 200)}`);

    }

    const arr = JSON.parse(text);

    console.log(`   ${path}: ${Array.isArray(arr) ? arr.length : '?'} item(s)`);

  }



  console.log('\n9) GET /cards/dashboard (data, autenticado)…');

  const dash = await fetch(`${data}/cards/dashboard`, { headers: authHeaders });

  const dashJson = await dash.json();

  if (!dash.ok) {

    throw new Error(`Dashboard failed ${dash.status}`);

  }

  console.log('   departmentsActive:', dashJson.departmentsActive);



  console.log('\n10) Login gestor TI + listar reservas pendentes…');

  try {

    const { accessToken: mgrToken } = await login('gestor.ti@reservehub.local', adminPassword);

    const pending = await fetch(`${core}/reservations?status=PENDING`, {

      headers: { Authorization: `Bearer ${mgrToken}` },

    });

    const pendingJson = await pending.json();

    console.log(

      '   pendentes (gestor):',

      Array.isArray(pendingJson) ? pendingJson.length : '?',

    );

  } catch (e) {

    console.warn('   gestor TI:', e.message);

  }



  console.log('\n11) GET /reports/cost-allocation (admin)…');

  const report = await fetch(`${core}/reports/cost-allocation`, {

    headers: { Authorization: `Bearer ${accessToken}` },

  });

  if (!report.ok) {

    throw new Error(`Cost report failed ${report.status}: ${await report.text()}`);

  }

  const reportJson = await report.json();

  console.log('   linhas relatório:', Array.isArray(reportJson) ? reportJson.length : '?');



  console.log('\n12) Cancelar reserva pendente (se existir)…');

  const allRes = await fetch(`${core}/reservations`, { headers: authHeaders });

  const reservations = await allRes.json();

  const pendingOne = Array.isArray(reservations)

    ? reservations.find((r) => r.status === 'PENDING')

    : null;

  if (pendingOne) {

    const cancel = await fetch(`${core}/reservations/${pendingOne.id}/cancel`, {

      method: 'POST',

      headers: authHeaders,

    });

    if (!cancel.ok) {

      throw new Error(`Cancel failed ${cancel.status}`);

    }

    console.log('   cancel OK:', pendingOne.id.slice(0, 8));

  } else {

    console.log('   nenhuma pendente para cancelar');

  }



  console.log('\nSmoke integration concluído.');

}



main().catch((e) => {

  console.error(e);

  process.exit(1);

});

