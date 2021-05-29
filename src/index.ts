import { executeScenario, Scripts } from "./client";

const scenario: Scripts = process.argv.slice(2)[0] as Scripts;
executeScenario(scenario);
