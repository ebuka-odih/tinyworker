import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Reuse the same API implementation as dev.
import './index';

// NOTE: server/index.ts starts its own listener, so prod.ts is currently unused.
// We'll keep a single server file approach instead of duplicating listeners.

// (placeholder)
console.log('prod.ts placeholder');
