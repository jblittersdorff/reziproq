import { isolatedTests, webProject } from './vitest.config.js';

// Web-Tests, die eigene Module mit eigenem Zustand ersetzen; jede Datei lädt ihre Module neu.
export default webProject({ name: 'web-isolated', include: isolatedTests, isolate: true });
