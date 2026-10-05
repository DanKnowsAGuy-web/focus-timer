// Overlay entry for youtube.com.
// Phase 0: prove the content script runs. Later phases add declutter, tabs,
// controls and the jar through this entry.
import { markReady } from '../lib/ready.js';

markReady(document, 'youtube');
