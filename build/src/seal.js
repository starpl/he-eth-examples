"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSkillsVector = exports.getWinner = exports.sumVotes = exports.encryptVote = exports.createUtilFunctions = exports.createKeys = exports.createDefaultContext = exports.getSealInstance = void 0;
const node_seal_1 = __importDefault(require("node-seal"));
const prepareSeal = node_seal_1.default();
const getSealInstance = async () => {
    const seal = await prepareSeal;
    return seal;
};
exports.getSealInstance = getSealInstance;
const createDefaultContext = (seal) => {
    // Create a new EncryptionParameters
    const schemeType = seal.SchemeType.bfv;
    const securityLevel = seal.SecurityLevel.tc128;
    const polyModulusDegree = 4096;
    const bitSizes = [36, 36, 37];
    const bitSize = 20;
    const encParms = seal.EncryptionParameters(schemeType);
    // Assign Poly Modulus Degree
    encParms.setPolyModulusDegree(polyModulusDegree);
    // Create a suitable set of CoeffModulus primes
    encParms.setCoeffModulus(seal.CoeffModulus.Create(polyModulusDegree, Int32Array.from(bitSizes)));
    // Assign a PlainModulus (only for bfv scheme type)
    encParms.setPlainModulus(seal.PlainModulus.Batching(polyModulusDegree, bitSize));
    ////////////////////////
    // Context
    ////////////////////////
    // Create a new Context
    const context = seal.Context(encParms, true, securityLevel);
    // Helper to check if the Context was created successfully
    if (!context.parametersSet()) {
        throw new Error("Could not set the parameters in the given context. Please try different encryption parameters.");
    }
    return context;
};
exports.createDefaultContext = createDefaultContext;
const createKeys = (seal, context) => {
    // Create a new KeyGenerator (use uploaded keys if applicable)
    const keyGenerator = seal.KeyGenerator(context);
    return {
        publicKey: keyGenerator.createPublicKey(),
        secretKey: keyGenerator.secretKey(),
        relinKey: keyGenerator.createRelinKeys(),
        galoisKey: keyGenerator.createGaloisKeys(),
    };
};
exports.createKeys = createKeys;
const createUtilFunctions = (seal, context, pk, sk) => {
    // Create an Evaluator
    const evaluator = seal.Evaluator(context);
    // Create a BatchEncoder (only bfv SchemeType)
    const batchEncoder = seal.BatchEncoder(context);
    // Create an Encryptor
    const encryptor = seal.Encryptor(context, pk);
    // Create a Decryptor
    const decryptor = seal.Decryptor(context, sk);
    return {
        evaluator,
        batchEncoder,
        encryptor,
        decryptor,
    };
};
exports.createUtilFunctions = createUtilFunctions;
const encryptVote = (seal, voteVector, encoder, encryptor) => {
    const plain = seal.PlainText();
    const cipher = seal.CipherText();
    encoder.encode(Uint32Array.from([...voteVector, Math.floor(Math.random() * 1000) + 1]), plain);
    encryptor.encrypt(plain, cipher);
    return cipher;
};
exports.encryptVote = encryptVote;
const sumVotes = (seal, votes, evaluator, context) => {
    if (votes.length < 2) {
        throw new Error("Nothing to add");
    }
    let result = seal.CipherText({
        context,
    });
    let first = seal.CipherText();
    first.load(context, votes[0]);
    let second = seal.CipherText();
    second.load(context, votes[1]);
    evaluator.add(first, second, result);
    for (let i = 2; i < votes.length; i++) {
        const val = seal.CipherText();
        val.load(context, votes[i]);
        evaluator.add(result, val, result);
    }
    return result;
};
exports.sumVotes = sumVotes;
const getWinner = (seal, sumOfVotes, batchEncoder, decryptor) => {
    const plain = seal.PlainText();
    decryptor.decrypt(sumOfVotes, plain);
    return batchEncoder.decode(plain, false);
};
exports.getWinner = getWinner;
const createSkillsVector = (seal, batchEncoder, encryptor, values) => {
    const plain = seal.PlainText();
    const result = seal.CipherText();
    batchEncoder.encode(Uint32Array.from([...values]), plain);
    encryptor.encrypt(plain, result);
    return result;
};
exports.createSkillsVector = createSkillsVector;
