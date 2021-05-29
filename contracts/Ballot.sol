// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.8.0 <0.9.0;

contract Ballot {
   
    struct Voter {
        uint weight; // weight is accumulated by delegation // переделать на bool
        bool voted;  // if true, that person already voted
        uint voteIndex;   // index of the voted proposal
        string id; // hash of id of a person
    }
    
    // Информация о голосе (т.е. например, имя кандидата)
    struct Choice {
        string name;
    }

    // Голос, хранит ссылку на CID зашифрованного вектора с голосом и адрес голосовавшего в маппинге voters
    struct Vote {
        string CID;
        address voterAddress;
    }

    address public chairperson;
    string public winner;
    string public publicKeyCID;
    // string public secretKeyCID; // used after to verify results, but with it could lose anonymity
    uint public untilTo;
    bool public isActive;

    mapping(address => Voter) public voters;

    Choice[] public choices;
    Vote[] public votes;

    constructor(string[] memory choicesNames, string memory keyCID, uint deadline) {
        chairperson = msg.sender;
        voters[chairperson].weight = 1;
        publicKeyCID = keyCID;
        for (uint i = 0; i < choicesNames.length; i++) {
            choices.push(Choice({
                name: choicesNames[i]
            }));
        }
        untilTo = deadline;
        isActive = true;
    }

    modifier onlyWhenAvailable {
      require(block.timestamp < untilTo, "Too late to vote");
      require(isActive == true, "Ballot is not available");
      _;
    }

    function getAvailableChoices() public view returns(Choice[] memory) {
        return choices;
    }

    function getVotes() public view returns(Vote[] memory) {
        return votes;
    }
    
    function giveRightToVote(address voter, string memory id) onlyWhenAvailable public {
        require(
            msg.sender == chairperson,
            "Only chairperson can give right to vote."
        );
        require(
            !voters[voter].voted,
            "The voter already voted."
        );
        require(voters[voter].weight == 0, 'The voter alerady can vote');
        voters[voter].weight = 1;
        voters[voter].id = id;
    }

    function vote(string memory CID) onlyWhenAvailable public {
        Voter storage sender = voters[msg.sender];
        require(sender.weight != 0, "Has no right to vote");
        require(!sender.voted, "Already voted.");
        require(bytes(CID).length != 0, "Empty CID");
        sender.voted = true;
        sender.voteIndex = votes.length + 1;
        votes.push(Vote({
            CID: CID,
            voterAddress: msg.sender
        }));
    }

    function endVoting(string memory mostVoted) onlyWhenAvailable public {
        require(msg.sender == chairperson, "Only chairperson can end vote");
        winner = mostVoted;
        // secretKeyCID = privateKeyCID;
        isActive = false;
    }
}
