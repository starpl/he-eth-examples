import { PublicKey } from "node-seal/implementation/public-key";
import Web3 from "web3";
import CompiledBallotContract from "../bin/contracts/Ballot.json";
import CompiledMinEduContract from "../bin/contracts/MinistryOfEducation.json";

//@ts-ignore
export const Web3Instance = new Web3(new Web3.providers.WebsocketProvider("ws://127.0.0.1:8545"));

export const deployBallotContract = async (
    web3Instance: Web3,
    candidates: string[],
    publicKeyCID: string,
    deadline: number,
    addressFrom: string,
    addressWhere: string | undefined = undefined
) => {
    const abi = CompiledBallotContract.abi;
    const bin = CompiledBallotContract.bytecode;
    // @ts-ignore
    const contractInstance = new web3Instance.eth.Contract(abi, addressWhere, {
        from: addressFrom,
        data: bin,
    });
    let deployedContract;
    try {
        deployedContract = await contractInstance
            .deploy({
                data: bin,
                arguments: [candidates, publicKeyCID, deadline],
            })
            .send({
                from: addressFrom,
                gas: 4000000,
                gasPrice: "2000000",
            });
    } catch (e) {
        console.log(e);
    }
    return deployedContract;
};

export const getBallotContract = (web3Instance: Web3, address: string) => {
    const abi = CompiledBallotContract.abi;
    const bin = CompiledBallotContract.bytecode;
    // @ts-ignore
    const contractInstance = new web3Instance.eth.Contract(abi);
    contractInstance.options.address = address;
    return contractInstance;
};

export const deployMinistryOfEducationContract = async (
    web3Instance: Web3,
    competences: readonly string[],
    publicKeyCID: string,
    chairmanAddress: string
) => {
    const abi = CompiledMinEduContract.abi;
    const bin = CompiledMinEduContract.bytecode;
    // @ts-ignore
    const contractInstance = new web3Instance.eth.Contract(abi, undefined, {
        from: chairmanAddress,
        data: bin,
    });
    const deployedContract = await contractInstance
        .deploy({
            data: bin,
            arguments: [publicKeyCID, competences],
        })
        .send({
            from: chairmanAddress,
            gas: 4000000,
            gasPrice: "2000000",
        });
    console.log("===============MINISTRY DEPLOY==================");
    console.log(`ADDRESS: ${deployedContract.options.address}`);
    console.log(`PUBKEY CID: ${publicKeyCID}`);
    console.log(`COMPETENCES: ${competences.toString()}`);
    console.log(`CHAIRMAN: ${chairmanAddress}`);
    console.log("================================================\n");

    return deployedContract;
};
