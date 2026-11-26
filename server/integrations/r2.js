import crypto from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const EMPTY_HASH = crypto.createHash('sha256').update('').digest('hex');
const REGION = 'auto';
const SERVICE = 's3';
const MAX_SINGLE_OBJECT_BYTES = 5 * 1024 * 1024 * 1024;

const encode = (value) => encodeURIComponent(String(value)).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
const objectPath = (bucket, key = '') => `/${encode(bucket)}${key ? `/${String(key).split('/').map(encode).join('/')}` : ''}`;
const hmac = (key, value, encoding) => crypto.createHmac('sha256', key).update(value).digest(encoding);
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

function canonicalQuery(query = {}) {
  return Object.entries(query)
    .flatMap(([key, value]) => (Array.isArray(value) ? value : [value]).map((item) => [encode(key), encode(item)]))
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
}

function timestamp(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

export function signR2Request(settings, { method = 'GET', key = '', query = {}, headers = {}, payloadHash = EMPTY_HASH, now = new Date() } = {}) {
  const host = `${settings.account_id}.r2.cloudflarestorage.com`;
  const amzDate = timestamp(now);
  const date = amzDate.slice(0, 8);
  const normalizedHeaders = {
    ...Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), String(value).trim().replace(/\s+/g, ' ')])),
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
  const signedHeaders = Object.keys(normalizedHeaders).sort();
  const canonicalHeaders = signedHeaders.map((name) => `${name}:${normalizedHeaders[name]}\n`).join('');
  const queryString = canonicalQuery(query);
  const canonicalRequest = [method.toUpperCase(), objectPath(settings.bucket_name, key), queryString, canonicalHeaders, signedHeaders.join(';'), payloadHash].join('\n');
  const scope = `${date}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${hash(canonicalRequest)}`;
  const dateKey = hmac(`AWS4${settings.secret_access_key}`, date);
  const regionKey = hmac(dateKey, REGION);
  const serviceKey = hmac(regionKey, SERVICE);
  const signingKey = hmac(serviceKey, 'aws4_request');
  const signature = hmac(signingKey, stringToSign, 'hex');
  const requestHeaders = { ...normalizedHeaders };
  delete requestHeaders.host;
  requestHeaders.authorization = `AWS4-HMAC-SHA256 Credential=${settings.access_key_id}/${scope}, SignedHeaders=${signedHeaders.join(';')}, Signature=${signature}`;
  return {
    url: `https://${host}${objectPath(settings.bucket_name, key)}${queryString ? `?${queryString}` : ''}`,
    headers: requestHeaders,
    canonicalRequest,
  };
}

function xmlValue(xml, name) {
  const match = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return match?.[1]?.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'") || '';
}

function parseList(xml) {
  const objects = [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)].map((match) => ({
    key: decodeURIComponent(xmlValue(match[1], 'Key')),
    size: Number(xmlValue(match[1], 'Size')) || 0,
    last_modified: xmlValue(match[1], 'LastModified'),
  }));
  return { objects, truncated: xmlValue(xml, 'IsTruncated') === 'true', continuation_token: xmlValue(xml, 'NextContinuationToken') || null };
}

function byteLimit(maximum) {
  let received = 0;
  return new Transform({ transform(chunk, _encoding, callback) {
    received += chunk.length;
    if (received > maximum) callback(new Error('Backup exceeds the 5 GiB recovery safety limit'));
    else callback(null, chunk);
  } });
}

export function createR2Client(settings, reserveOperation = async () => {}) {
  async function request(operationClass, options, label) {
    if (operationClass) await reserveOperation(operationClass);
    const signed = signR2Request(settings, options);
    const response = await fetch(signed.url, {
      method: options.method || 'GET', headers: signed.headers, body: options.body,
      duplex: options.body ? 'half' : undefined,
      signal: AbortSignal.timeout(options.timeout || 60_000),
    });
    if (!response.ok) {
      const message = options.method === 'HEAD' ? '' : (await response.text()).slice(0, 1000);
      throw new Error(`${label} failed (${response.status})${message ? `: ${message}` : ''}`);
    }
    return response;
  }

  return {
    async test() {
      const key = `${settings.path_prefix || 'rootminster'}/.connection-test-${crypto.randomUUID()}`;
      await request('a', { method: 'PUT', key, payloadHash: EMPTY_HASH, headers: { 'content-length': '0', 'x-amz-storage-class': 'STANDARD' }, body: Buffer.alloc(0) }, 'R2 connection test');
      await request(null, { method: 'DELETE', key }, 'Cleaning up the R2 connection test');
      return true;
    },

    async put(path, key, payloadHash, metadata = {}) {
      const details = await stat(path);
      if (details.size > MAX_SINGLE_OBJECT_BYTES) throw new Error('Backup exceeds R2\'s 5 GiB single-upload limit');
      const metadataHeaders = Object.fromEntries(Object.entries(metadata).map(([name, value]) => [`x-amz-meta-${name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`, String(value)]));
      await request('a', {
        method: 'PUT', key, payloadHash, timeout: 10 * 60_000,
        headers: { ...metadataHeaders, 'content-length': String(details.size), 'content-type': 'application/octet-stream', 'x-amz-storage-class': 'STANDARD' },
        body: createReadStream(path),
      }, 'Uploading the encrypted backup to R2');
      return { key, size: details.size };
    },

    async list(prefix = settings.path_prefix || 'rootminster') {
      const objects = [];
      let continuationToken;
      do {
        const query = { 'list-type': '2', 'max-keys': '1000', prefix: `${prefix.replace(/\/+$/, '')}/`, 'encoding-type': 'url' };
        if (continuationToken) query['continuation-token'] = continuationToken;
        const response = await request('a', { method: 'GET', query, timeout: 30_000 }, 'Listing R2 backups');
        const page = parseList(await response.text());
        objects.push(...page.objects);
        continuationToken = page.truncated ? page.continuation_token : null;
      } while (continuationToken);
      return objects;
    },

    async head(key) {
      const response = await request('b', { method: 'HEAD', key, timeout: 30_000 }, 'Reading R2 backup metadata');
      return {
        size: Number(response.headers.get('content-length')) || 0,
        checksum: response.headers.get('x-amz-meta-checksum'),
        backup_id: response.headers.get('x-amz-meta-backup-id'),
        trigger: response.headers.get('x-amz-meta-trigger'),
      };
    },

    async download(key, destinationPath) {
      const response = await request('b', { method: 'GET', key, timeout: 10 * 60_000 }, 'Downloading the R2 backup');
      const length = Number(response.headers.get('content-length'));
      if (Number.isFinite(length) && length > MAX_SINGLE_OBJECT_BYTES) throw new Error('Backup exceeds the 5 GiB recovery safety limit');
      if (!response.body) throw new Error('R2 returned an empty backup');
      await pipeline(Readable.fromWeb(response.body), byteLimit(MAX_SINGLE_OBJECT_BYTES), createWriteStream(destinationPath, { flags: 'wx', mode: 0o600 }));
    },

    async stream(key) {
      const response = await request('b', { method: 'GET', key, timeout: 10 * 60_000 }, 'Downloading the R2 backup');
      const length = Number(response.headers.get('content-length'));
      if (Number.isFinite(length) && length > MAX_SINGLE_OBJECT_BYTES) throw new Error('Backup exceeds the 5 GiB recovery safety limit');
      if (!response.body) throw new Error('R2 returned an empty backup');
      return Readable.fromWeb(response.body).pipe(byteLimit(MAX_SINGLE_OBJECT_BYTES));
    },

    async delete(key) {
      await request(null, { method: 'DELETE', key, timeout: 30_000 }, 'Deleting the R2 backup');
    },
  };
}

export const r2Limits = Object.freeze({
  freeStorageBytes: 10_000_000_000,
  safeStorageBytes: 9_000_000_000,
  freeClassAOperations: 1_000_000,
  safeClassAOperations: 900_000,
  freeClassBOperations: 10_000_000,
  safeClassBOperations: 9_000_000,
  maxSingleObjectBytes: MAX_SINGLE_OBJECT_BYTES,
});
