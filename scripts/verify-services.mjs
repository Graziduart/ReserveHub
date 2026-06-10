/**
 * Aguarda HTTP GET /health nos serviços core, IAM, data e audit.
 * Uso (na pasta reserveHub onde está docker-compose.yml):
 *   node scripts/verify-services.mjs
 *
 * Requer stack no ar: docker compose up -d --build
 */

const endpoints = [
  { name: 'service-core', url: 'http://127.0.0.1:3000/health' },
  { name: 'service-iam', url: 'http://127.0.0.1:3001/health' },
  { name: 'service-data', url: 'http://127.0.0.1:3002/health' },
  { name: 'service-audit', url: 'http://127.0.0.1:3003/health' },
];

async function fetchHealth(url, retries = 40, delayMs = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const text = await res.text();
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
      if (res.ok) {
        return { ok: true, status: res.status, body };
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return { ok: false, error: 'timeout ou falha repetida' };
}

async function main() {
  console.log('Verificando /health em cada serviço...\n');
  let allOk = true;
  for (const { name, url } of endpoints) {
    const result = await fetchHealth(url);
    if (result.ok) {
      console.log(`✓ ${name} (${url})`);
      console.log(`  →`, JSON.stringify(result.body));
    } else {
      allOk = false;
      console.log(`✗ ${name} (${url})`);
      console.log(`  →`, result.error ?? result);
    }
    console.log('');
  }

  if (allOk) {
    console.log('Todos os health checks passaram.');
    process.exit(0);
  }
  console.error(
    'Algum serviço não respondeu. Suba a stack: docker compose up -d --build',
  );
  process.exit(1);
}

main();
