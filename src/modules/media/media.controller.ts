import type { Request, Response } from 'express';
import { ok, created } from '../../utils/responseHandler';
import { AppError } from '../../utils/AppError';
import { currentOrgId } from '../../tenancy/context';
import { storage } from '../../storage';
import { Media } from '../../models';

const TYPE_BY_MIME: Record<string, string> = {
  'video/': 'VIDEO',
  'image/': 'IMAGE',
  'audio/': 'AUDIO',
  'application/pdf': 'PDF',
};

function inferType(mime = '') {
  if (mime === 'application/pdf') return 'PDF';
  for (const prefix of Object.keys(TYPE_BY_MIME)) if (mime.startsWith(prefix)) return TYPE_BY_MIME[prefix];
  return 'DOCUMENT';
}

// POST /api/media (multipart: file + title)
export async function upload(req: Request, res: Response) {
  const file = (req as any).file;
  if (!file) throw AppError.badRequest('No file uploaded');

  // Media rows belong to an organization. Tenant users always have one bound;
  // a super admin must "act as" an organization first (org switcher) so the
  // upload lands in a tenant's library instead of failing on the NOT NULL.
  const organizationId = currentOrgId();
  if (!organizationId) {
    throw AppError.badRequest('Select an organization first (use the organization switcher) — media belongs to an organization.');
  }

  const stored = await storage.put(file.buffer, {
    filename: file.originalname,
    mimeType: file.mimetype,
    folder: organizationId,
  });

  const media = await Media.create({
    organizationId,
    type: req.body.type || inferType(file.mimetype),
    title: req.body.title || file.originalname,
    description: req.body.description,
    storageKey: stored.key,
    url: stored.url,
    mimeType: file.mimetype,
    sizeBytes: stored.size,
    createdById: req.user!.id,
  });
  return created(res, media, 'Uploaded');
}

// GET /api/media
export async function list(req: Request, res: Response) {
  const where: any = {};
  if (req.query.type) where.type = req.query.type;
  // Scope the library to the active organization (super admins with no acting
  // org still see everything, matching the rest of the admin console).
  const organizationId = currentOrgId();
  if (organizationId) where.organizationId = organizationId;
  const items = await Media.findAll({ where, order: [['created_at', 'DESC']], limit: 200 });
  return ok(res, items);
}

// DELETE /api/media/:id
export async function remove(req: Request, res: Response) {
  const media: any = await Media.findByPk(req.params.id);
  if (!media) throw AppError.notFound();
  await storage.remove(media.storageKey).catch(() => undefined);
  await media.destroy();
  return ok(res, null, 'Deleted');
}
