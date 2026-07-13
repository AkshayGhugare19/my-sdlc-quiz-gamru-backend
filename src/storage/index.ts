// Pluggable object storage. 'local' writes to disk and serves via /uploads
// (dev default, no Docker/MinIO). 's3' targets AWS S3 or any S3-compatible API.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export interface StoredObject {
  key: string;
  url: string;
  size: number;
  mimeType?: string;
}

export interface StorageDriver {
  put(buffer: Buffer, opts: { filename: string; mimeType?: string; folder?: string }): Promise<StoredObject>;
  remove(key: string): Promise<void>;
}

function safeName(filename: string) {
  const ext = path.extname(filename);
  const base = crypto.randomBytes(12).toString('hex');
  return `${base}${ext}`;
}

class LocalStorage implements StorageDriver {
  private root = path.resolve(process.cwd(), env.storage.localDir);

  async put(buffer: Buffer, opts: { filename: string; mimeType?: string; folder?: string }) {
    const folder = opts.folder ?? 'general';
    const dir = path.join(this.root, folder);
    fs.mkdirSync(dir, { recursive: true });
    const key = `${folder}/${safeName(opts.filename)}`;
    fs.writeFileSync(path.join(this.root, key), buffer);
    return {
      key,
      url: `${env.publicUrl}/uploads/${key}`,
      size: buffer.length,
      mimeType: opts.mimeType,
    };
  }

  async remove(key: string) {
    const file = path.join(this.root, key);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
}

class S3Storage implements StorageDriver {
  private client: any;
  private S3: any;

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    this.S3 = require('@aws-sdk/client-s3');
    this.client = new this.S3.S3Client({
      region: env.storage.s3.region,
      endpoint: env.storage.s3.endpoint || undefined,
      forcePathStyle: env.storage.s3.forcePathStyle,
      credentials: env.storage.s3.accessKey
        ? { accessKeyId: env.storage.s3.accessKey, secretAccessKey: env.storage.s3.secretKey }
        : undefined,
    });
  }

  async put(buffer: Buffer, opts: { filename: string; mimeType?: string; folder?: string }) {
    const folder = opts.folder ?? 'general';
    const key = `${folder}/${safeName(opts.filename)}`;
    await this.client.send(
      new this.S3.PutObjectCommand({
        Bucket: env.storage.s3.bucket,
        Key: key,
        Body: buffer,
        ContentType: opts.mimeType,
      }),
    );
    const base = env.storage.s3.publicUrl || `${env.storage.s3.endpoint}/${env.storage.s3.bucket}`;
    return { key, url: `${base}/${key}`, size: buffer.length, mimeType: opts.mimeType };
  }

  async remove(key: string) {
    await this.client.send(new this.S3.DeleteObjectCommand({ Bucket: env.storage.s3.bucket, Key: key }));
  }
}

export const storage: StorageDriver = env.storage.driver === 's3' ? new S3Storage() : new LocalStorage();

logger.info(`Storage driver: ${env.storage.driver}`);
