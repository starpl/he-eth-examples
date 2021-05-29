"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBatchFileCat = exports.getNode = void 0;
const ipfs_1 = __importDefault(require("ipfs"));
const prepareNode = ipfs_1.default.create();
const getNode = async () => {
    const node = await prepareNode;
    return node;
};
exports.getNode = getNode;
const getBatchFileCat = async (node, data) => {
    const result = await Promise.all(data.map(async (CID) => {
        const stream = node.cat(CID);
        let data = "";
        for await (const chunk of stream) {
            data += chunk.toString();
        }
        return data;
    }));
    return result;
};
exports.getBatchFileCat = getBatchFileCat;
