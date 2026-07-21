// Express adapter for @saas-maker/app-health.
// Import from `@saas-maker/app-health/express` so the framework-neutral core
// remains usable without Express.

export { expressMiddleware } from './middleware.js';
export type { ExpressMiddlewareOptions } from './middleware.js';
