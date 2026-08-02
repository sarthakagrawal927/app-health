const entries = [
  {
    date: '2026-07-27',
    title: 'One product key can now cover multiple environments',
    outcomes: [
      'SDK and OpenTelemetry traffic can select a bounded environment while sharing one product-scoped ingest key.',
      'The dashboard switches endpoint health, installation status, and retained failures together.',
    ],
  },
  {
    date: '2026-07-25',
    title: 'Cloudflare applications gained first-party adapters',
    outcomes: [
      'Hono middleware and a Pages Functions wrapper report trusted route templates without changing application responses.',
      'Delivery stays fail-open and can continue through the platform execution context after a response is returned.',
    ],
  },
  {
    date: '2026-07-22',
    title: 'The dashboard made collection boundaries visible',
    outcomes: [
      'Operators can inspect recent retained failures and the exact fields App Health accepts for an environment.',
      'The product explains aggregate storage, retention, and the request data it never collects.',
    ],
  },
  {
    date: '2026-07-21',
    title: 'Endpoint health reached production',
    outcomes: [
      'Node, Go, and OpenTelemetry traffic can feed the same focused view of requests, latency, errors, and last-seen time.',
      'Every accepted route remains discoverable even when sampled metrics are temporarily unavailable.',
    ],
  },
];

function Brand(): JSX.Element {
  return (
    <a className="brand" href="/" aria-label="App Health home">
      <span className="brand-mark" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      App Health
    </a>
  );
}

export function Changelog(): JSX.Element {
  return (
    <div className="changelog-shell">
      <header className="changelog-topbar">
        <Brand />
        <nav aria-label="Product links">
          <a href="https://github.com/sass-maker/app-health/issues">Roadmap</a>
          <a href="https://github.com/sass-maker/app-health">Source</a>
          <a className="changelog-dashboard-link" href="/">
            Dashboard
          </a>
        </nav>
      </header>
      <main className="changelog-main">
        <div className="eyebrow">Product history</div>
        <h1>What changed, and what it means.</h1>
        <p className="changelog-lede">
          A curated record of shipped App Health outcomes. Roadmap work stays in GitHub Issues; this
          page records what operators can rely on today.
        </p>
        <ol className="changelog-list">
          {entries.map((entry) => (
            <li key={entry.date}>
              <time dateTime={entry.date}>{entry.date}</time>
              <article>
                <h2>{entry.title}</h2>
                <ul>
                  {entry.outcomes.map((outcome) => (
                    <li key={outcome}>{outcome}</li>
                  ))}
                </ul>
              </article>
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}
