// Public surface of @airlink/core — the shared business logic used by apps/web
// (v1) and apps/mcp-server (phase 2). Keep ALL validation, audit and
// soft-delete rules in here so every entry point behaves identically.

export * from './types';
export * from './itemTypes';
export * from './items';
export * from './transfers';
export * from './list';
export * from './audit';
export * from './branches';
export * from './employees';
export * from './admin';
export { getDb, configureCore } from './db';
