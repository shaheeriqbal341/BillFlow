const errorHandler = (err, req, res, next) => {
  console.error(err);

  let statusCode = Number(err.statusCode) || 500;
  let message = statusCode >= 500 ? 'Internal server error' : err.message || 'Request failed';

  if (err.code === 11000) {
    statusCode = 409;
    message = 'A record with the same unique value already exists';
  } else if (err.name === 'ValidationError' || err.name === 'CastError') {
    statusCode = 400;
    message = 'The supplied data is invalid';
  }

  res.status(statusCode).json({ success: false, message });
};

module.exports = errorHandler;
