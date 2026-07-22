import { describe, expect, it } from 'vitest';
import { BinaryWriter, WireType } from '@bufbuild/protobuf/wire';
import { otlpSuccessBody, projectOtlpTraces } from '../src/otlp.js';

const NOW_NANOS = 1_725_000_000_000_000_000n;

function nested(writer: BinaryWriter, field: number, write: (message: BinaryWriter) => void): void {
  writer.tag(field, WireType.LengthDelimited).fork();
  write(writer);
  writer.join();
}

function attribute(writer: BinaryWriter, key: string, value: string | number): void {
  nested(writer, 9, (keyValue) => {
    keyValue.tag(1, WireType.LengthDelimited).string(key);
    nested(keyValue, 2, (anyValue) => {
      if (typeof value === 'number') anyValue.tag(3, WireType.Varint).int64(value);
      else anyValue.tag(1, WireType.LengthDelimited).string(value);
    });
  });
}

function binaryTrace(): Uint8Array {
  const writer = new BinaryWriter();
  nested(writer, 1, (resourceSpans) => {
    nested(resourceSpans, 1, (resource) => {
      nested(resource, 1, (keyValue) => {
        keyValue.tag(1, WireType.LengthDelimited).string('service.version');
        nested(keyValue, 2, (anyValue) => {
          anyValue.tag(1, WireType.LengthDelimited).string('2026.07.22');
        });
      });
    });
    nested(resourceSpans, 2, (scopeSpans) => {
      nested(scopeSpans, 2, (span) => {
        span.tag(1, WireType.LengthDelimited).bytes(Uint8Array.from({ length: 16 }, (_, i) => i));
        span
          .tag(2, WireType.LengthDelimited)
          .bytes(Uint8Array.from({ length: 8 }, (_, i) => i + 16));
        span.tag(6, WireType.Varint).int32(2);
        span.tag(7, WireType.Bit64).fixed64(NOW_NANOS - 125_000_000n);
        span.tag(8, WireType.Bit64).fixed64(NOW_NANOS);
        attribute(span, 'http.request.method', 'GET');
        attribute(span, 'http.route', '/users/:id');
        attribute(span, 'http.response.status_code', 503);
        attribute(span, 'url.path', '/users/alice-private');
        attribute(span, 'enduser.id', 'alice@example.com');
      });
    });
  });
  return writer.finish();
}

function jsonTrace(overrides: Record<string, unknown> = {}): Uint8Array {
  const span = {
    traceId: '000102030405060708090a0b0c0d0e0f',
    spanId: '1011121314151617',
    kind: 2,
    startTimeUnixNano: String(NOW_NANOS - 50_000_000n),
    endTimeUnixNano: String(NOW_NANOS),
    attributes: [
      { key: 'http.method', value: { stringValue: 'post' } },
      { key: 'http.route', value: { stringValue: '/orders/:id' } },
      { key: 'http.status_code', value: { intValue: '201' } },
    ],
    ...overrides,
  };
  return new TextEncoder().encode(
    JSON.stringify({
      resourceSpans: [
        {
          resource: {
            attributes: [{ key: 'service.version', value: { stringValue: 'release-1' } }],
          },
          scopeSpans: [{ spans: [span] }],
        },
      ],
    }),
  );
}

describe('OTLP trace projection', () => {
  it('decodes binary protobuf and retains only the endpoint summary allowlist', async () => {
    const projection = await projectOtlpTraces(binaryTrace(), 'protobuf');
    expect(projection).toMatchObject({ rejectedSpans: 0, ignoredSpans: 0 });
    expect(projection.events).toHaveLength(1);
    expect(projection.events[0]).toMatchObject({
      method: 'GET',
      route: '/users/:id',
      status_code: 503,
      duration_ms: 125,
      timestamp: 1_725_000_000_000,
      release: '2026.07.22',
      upstream_sampled: true,
    });
    const serialized = JSON.stringify(projection.events[0]);
    expect(serialized).not.toMatch(/alice|email|url\.path|trace|span/i);
  });

  it('accepts standard OTLP JSON enum names and legacy HTTP semantic attributes', async () => {
    const projection = await projectOtlpTraces(jsonTrace({ kind: 'SPAN_KIND_SERVER' }), 'json');
    expect(projection.events[0]).toMatchObject({
      method: 'POST',
      route: '/orders/:id',
      status_code: 201,
      duration_ms: 50,
      release: 'release-1',
      upstream_sampled: true,
    });
  });

  it('prefers stable attributes when stable and legacy names coexist', async () => {
    const projection = await projectOtlpTraces(
      jsonTrace({
        attributes: [
          { key: 'http.method', value: { stringValue: 'POST' } },
          { key: 'http.request.method', value: { stringValue: 'PATCH' } },
          { key: 'http.route', value: { stringValue: '/orders/:id' } },
          { key: 'http.status_code', value: { intValue: '201' } },
          { key: 'http.response.status_code', value: { intValue: '204' } },
        ],
      }),
      'json',
    );
    expect(projection.events[0]).toMatchObject({ method: 'PATCH', status_code: 204 });
  });

  it('ignores non-server spans and rejects server spans without a trusted route', async () => {
    const client = await projectOtlpTraces(jsonTrace({ kind: 3 }), 'json');
    expect(client).toMatchObject({ events: [], ignoredSpans: 1, rejectedSpans: 0 });
    const noRoute = await projectOtlpTraces(
      jsonTrace({
        attributes: [
          { key: 'http.request.method', value: { stringValue: 'GET' } },
          { key: 'http.response.status_code', value: { intValue: '200' } },
          { key: 'url.path', value: { stringValue: '/users/alice-private' } },
        ],
      }),
      'json',
    );
    expect(noRoute).toMatchObject({ events: [], ignoredSpans: 0, rejectedSpans: 1 });
  });

  it('derives a retry-stable event ID', async () => {
    const first = await projectOtlpTraces(binaryTrace(), 'protobuf');
    const second = await projectOtlpTraces(binaryTrace(), 'protobuf');
    expect(first.events[0].event_id).toBe(second.events[0].event_id);
  });

  it('caps projected work at the endpoint batch limit', async () => {
    const payload = JSON.parse(new TextDecoder().decode(jsonTrace())) as {
      resourceSpans: { scopeSpans: { spans: Record<string, unknown>[] }[] }[];
    };
    const base = payload.resourceSpans[0].scopeSpans[0].spans[0];
    payload.resourceSpans[0].scopeSpans[0].spans = Array.from({ length: 1001 }, (_, index) => ({
      ...base,
      spanId: index.toString(16).padStart(16, '0'),
    }));
    const projection = await projectOtlpTraces(
      new TextEncoder().encode(JSON.stringify(payload)),
      'json',
    );
    expect(projection.events).toHaveLength(1000);
    expect(projection.rejectedSpans).toBe(1);
  });

  it('returns protocol-shaped empty and partial-success bodies', () => {
    expect(otlpSuccessBody('json', 0)).toBe('{}');
    expect(String(otlpSuccessBody('json', 2))).toContain('rejectedSpans');
    expect((otlpSuccessBody('protobuf', 0) as Uint8Array).byteLength).toBe(0);
    expect((otlpSuccessBody('protobuf', 2) as Uint8Array).byteLength).toBeGreaterThan(0);
  });
});
