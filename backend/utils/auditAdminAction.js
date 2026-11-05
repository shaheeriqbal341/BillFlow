const AdminAuditLog = require('../models/AdminAuditLog');

async function auditAdminAction(req, action, targetType, targetId, details = {}) {
  return AdminAuditLog.create({
    actorId: req.user._id,
    action,
    targetType,
    targetId: targetId || null,
    details,
    ipAddress: req.ip || '',
  });
}

module.exports = auditAdminAction;
