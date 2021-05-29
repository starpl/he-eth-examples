// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.8.0 <0.9.0;

contract MinistryOfEducation {

    event SkillAssigned(address indexed personAddr);
    event PersonRegistered(address indexed personAddr);
    event PersonAssignedTo(address indexed personAddr);

    struct Person {
        string name;
        string contact;
        string skills; // CID of vector with all competences
        bool isExist;
        address[] memberOf;
    }
    struct EducationalInstitution {
        string name;
        bool isExist;
        address[] learners;
        mapping(address => bool) learnerExists;
        address from;
    }

    mapping(address => EducationalInstitution) public registry;
    mapping(address => Person) public people;
    string[] competences; // key - index in vector, value describes competence; THIS USED FOR REFERENCE
    
    address public chairman;
    string public pubKey;
   
    constructor(string memory pubKeyCID, string[] memory initialCompetences) {
        chairman = msg.sender;
        pubKey = pubKeyCID;
        for (uint i = 0; i < initialCompetences.length; i++){
            competences.push(initialCompetences[i]);
        }
    }

    function getCompetences() public view returns (string[] memory){
        return competences;
    }

    // Used to register new educational institution (from chairman)
    function registerInstitution(string memory name, address subj) public {
        require(msg.sender == chairman, "Only chairman allowed to register new educational institutions");
        require(registry[subj].isExist == false, "Alerady present in registry");
        EducationalInstitution storage r = registry[subj];
        r.name = name;
        r.isExist = true;
        r.from = subj;
        // assuming we don't need to initialize empty array of "learners" as its empty
    }
    function getLearners(address educInstAddr) public view returns (address[] memory){
        require(registry[educInstAddr].isExist == true, "Educational Institution with this address does not exist");
        return registry[educInstAddr].learners;
    }

    function registerPerson(string memory name, string memory contact, string memory initialSkills) public {
        require(people[msg.sender].isExist == false, "Person with this address alerady present");
        Person storage p = people[msg.sender];
        p.name = name;
        p.contact = contact;
        p.skills = initialSkills; // !!! prepare zero'ed array with salt at the beginning (easier than move salt further to the back)
        p.isExist = true;
        emit PersonRegistered(msg.sender);
        // same as in registerInstitution (assume array is empty)
    }
    function getMembership(address personAddr) public view returns (address[] memory){
        require(people[personAddr].isExist == true, "Person with this address does not exist");
        return people[personAddr].memberOf;
    }

    function appendLearner(address learner) public {
        require(people[learner].isExist == true, "Person with this address does not exist");
        require(registry[msg.sender].learnerExists[learner] == false, "Person alerady registered");
        registry[msg.sender].learners.push(learner);
        registry[msg.sender].learnerExists[learner] = true;
        people[learner].memberOf.push(msg.sender);
        emit PersonAssignedTo(learner);
    }


    function setSkills(address personAddr, string memory newSkillsCID) public {
        require(registry[msg.sender].isExist == true, "Entry with this educational institution does not exist");
        require(registry[msg.sender].learnerExists[personAddr] == true, "Entry with this personID does not exist");
        require(registry[msg.sender].from == msg.sender, "Can't set skills from address, other than EI's");
        Person storage p = people[personAddr];
        p.skills = newSkillsCID;
        emit SkillAssigned(personAddr);
    }
}
