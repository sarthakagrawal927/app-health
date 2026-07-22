import { BinaryReader, BinaryWriter, WireType } from '@bufbuild/protobuf/wire';
import { EventV1, MAX_BATCH_EVENTS, MAX_DURATION_MS } from '@app-health/contracts';
import type { EndpointEvent } from './service.js';

const SPAN_KIND_SERVER = 2;
const SAFE_RELEASE = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$/;

type AttributeValue = string | number | boolean;

interface RawSpan {
  traceId: Uint8Array;
  spanId: Uint8Array;
  kind: number;
  startNanos: bigint;
  endNanos: bigint;
  attributes: Map<string, AttributeValue>;
}

export interface OtlpProjection {
  events: EndpointEvent[];
  ignoredSpans: number;
  rejectedSpans: number;
}

export class InvalidOtlpError extends Error {}

export function otlpSuccessBody(
  contentType: 'protobuf' | 'json',
  rejectedSpans: number,
): Uint8Array | string {
  if (contentType === 'json') {
    return rejectedSpans > 0
      ? JSON.stringify({
          partialSuccess: {
            rejectedSpans: String(rejectedSpans),
            errorMessage: 'Some eligible server spans failed App Health validation.',
          },
        })
      : '{}';
  }
  const writer = new BinaryWriter();
  if (rejectedSpans > 0) {
    writer
      .tag(1, WireType.LengthDelimited)
      .fork()
      .tag(1, WireType.Varint)
      .int64(rejectedSpans)
      .tag(2, WireType.LengthDelimited)
      .string('Some eligible server spans failed App Health validation.')
      .join();
  }
  return writer.finish();
}

/** Project an OTLP ExportTraceServiceRequest without retaining its trace graph. */
export async function projectOtlpTraces(
  bytes: Uint8Array,
  contentType: 'protobuf' | 'json',
): Promise<OtlpProjection> {
  try {
    const resources =
      contentType === 'protobuf' ? parseBinaryRequest(bytes) : parseJsonRequest(bytes);
    const events: EndpointEvent[] = [];
    let ignoredSpans = 0;
    let rejectedSpans = 0;

    for (const resource of resources) {
      for (const span of resource.spans) {
        if (span.kind !== SPAN_KIND_SERVER) {
          ignoredSpans += 1;
          continue;
        }
        if (events.length >= MAX_BATCH_EVENTS) {
          rejectedSpans += 1;
          continue;
        }
        const event = await projectSpan(span, resource.release);
        if (event) events.push(event);
        else rejectedSpans += 1;
      }
    }
    return { events, ignoredSpans, rejectedSpans };
  } catch (error) {
    if (error instanceof InvalidOtlpError) throw error;
    throw new InvalidOtlpError('invalid OTLP trace request');
  }
}

async function projectSpan(span: RawSpan, resourceRelease?: string): Promise<EndpointEvent | null> {
  if (span.traceId.byteLength !== 16 || span.spanId.byteLength !== 8) return null;
  if (span.endNanos < span.startNanos) return null;
  const durationNanos = span.endNanos - span.startNanos;
  const maxDurationNanos = BigInt(MAX_DURATION_MS) * 1_000_000n;
  if (durationNanos > maxDurationNanos) return null;

  const method = attributeString(span.attributes, 'http.request.method', 'http.method');
  const route = attributeString(span.attributes, 'http.route');
  const status = attributeNumber(span.attributes, 'http.response.status_code', 'http.status_code');
  if (!method || !route || status === null) return null;

  const release =
    resourceRelease && SAFE_RELEASE.test(resourceRelease) ? resourceRelease : undefined;
  const parsed = EventV1.safeParse({
    event_id: await deterministicEventId(span.traceId, span.spanId),
    timestamp: Number(span.endNanos / 1_000_000n),
    method,
    route,
    status_code: status,
    duration_ms: Number((durationNanos + 500_000n) / 1_000_000n),
    ...(release ? { release } : {}),
  });
  if (!parsed.success || /[?#\s]/.test(parsed.data.route)) return null;
  return { ...parsed.data, upstream_sampled: true };
}

function attributeString(
  attributes: ReadonlyMap<string, AttributeValue>,
  ...names: string[]
): string | null {
  for (const name of names) {
    const value = attributes.get(name);
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return null;
}

function attributeNumber(
  attributes: ReadonlyMap<string, AttributeValue>,
  ...names: string[]
): number | null {
  for (const name of names) {
    const value = attributes.get(name);
    if (typeof value === 'number' && Number.isSafeInteger(value)) return value;
    if (typeof value === 'string' && /^\d{3}$/.test(value)) return Number(value);
  }
  return null;
}

async function deterministicEventId(traceId: Uint8Array, spanId: Uint8Array): Promise<string> {
  const input = new Uint8Array(traceId.byteLength + spanId.byteLength);
  input.set(traceId);
  input.set(spanId, traceId.byteLength);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', input));
  const bytes = digest.slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

interface ResourceSpans {
  release?: string;
  spans: RawSpan[];
}

function parseBinaryRequest(bytes: Uint8Array): ResourceSpans[] {
  const reader = new BinaryReader(bytes);
  const resources: ResourceSpans[] = [];
  while (reader.pos < reader.len) {
    const [field, wire] = reader.tag();
    if (field === 1 && wire === WireType.LengthDelimited) {
      resources.push(parseBinaryResourceSpans(reader.bytes()));
    } else {
      reader.skip(wire, field);
    }
  }
  return resources;
}

function parseBinaryResourceSpans(bytes: Uint8Array): ResourceSpans {
  const reader = new BinaryReader(bytes);
  let release: string | undefined;
  const scopePayloads: Uint8Array[] = [];
  while (reader.pos < reader.len) {
    const [field, wire] = reader.tag();
    if (field === 1 && wire === WireType.LengthDelimited) {
      release = parseBinaryResource(reader.bytes());
    } else if (field === 2 && wire === WireType.LengthDelimited) {
      scopePayloads.push(reader.bytes());
    } else {
      reader.skip(wire, field);
    }
  }
  return { release, spans: scopePayloads.flatMap(parseBinaryScopeSpans) };
}

function parseBinaryResource(bytes: Uint8Array): string | undefined {
  const reader = new BinaryReader(bytes);
  let release: string | undefined;
  while (reader.pos < reader.len) {
    const [field, wire] = reader.tag();
    if (field === 1 && wire === WireType.LengthDelimited) {
      const attribute = parseBinaryKeyValue(reader.bytes());
      if (attribute?.[0] === 'service.version' && typeof attribute[1] === 'string') {
        release = attribute[1];
      }
    } else {
      reader.skip(wire, field);
    }
  }
  return release;
}

function parseBinaryScopeSpans(bytes: Uint8Array): RawSpan[] {
  const reader = new BinaryReader(bytes);
  const spans: RawSpan[] = [];
  while (reader.pos < reader.len) {
    const [field, wire] = reader.tag();
    if (field === 2 && wire === WireType.LengthDelimited) {
      spans.push(parseBinarySpan(reader.bytes()));
    } else {
      reader.skip(wire, field);
    }
  }
  return spans;
}

function parseBinarySpan(bytes: Uint8Array): RawSpan {
  const reader = new BinaryReader(bytes);
  const span: RawSpan = {
    traceId: new Uint8Array(),
    spanId: new Uint8Array(),
    kind: 0,
    startNanos: 0n,
    endNanos: 0n,
    attributes: new Map(),
  };
  while (reader.pos < reader.len) {
    const [field, wire] = reader.tag();
    if (field === 1 && wire === WireType.LengthDelimited) span.traceId = reader.bytes();
    else if (field === 2 && wire === WireType.LengthDelimited) span.spanId = reader.bytes();
    else if (field === 6 && wire === WireType.Varint) span.kind = reader.int32();
    else if (field === 7 && wire === WireType.Bit64) span.startNanos = BigInt(reader.fixed64());
    else if (field === 8 && wire === WireType.Bit64) span.endNanos = BigInt(reader.fixed64());
    else if (field === 9 && wire === WireType.LengthDelimited) {
      const attribute = parseBinaryKeyValue(reader.bytes());
      if (attribute) span.attributes.set(attribute[0], attribute[1]);
    } else reader.skip(wire, field);
  }
  return span;
}

function parseBinaryKeyValue(bytes: Uint8Array): [string, AttributeValue] | null {
  const reader = new BinaryReader(bytes);
  let key = '';
  let value: AttributeValue | undefined;
  while (reader.pos < reader.len) {
    const [field, wire] = reader.tag();
    if (field === 1 && wire === WireType.LengthDelimited) key = reader.string(true);
    else if (field === 2 && wire === WireType.LengthDelimited) {
      value = parseBinaryAnyValue(reader.bytes());
    } else reader.skip(wire, field);
  }
  return key && value !== undefined ? [key, value] : null;
}

function parseBinaryAnyValue(bytes: Uint8Array): AttributeValue | undefined {
  const reader = new BinaryReader(bytes);
  let value: AttributeValue | undefined;
  while (reader.pos < reader.len) {
    const [field, wire] = reader.tag();
    if (field === 1 && wire === WireType.LengthDelimited) value = reader.string(true);
    else if (field === 2 && wire === WireType.Varint) value = reader.bool();
    else if (field === 3 && wire === WireType.Varint) {
      const integer = BigInt(reader.int64());
      if (
        integer <= BigInt(Number.MAX_SAFE_INTEGER) &&
        integer >= BigInt(Number.MIN_SAFE_INTEGER)
      ) {
        value = Number(integer);
      }
    } else if (field === 4 && wire === WireType.Bit64) value = reader.double();
    else reader.skip(wire, field);
  }
  return value;
}

function parseJsonRequest(bytes: Uint8Array): ResourceSpans[] {
  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes));
  } catch {
    throw new InvalidOtlpError('invalid OTLP JSON');
  }
  const root = record(payload);
  const resources = array(root?.resourceSpans ?? root?.resource_spans);
  return resources.map((entry) => {
    const resourceSpans = record(entry);
    const resource = record(resourceSpans?.resource);
    const resourceAttributes = parseJsonAttributes(resource?.attributes);
    const releaseValue = resourceAttributes.get('service.version');
    const release = typeof releaseValue === 'string' ? releaseValue : undefined;
    const scopes = array(resourceSpans?.scopeSpans ?? resourceSpans?.scope_spans);
    const spans = scopes.flatMap((scope) => {
      const scopeRecord = record(scope);
      return array(scopeRecord?.spans).map(parseJsonSpan);
    });
    return { release, spans };
  });
}

function parseJsonSpan(value: unknown): RawSpan {
  const span = record(value);
  return {
    traceId: decodeJsonId(span?.traceId ?? span?.trace_id, 16),
    spanId: decodeJsonId(span?.spanId ?? span?.span_id, 8),
    kind: spanKind(span?.kind),
    startNanos: unsignedBigInt(span?.startTimeUnixNano ?? span?.start_time_unix_nano),
    endNanos: unsignedBigInt(span?.endTimeUnixNano ?? span?.end_time_unix_nano),
    attributes: parseJsonAttributes(span?.attributes),
  };
}

function parseJsonAttributes(value: unknown): Map<string, AttributeValue> {
  const attributes = new Map<string, AttributeValue>();
  for (const entry of array(value)) {
    const keyValue = record(entry);
    if (typeof keyValue?.key !== 'string') continue;
    const anyValue = record(keyValue.value);
    if (!anyValue) continue;
    const stringValue = anyValue.stringValue ?? anyValue.string_value;
    if (typeof stringValue === 'string') {
      attributes.set(keyValue.key, stringValue);
      continue;
    }
    const intValue = anyValue.intValue ?? anyValue.int_value;
    const integer = finiteInteger(intValue);
    if (integer !== null) {
      attributes.set(keyValue.key, integer);
      continue;
    }
    const scalar =
      anyValue.doubleValue ?? anyValue.double_value ?? anyValue.boolValue ?? anyValue.bool_value;
    if (typeof scalar === 'number' || typeof scalar === 'boolean') {
      attributes.set(keyValue.key, scalar);
    }
  }
  return attributes;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function finiteInteger(value: unknown): number | null {
  const number = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  return typeof number === 'number' && Number.isSafeInteger(number) ? number : null;
}

function spanKind(value: unknown): number {
  if (value === 'SPAN_KIND_SERVER') return SPAN_KIND_SERVER;
  return finiteInteger(value) ?? 0;
}

function unsignedBigInt(value: unknown): bigint {
  if (typeof value === 'bigint' && value >= 0n) return value;
  if ((typeof value === 'string' && /^\d+$/.test(value)) || Number.isSafeInteger(value)) {
    return BigInt(value as string | number);
  }
  return 0n;
}

function decodeJsonId(value: unknown, expectedBytes: number): Uint8Array {
  if (typeof value !== 'string') return new Uint8Array();
  if (new RegExp(`^[0-9a-fA-F]{${expectedBytes * 2}}$`).test(value)) {
    return Uint8Array.from(value.match(/.{2}/g) ?? [], (pair) => Number.parseInt(pair, 16));
  }
  try {
    const decoded = Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
    return decoded.byteLength === expectedBytes ? decoded : new Uint8Array();
  } catch {
    return new Uint8Array();
  }
}
