"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("./client");
const scenario = process.argv.slice(2)[0];
client_1.executeScenario(scenario);
