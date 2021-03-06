import { IPFS } from "ipfs";
import Web3 from "web3";
import CompiledBallotContract from "../bin/contracts/Ballot.json";
import readline from "readline";
import { getBatchFileCat, getNode } from "./ipfs";
import {
    Bit,
    createDefaultContext,
    createSkillsVector,
    createKeys,
    createUtilFunctions,
    encryptVote,
    getSealInstance,
    getWinner,
    sumVotes,
} from "./seal";
import {
    deployBallotContract,
    deployMinistryOfEducationContract,
    getBallotContract,
    Web3Instance,
} from "./web3";
import { createHash } from "crypto";
import { CipherText } from "node-seal/implementation/cipher-text";
import { BatchEncoder } from "node-seal/implementation/batch-encoder";
import { Encryptor } from "node-seal/implementation/encryptor";
import { SEALLibrary } from "node-seal/implementation/seal";

const createNewBallot = async (
    node: IPFS,
    Web3Instance: Web3,
    candidates: string[],
    publicKey: string,
    chairman: string,
    untilTo: number
) => {
    const CID = (
        await node.add({
            content: publicKey,
        })
    ).cid.toString();
    const deployed = await deployBallotContract(Web3Instance, candidates, CID, untilTo, chairman);
    return { CID, deployed };
};

let cast: {
    chairman: string;
    [id: string]: string;
};

const voters: string[] = [];

const authorize = async (contract: any, id: number) => {
    // stub
    const hash = createHash("sha256").update(id.toString()).digest("base64");
    if (hash in voters) {
        throw new Error("Alerady allowed to vote");
    }
    const index = `voter${id}`;
    const result = await contract.methods
        .giveRightToVote(cast[index], hash)
        .send({ from: cast.chairman, gas: 400000 });
    voters.push(hash);
    console.log("=========================");
    console.log(`Voter ${cast[index]} with Hash ID of ${hash} allowed to vote!`);
    console.log("=========================\n\n");
};

const vote = async (
    contract: any,
    node: IPFS,
    seal: SEALLibrary,
    addressOfVoter: string,
    encoder: BatchEncoder,
    encryptor: Encryptor
) => {
    // check if lengths of voteVector and candidatesVector (from contract) are equal
    const result: string[] = (
        await contract.methods.getAvailableChoices().call({
            from: addressOfVoter,
        })
    ).map((val: string) => val[0]);

    // choose random index\
    const randIndex = Math.round(Math.random() * (result.length - 1));

    // generate vote vector
    const voteVector = result.map((val, index) => (index === randIndex ? 1 : 0));

    // encrypt vote vector
    const encryptedVote = encryptVote(seal, voteVector as Bit[], encoder, encryptor);

    // send vote to IPFS
    const { cid, path, size } = await node.add({
        content: encryptedVote.save(),
    });

    // write to contract
    await contract.methods.vote(cid.toString()).send({
        from: addressOfVoter,
        gas: 400000,
    });
    // const arr = await contract.methods.getVotes().call({
    //     from: addressOfVoter
    // });

    console.log("=========================");
    console.log(`Voter ${addressOfVoter} voted!\n`);
    console.log(`CID: ${cid}`);
    console.log(`Encrypted filesize in IPFS: ${size}\n`);
    console.log(`inputs: ${result}`);
    console.log(`selectedBit: ${randIndex}`);
    console.log(`vote: ${voteVector}`);
    console.log("=========================\n\n");
};

const sleep = (time: number) => {
    return new Promise((res) => {
        setTimeout(res, time);
    });
};

export type Scripts = "voting" | "search";
interface Person {
    name: string;
    contact: string;
    skills: string;
    addr: string;
    membershipIn: string[];
}

type AvailableCompetences = "MATHS" | "PROGRAMMING" | "DESIGN" | "ART" | "MUSIC" | "LAW";

type SearchEngineCompetences = {
    [competence in AvailableCompetences]: Set<number>;
};

type SearchEnginePeopleDB = {
    people: Person[];
    indexes: {
        [addr: string]: number;
    };
};

export const executeScenario = (scenario: Scripts) => {
    switch (scenario) {
        case "search":
            getNode().then(async (node) => {
                // Initialize libs
                const web3 = Web3Instance;
                const seal = await getSealInstance();
                const accounts = await web3.eth.getAccounts();
                const SEC: SearchEngineCompetences = {
                    MATHS: new Set(),
                    PROGRAMMING: new Set(),
                    DESIGN: new Set(),
                    ART: new Set(),
                    MUSIC: new Set(),
                    LAW: new Set(),
                };
                const SEP: SearchEnginePeopleDB = {
                    people: [],
                    indexes: {},
                };
                // Helper functions
                const loadToIPFS = async (data: string) => {
                    const CID = (
                        await node.add({
                            content: data,
                        })
                    ).cid.toString();
                    return CID;
                };

                // Create SEAL variables
                const context = createDefaultContext(seal);
                const keys = createKeys(seal, context);
                const { batchEncoder, decryptor, encryptor, evaluator } = createUtilFunctions(
                    seal,
                    context,
                    keys.publicKey,
                    keys.secretKey
                );
                // Define competences among all educational
                const competences = [
                    "MATHS",
                    "PROGRAMMING",
                    "DESIGN",
                    "ART",
                    "MUSIC",
                    "LAW",
                ] as const;

                // Prepare actors
                const chairman = accounts[0];
                const educInsts = [accounts[1], accounts[2]];
                const people: Person[] = await Promise.all(
                    accounts.slice(3).map(async (addr, index) => {
                        const encEmptySkills = createSkillsVector(
                            seal,
                            batchEncoder,
                            encryptor,
                            Uint32Array.from(Array(competences.length))
                        );
                        const cid = await loadToIPFS(encEmptySkills.save());
                        return {
                            name: `Person ${index}`,
                            contact: `+${Array.from(Array(11), () =>
                                Math.round(Math.random() * 9).toString()
                            ).reduce((acc, curr) => acc + curr, "")}`,

                            skills: cid,
                            addr,
                            membershipIn: [],
                        };
                    })
                );

                // Send PubKey to IPFS
                const pubKeyCID = (
                    await node.add({
                        content: keys.publicKey.save(),
                    })
                ).cid.toString();

                // Deploy MinistryOfEducation
                const deployed = await deployMinistryOfEducationContract(
                    web3,
                    competences,
                    pubKeyCID,
                    chairman
                );

                // Watch for events
                const getPersonInfo = async (addr: string, decr = true) => {
                    const response = await deployed.methods.people(addr).call();
                    const person: Partial<Person> = {
                        name: response.name,
                        contact: response.contact,
                        addr,
                        skills: response.skills,
                    };
                    if (decr) {
                        const encSkills = (await getBatchFileCat(node, [response.skills]))[0];
                        const cipher = seal.CipherText();
                        const plain = seal.PlainText();
                        cipher.load(context, encSkills);
                        decryptor.decrypt(cipher, plain);
                        person.skills = batchEncoder
                            .decode(plain)
                            .slice(0, competences.length)
                            .toString();
                    }
                    person.membershipIn = await deployed.methods.getMembership(addr).call();
                    return person as Person;
                };
                deployed.events.SkillAssigned(undefined, async (error: any, event: any) => {
                    const info = await getPersonInfo(event.returnValues[0]);
                    // console.log({ info });
                    const oldSkills = SEP.people[SEP.indexes[info.addr]].skills
                        .split(",")
                        .map((val) => parseInt(val));
                    const newSkills = info.skills.split(",").map((val) => parseInt(val));
                    const diff = newSkills.map((val, i) => val - oldSkills[i]);

                    for (let i = 0; i < diff.length; i++) {
                        if (diff[i] > 0) {
                            SEC[competences[i]].add(SEP.indexes[info.addr]);
                        }
                    }
                    SEP.people[SEP.indexes[info.addr]] = info;
                });
                deployed.events.PersonRegistered(undefined, async (error: any, event: any) => {
                    const info = await getPersonInfo(event.returnValues[0]);
                    const nl = SEP.people.push(info);
                    SEP.indexes[info.addr] = nl - 1;
                });
                deployed.events.PersonAssignedTo(undefined, async (error: any, event: any) => {
                    const info = await getPersonInfo(event.returnValues[0]);
                    SEP.people[SEP.indexes[info.addr]].membershipIn = info.membershipIn;
                });

                // Register educational institutions
                const registerEI = async ({ addr, name }: { addr: string; name: string }) => {
                    await deployed.methods.registerInstitution(name, addr).send({
                        from: chairman,
                        gas: 400000,
                    });
                    console.log("======EDUCATIONAL INSTITUTION REGISTRATION======");
                    console.log(`NAME: ${name}`);
                    console.log(`ADDRESS: ${addr}`);
                    console.log("================================================\n");
                };

                await Promise.all(
                    [
                        {
                            addr: educInsts[0],
                            name: "EducationalInstitution1",
                        },
                        {
                            addr: educInsts[1],
                            name: "EducationalInstitution2",
                        },
                    ].map(registerEI)
                );

                // Register people
                const registerPeople = async (person: Person) => {
                    await deployed.methods
                        .registerPerson(person.name, person.contact, person.skills)
                        .send({
                            from: person.addr,
                            gas: 400000,
                        });
                    console.log("==============PERSON REGISTRATION================");
                    console.log(`NAME: ${person.name}`);
                    console.log(`CONTACT: ${person.contact}`);
                    console.log(`ADDRESS: ${person.addr}`);
                    console.log(`SKILLS CID: ${person.skills}`);
                    console.log("=================================================\n");
                };
                await Promise.all(people.map(registerPeople));

                await sleep(1500);

                // Append people to learners
                const distribution = {
                    toFirst: people.slice(0, 5),
                    toSecond: people.slice(2),
                };
                const appendTo = async (addrOfEI: string, whoToAppend: string) => {
                    await deployed.methods.appendLearner(whoToAppend).send({
                        from: addrOfEI,
                        gas: 400000,
                    });
                    console.log(`Person ${whoToAppend} appended to ${addrOfEI}\n`);
                };
                await Promise.all(
                    distribution.toFirst.map((person) => appendTo(educInsts[0], person.addr))
                );
                await Promise.all(
                    distribution.toSecond.map((person) => appendTo(educInsts[1], person.addr))
                );

                // Select students to be excluded from graduation
                let graduates = await Promise.all(
                    people.map(async (person) => ({
                        ...person,
                        membershipIn: await deployed.methods.getMembership(person.addr).call({
                            from: chairman,
                        }),
                    }))
                );

                // Graduate selected
                console.log(
                    `===================================GRADUATE=========================================\n`
                );

                for (let i = 0; i < 20; i++) {
                    const index = Math.round(Math.random() * (graduates.length - 1));
                    const grad = await getPersonInfo(SEP.people[index].addr, false);
                    console.log(`Graduating ${grad.name}`);
                    const selectedCompetence = Math.round(Math.random() * (competences.length - 1)); // index
                    const rating = Math.round(Math.random() * 4) + 1; // 1 to 5
                    console.log(
                        `Selected competence: ${competences[selectedCompetence]}(${selectedCompetence}) with rating of ${rating}`
                    );
                    const encryptedSkills = seal.CipherText({
                        context,
                    });
                    encryptedSkills.load(context, (await getBatchFileCat(node, [grad.skills]))[0]);
                    const computeSkills = Uint32Array.from(
                        Array(competences.length),
                        (val, index) => {
                            if (index === selectedCompetence) {
                                return rating;
                            }
                            return 0;
                        }
                    );
                    const newSkills = createSkillsVector(
                        seal,
                        batchEncoder,
                        encryptor,
                        computeSkills
                    );
                    const result = seal.CipherText({
                        context,
                    });
                    evaluator.add(encryptedSkills, newSkills, result);
                    // FOR DEBUG
                    // const decOld = seal.PlainText();
                    // decryptor.decrypt(encryptedSkills, decOld);
                    // const decNew = seal.PlainText();
                    // decryptor.decrypt(newSkills, decNew);
                    // const decRes = seal.PlainText();
                    // decryptor.decrypt(result, decRes);
                    // console.log({
                    //     Old: batchEncoder.decode(decOld).slice(0, competences.length),
                    //     New: batchEncoder.decode(decNew).slice(0, competences.length),
                    //     Res: batchEncoder.decode(decRes).slice(0, competences.length),
                    // });
                    //
                    const cid = await loadToIPFS(result.save());
                    const getEI =
                        grad.membershipIn[
                            Math.round(Math.random() * (grad.membershipIn.length - 1))
                        ];
                    await deployed.methods.setSkills(grad.addr, cid).send({
                        from: getEI,
                    });
                    await sleep(500);
                }
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout,
                });
                const askForCompetence = async () => {
                    await sleep(500);
                    rl.question(`\nSelect from ${competences}:`, function (name) {
                        const val = competences.find((c) => c === name);
                        const ind = competences.findIndex((c) => c === name);
                        if (val) {
                            console.log(
                                [...SEC[val]]
                                    .map((personIndex) => ({
                                        ...SEP.people[personIndex],
                                        skills: SEP.people[personIndex].skills.split(",")[ind],
                                    }))
                                    .sort((a, b) => parseInt(b.skills) - parseInt(a.skills))
                            );
                        } else {
                            console.log("Input is not in the list");
                        }
                        askForCompetence();
                    });
                };
                askForCompetence();
            });
            break;
        case "voting":
            getNode().then(async (node) => {
                const web3 = Web3Instance;
                const seal = await getSealInstance();
                const accounts = await web3.eth.getAccounts();
                cast = {
                    chairman: accounts[0].toString(),
                    voter1: accounts[1],
                    voter2: accounts[2],
                    voter3: accounts[3],
                    voter4: accounts[4],
                    voter5: accounts[5],
                    voter6: accounts[6],
                    voter7: accounts[7],
                    voter8: accounts[8],
                    voter9: accounts[9],
                };

                const context = createDefaultContext(seal);
                const keys = createKeys(seal, context);
                const { batchEncoder, decryptor, encryptor, evaluator } = createUtilFunctions(
                    seal,
                    context,
                    keys.publicKey,
                    keys.secretKey
                );

                const candidates = ["TYPESCRIPT", "JAVA", "REACTNATIVE", "LINUX", "DIFF_EQUATIONS"];

                // CREATE NEW
                const { deployed, CID } = await createNewBallot(
                    node,
                    web3,
                    candidates,
                    keys.publicKey.save(),
                    cast.chairman,
                    Math.floor(Date.now() / 1000) + 86400
                );
                console.log("=========================");
                console.log("Ballot deployed!");
                console.log(`New ballot's public key CID: ${CID}`);
                console.log(`New ballot's address: ${deployed?.options.address}`);
                console.log(`Chairman: ${cast.chairman}`);
                console.log("=========================\n\n");

                // OR USE EXISTING
                // const restored = getBallotContract(
                //     Web3Instance,
                //     "0xe86f9cad35f714b4fdccfb6a9f8bc664359cb0a9"
                // );
                // console.log(restored.options.address);

                // deployed?.methods
                //     .publicKeyCID()
                //     .call(
                //         { from: "0x61474d450817a925393fcb10ffb4169c35ef3aa1" },
                //         (error: any, result: any) => {
                //             console.log({ error, result });
                //         }
                //     );

                const allowedToVote = Object.values(cast).slice(1);

                // autorize voters
                await Promise.all(
                    allowedToVote.map(
                        async (address, index) => await authorize(deployed, index + 1)
                    )
                );
                console.log("\n============All voters registered!============\n");

                // make voters vote
                console.log("\n============Start Voting!============\n");
                await Promise.all(
                    allowedToVote.map(async (address) => {
                        await vote(deployed, node, seal, address, batchEncoder, encryptor);
                    })
                );
                console.log("============All the votes were sent!============\n\n");

                // gather encrypted votes and apply sum
                console.log("============Collecting and counting votes...============");
                const result = (
                    await deployed?.methods.getVotes().call({
                        from: cast.chairman,
                    })
                ).map((val: any) => val[0]);
                console.log(result);

                const encVotes = await getBatchFileCat(node, result);
                const sum = sumVotes(seal, encVotes, evaluator, context);
                const winner = getWinner(seal, sum, batchEncoder, decryptor);
                console.log(`===========RESULTS:=============`);
                console.log(`Candidates: ${candidates.toString()}`);
                console.log(`Result vector: ${winner.slice(0, candidates.length)}`);
                let maxIndex = 0;
                let maxVal = 0;
                winner.slice(0, candidates.length).map((val: number, index: number) => {
                    if (val > maxVal) {
                        (maxVal = val), (maxIndex = index);
                    }
                    return val;
                });

                await deployed?.methods.endVoting(candidates[maxIndex]).send({
                    from: cast.chairman,
                    gas: 400000,
                });
                console.log(`WINNER: ${candidates[maxIndex]}`);
            });
            break;
        default:
            console.log('Only "voting" and "search" are available');
            return;
    }
};
