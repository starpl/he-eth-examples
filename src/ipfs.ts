import IPFSManager, { IPFS } from "ipfs";
import { CipherText } from "node-seal/implementation/cipher-text";
const prepareNode = IPFSManager.create();

export const getNode = async () => {
    const node = await prepareNode;
    return node;
};

export const getBatchFileCat = async (
    node: IPFS,
    data: string[]
): Promise<string[]> => {
    const result = await Promise.all(
        data.map(async (CID) => {
            const stream = node.cat(CID);
            let data = "";
            for await (const chunk of stream) {
                data += chunk.toString();
            }
            return data;
        })
    );
    return result;
};
