// Certificate engine — issues a verifiable certificate for a completed bundle
// or learning path. PDF rendering is stubbed to a URL; the serial is verifiable.
import crypto from 'node:crypto';
import { IssuedCertificate, CertificateTemplate, User } from '../models';
import { eventBus } from '../events/eventBus';
import { EVENTS } from '../events/events';
import { emitToUser } from '../realtime/socket';

export async function issueCertificate(params: {
  userId: string;
  organizationId: string;
  templateId: string;
  sourceType: string; // MISSION_BUNDLE | LEARNING_PATH
  sourceId: string;
  data?: Record<string, unknown>;
}) {
  const { userId, organizationId, templateId, sourceType, sourceId } = params;

  // One certificate per (user, source).
  const existing = await IssuedCertificate.findOne({ where: { userId, sourceType, sourceId } });
  if (existing) return existing;

  const template = await CertificateTemplate.findByPk(templateId);
  if (!template) return null;
  const user: any = await User.findByPk(userId);

  const serial = `CERT-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
  const cert = await IssuedCertificate.create({
    organizationId,
    userId,
    templateId,
    serial,
    sourceType,
    sourceId,
    // In production a worker renders the layout to PDF and uploads to storage.
    pdfUrl: null,
    data: {
      recipient: user?.displayName || `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
      issuedAt: new Date().toISOString(),
      ...params.data,
    },
  });

  eventBus.emitSafe(EVENTS.CERTIFICATE_ISSUED, { userId, organizationId, serial });
  emitToUser(userId, 'certificate:issued', { serial, id: (cert as any).id });
  return cert;
}
