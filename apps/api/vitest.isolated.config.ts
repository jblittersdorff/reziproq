import { apiProject, isolatedTests } from './vitest.config.js';

// API-Tests, die Module mit vi.mock ersetzen; jede Datei lädt ihre Module neu. Die Testdatenbank
// legt der globale Setup des Projekts api an.
export default apiProject({ name: 'api-isolated', include: isolatedTests, isolate: true });
