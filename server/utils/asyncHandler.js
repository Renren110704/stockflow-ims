// Wraps an async route handler so any thrown error / rejected promise
// is forwarded to Express's error-handling middleware instead of
// crashing the process or requiring try/catch in every controller.
export default function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
