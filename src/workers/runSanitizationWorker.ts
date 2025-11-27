#!/usr/bin/env ts-node
import { runSanitizationWorker } from './sanitizationWorker';

runSanitizationWorker().catch((error) => {
   
  console.error('Sanitization worker exited unexpectedly:', error);
  process.exit(1);
});

