#!/usr/bin/env ts-node
import { runLearningExtractionWorker } from './learningExtractionWorker';

runLearningExtractionWorker().catch((error) => {
  console.error('Learning extraction worker crashed:', error);
  process.exit(1);
});

