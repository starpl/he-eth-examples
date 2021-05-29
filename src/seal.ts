import SEAL from "node-seal";
import { BatchEncoder } from "node-seal/implementation/batch-encoder";
import { CipherText } from "node-seal/implementation/cipher-text";
import { Context } from "node-seal/implementation/context";
import { Decryptor } from "node-seal/implementation/decryptor";
import { Encryptor } from "node-seal/implementation/encryptor";
import { Evaluator } from "node-seal/implementation/evaluator";
import { PublicKey } from "node-seal/implementation/public-key";
import { SEALLibrary } from "node-seal/implementation/seal";
import { SecretKey } from "node-seal/implementation/secret-key";

const prepareSeal = SEAL();
export const getSealInstance = async () => {
    const seal = await prepareSeal;
    return seal;
};

export const createDefaultContext = (seal: SEALLibrary) => {
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
    encParms.setCoeffModulus(
        seal.CoeffModulus.Create(polyModulusDegree, Int32Array.from(bitSizes))
    );

    // Assign a PlainModulus (only for bfv scheme type)
    encParms.setPlainModulus(seal.PlainModulus.Batching(polyModulusDegree, bitSize));

    ////////////////////////
    // Context
    ////////////////////////

    // Create a new Context
    const context = seal.Context(encParms, true, securityLevel);

    // Helper to check if the Context was created successfully
    if (!context.parametersSet()) {
        throw new Error(
            "Could not set the parameters in the given context. Please try different encryption parameters."
        );
    }
    return context;
};

export const createKeys = (seal: SEALLibrary, context: Context) => {
    // Create a new KeyGenerator (use uploaded keys if applicable)
    const keyGenerator = seal.KeyGenerator(context);
    return {
        publicKey: keyGenerator.createPublicKey(),
        secretKey: keyGenerator.secretKey(),
        relinKey: keyGenerator.createRelinKeys(),
        galoisKey: keyGenerator.createGaloisKeys(),
    };
};

export const createUtilFunctions = (
    seal: SEALLibrary,
    context: Context,
    pk: PublicKey,
    sk: SecretKey
) => {
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

export type Bit = 1 | 0;

export const encryptVote = (
    seal: SEALLibrary,
    voteVector: Bit[],
    encoder: BatchEncoder,
    encryptor: Encryptor
) => {
    const plain = seal.PlainText();
    const cipher = seal.CipherText();
    encoder.encode(Uint32Array.from([...voteVector, Math.floor(Math.random() * 1000) + 1]), plain);
    encryptor.encrypt(plain, cipher);
    return cipher;
};

export const sumVotes = (
    seal: SEALLibrary,
    votes: string[],
    evaluator: Evaluator,
    context: Context
) => {
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

export const getWinner = (
    seal: SEALLibrary,
    sumOfVotes: CipherText,
    batchEncoder: BatchEncoder,
    decryptor: Decryptor
) => {
    const plain = seal.PlainText();
    decryptor.decrypt(sumOfVotes, plain);
    return batchEncoder.decode(plain, false);
};

export const createSkillsVector = (
    seal: SEALLibrary,
    batchEncoder: BatchEncoder,
    encryptor: Encryptor,
    values: Uint32Array
) => {
    const plain = seal.PlainText();
    const result = seal.CipherText();
    batchEncoder.encode(Uint32Array.from([...values]), plain);
    encryptor.encrypt(plain, result);
    return result;
};
