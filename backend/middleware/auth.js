const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = req.cookies?.token || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(503).json({ success: false, message: 'Authentication is not configured' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }

  try {
    const user = await User.findById(decoded.id).populate('businessId');

    if (!user || user.status !== 'active') {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    if (['business_owner', 'staff'].includes(user.role) && !user.businessId) {
      return res.status(403).json({ success: false, message: 'This account has no business workspace' });
    }

    if (
      user.role !== 'super_admin' &&
      user.businessId &&
      user.businessId.status === 'suspended'
    ) {
      return res.status(403).json({ success: false, message: 'This business workspace is suspended' });
    }

    req.user = user;
    req.businessId = user.businessId?._id || user.businessId;
    return next();
  } catch (error) {
    return next(error);
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'You do not have access to this resource' });
  }
  next();
};

module.exports = { protect, requireRole };
