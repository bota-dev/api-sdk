import { checkLicenses } from '../../scripts/check-licenses.mjs';
import { workspaceRoot } from './workspace.mjs';
const result = await checkLicenses(workspaceRoot);
console.log(`Verified ${result.packages} locked workspace dependency manifests`);
