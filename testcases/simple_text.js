if ( typeof(tests) != "object" ) {
    tests = [];
}

// Global variables for the text index tests
// dictSize: number of characters in the "dictionary", number of words is 
//           dictSize - wordLength. we also use this as the number of 
//           documents in a collection but that can be changed
// wordLength: length of the "words"; all words are the same length 
//             currently but it can be changed
// wordDistance: distance between "words" in a multi-word phrase
//               A document is inserted into the database with a "phrase" 
//               that consists of numTerm "words" that are wordDistance 
//               apart from each other in the dictionary. Each word is 
//               wordLength long. By doing this, we can be sure that the 
//               "phrase queries" can have an exact match.
var language = "english"; 
const dictSize = 2400;      // total doc count is 4800 to match other mongo-perf tests
const wordLength = 5;
const wordDistance = 100;
const numTerm = 5;

// number of queries to use in query tests; idea is to spread the hits 
// across the tree
const numQuery = 50;

// ============
// Some Helper functions that are used to create the dictionary and phrases
// of fake words for the text index
// ============
// The dictionary is just a long random string. By picking fixed-sized 
// substrings from it, we have our "words"
var enPossible = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1";
var possible = enPossible;

var dictionary = "";
for (var i = 0; i<dictSize; i++) 
    dictionary += possible.charAt(Math.floor(Math.random()*possible.length));

function generatePhrase(pos, term) {
    buf="";
    for (var i=0; i<term; i++) {
        // Adding a stop word for every 3 fake words; can be modified to 
        // increase or lower the frequency 
        if ( i%3==1) {
            buf = buf.concat("the")
                }
        else {
            var p = (pos + i*wordDistance) % (dictSize - wordLength);
            buf = buf.concat(dictionary.substring(p, p+wordLength));
        }
        if (i<term) {
            buf = buf.concat(" ");
        }
    }
    return buf;
}

function generatePhraseLowerCase(pos, term) {
    var buf = generatePhrase(pos, term);
    return buf.toLowerCase();
}

// Populate the collection with phrases of fake words
function populateCollection(col, term, entry) {
    col.drop();
    col.createIndex( { x: "text"}, {default_language: language} );
    for (var i = 0; i < entry; i++) {
        col.insert({ x: generatePhrase(i, term) });
        col.insert({ x: generatePhraseLowerCase(i, term) });
    }
    col.getDB().getLastError();
}



// ============
// Generate all queries with lower case words so we can exercise the 
// caseSensitive switch
// ============

// Helper function to create oplist for single-word search
function oplistSingleWord(caseSensitive) {
    var oplist=[];
    for (var i=0; i<numQuery; i++) {
        var c = Math.floor(Math.random()*(dictSize-wordLength));
        oplist.push({
            op: "find", 
            query: {
                $text: {$search: generatePhraseLowerCase(c,1), 
                    $caseSensitive: caseSensitive }
            }
        });
    }
    return oplist;
}

/*
* Setup: Create a text-indexed collection with documents filled with fake
         words/phrase
* Test:  Run case-insensitive single-word text queries against the collection
*/
tests.push( { name: "Queries.Text.FindSingle",
            tags: ['query','text','core','indexed'],
            pre: function(collection) {
                populateCollection(collection, numTerm, dictSize);
            },
            ops: oplistSingleWord(false)
        });

/*
* Setup: Create a text-indexed collection with documents filled with fake
         words/phrase
* Test:  Run case-sensitive single-word text queries against the collection
*/
tests.push( { name: "Queries.Text.FindSingleCaseSensitive",
            tags: ['query','text','core','indexed'],
            pre: function(collection) {
                populateCollection(collection, numTerm, dictSize);
            },
            ops: oplistSingleWord(true)
        });



// Helper function to create oplist for three-word search (or)
function oplistThreeWord(caseSensitive) {
    oplist=[];
    for (var i=0; i<numQuery; i++) {
    var p = "";
    for (var j=0; j<3; j++) {
        var c = Math.floor(Math.random()*(dictSize-wordLength));
        p = p.concat(generatePhraseLowerCase(c,1), " ");
    }
    oplist.push({
        op: "find", 
        query: {$text: {$search: p, $caseSensitive: caseSensitive }
            }
        });
    }
    return oplist;
}

/*
* Setup: Create a text-indexed collection with documents filled with fake
         words/phrase
* Test:  Run case-insensitive three-words text queries against the collection
*/
tests.push( { name: "Queries.Text.FindThreeWords",
            tags: ['query','text','core','indexed'],
            pre: function(collection) {
                populateCollection(collection, numTerm, dictSize);
            },
            ops: oplistThreeWord(false)
        });

/*
* Setup: Create a text-indexed collection with documents filled with fake
         words/phrase
* Test:  Run case-sensitive three-words text queries against the collection
*/
tests.push( { name: "Queries.Text.FindThreeWordsCaseSensitive",
            tags: ['query','text','core','indexed'],
            pre: function(collection) {
                populateCollection(collection, numTerm, dictSize);
            },
            ops: oplistThreeWord(true)
        });



// Helper function to create oplist for three-word phrase search
// Be VERY careful with the escape character "\"
function oplistPhrase(caseSensitive) {
    oplist=[];
    for (var i=0; i<numQuery; i++) {
        var c = Math.floor(Math.random()*(dictSize-wordLength));
        var p = "\"";
        p = p.concat(generatePhraseLowerCase(c, numTerm), "\"");
        oplist.push({ 
            op: "find", 
            query: {
                $text: {$search: p, $caseSensitive: caseSensitive }
            }
        });
    }
    return oplist;
}

/*
* Setup: Create a text-indexed collection with documents filled with fake
         words/phrase
* Test:  Run case-insensitive phrase text queries against the collection
*/
tests.push( { name: "Queries.Text.FindPhrase",
            tags: ['query','text','core','indexed'],
            pre: function(collection) {
                populateCollection(collection, numTerm, dictSize);
            },
            ops: oplistPhrase(false)
        });

/*
* Setup: Create a text-indexed collection with documents filled with fake
         words/phrase
* Test:  Run case-sensitive phrase text queries against the collection
*/
tests.push( { name: "Queries.Text.FindPhraseCaseSensitive",
            tags: ['query','text','core','indexed'],
            pre: function(collection) {
                populateCollection(collection, numTerm, dictSize);
            },
            ops: oplistPhrase(true)
        });

