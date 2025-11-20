#!/usr/bin/env ts-node
import { runSanitizationWorker } from './sanitizationWorker';

runSanitizationWorker().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Sanitization worker exited unexpectedly:', error);
  process.exit(1);
});

