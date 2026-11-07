const notFound = (req, res) => res.status(404).json({ error: 'Not found' });

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err.name === 'MulterError') return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Photo must be under 5 MB' : err.message });
  const status = err.status || 500;
  if (status >= 500) {
    console.error(JSON.stringify({
      level: 'error',
      requestId: res.locals.requestId,
      method: req.method,
      path: req.path,
      status,
      message: err.message,
      stack: err.stack
    }));
  }
  const body = { error: status >= 500 ? 'Internal server error' : err.message };
  if (status >= 500 && res.locals.requestId) body.requestId = res.locals.requestId;
  res.status(status).json(body);
}

module.exports = { notFound, errorHandler };
