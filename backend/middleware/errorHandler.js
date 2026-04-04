function errorHandler(err, req, res, next) {
  const status = err.statusCode || 500
  console.error(`[ERROR] ${req.method} ${req.url} — ${err.message}\n${err.stack}`)

  const response = { error: err.message }
  if (process.env.NODE_ENV === 'development') response.stack = err.stack

  res.status(status).json(response)
}

module.exports = errorHandler
