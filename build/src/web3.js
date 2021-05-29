"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deployMinistryOfEducationContract = exports.getBallotContract = exports.deployBallotContract = exports.Web3Instance = void 0;
const web3_1 = __importDefault(require("web3"));
const Ballot_json_1 = __importDefault(require("../bin/contracts/Ballot.json"));
const MinistryOfEducation_json_1 = __importDefault(require("../bin/contracts/MinistryOfEducation.json"));
//@ts-ignore
exports.Web3Instance = new web3_1.default(new web3_1.default.providers.WebsocketProvider("ws://127.0.0.1:8545"));
const deployBallotContract = async (web3Instance, candidates, publicKeyCID, deadline, addressFrom, addressWhere = undefined) => {
    const abi = Ballot_json_1.default.abi;
    const bin = Ballot_json_1.default.bytecode;
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
    }
    catch (e) {
        console.log(e);
    }
    return deployedContract;
};
exports.deployBallotContract = deployBallotContract;
const getBallotContract = (web3Instance, address) => {
    const abi = Ballot_json_1.default.abi;
    const bin = Ballot_json_1.default.bytecode;
    // @ts-ignore
    const contractInstance = new web3Instance.eth.Contract(abi);
    contractInstance.options.address = address;
    return contractInstance;
};
exports.getBallotContract = getBallotContract;
const deployMinistryOfEducationContract = async (web3Instance, competences, publicKeyCID, chairmanAddress) => {
    const abi = MinistryOfEducation_json_1.default.abi;
    const bin = MinistryOfEducation_json_1.default.bytecode;
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
exports.deployMinistryOfEducationContract = deployMinistryOfEducationContract;
