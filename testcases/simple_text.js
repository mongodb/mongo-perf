if ( typeof(tests) != "object" ) {
    tests = [];
}


(function () {
    'use strict';
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
    var dictSize = 2400;      // total doc count is 4800 to match other mongo-perf tests
    var wordLength = 5;
    var wordDistance = 100;
    var numTerm = 5;

    // number of queries to use in query tests; idea is to spread the hits
    // across the tree
    var numQuery = 50;

    // ============
    // Some Helper functions that are used to create the dictionary and phrases
    // of fake words for the text index
    // ============
    // The dictionary is just a long random string. By picking fixed-sized
    // substrings from it, we have our "words"
    var enPossible = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1";
    var possible = enPossible;

    var dictionary = "";
    Random.srand(13141517);
    for (var i = 0; i<dictSize; i++)
        dictionary += possible.charAt(Random.randInt(possible.length));

    function generatePhrase(pos, term) {
        var buf="";
        for (var i=0; i<term; i++) {
            // Adding a stop word for every 3 fake words; can be modified to
            // increase or lower the frequency
            if ( i%3==1) {
                buf = buf.concat("the");
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
        var docs = [];
        for (var i = 0; i < entry; i++) {
            docs.push({ x: generatePhrase(i, term) });
            docs.push({ x: generatePhraseLowerCase(i, term) });
        }
        col.insert(docs);
    }



    // ============
    // Generate all queries with lower case words so we can exercise the
    // caseSensitive switch
    // ============

    // Helper function to create oplist for single-word search
    function oplistSingleWord(caseSensitive) {
        var oplist=[];
        Random.srand(13141517);
        for (var i=0; i<numQuery; i++) {
            var c = Random.randInt(dictSize-wordLength);
            var phrase = generatePhraseLowerCase(c,1);
            if (caseSensitive) {
                oplist.push({
                    op: "find",
                    query: {
                        $text: {$search: phrase,
                                $caseSensitive: caseSensitive }}});
            }
            else { // don't include the $caseSensitive part of the query if it's the default value (false)
                oplist.push({
                    op: "find",
                    query: {
                        $text: {$search: phrase}}});
            }
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
     * Setup: Create a text-indexed collection with large documents filled with
     fake words/phrase
     * Test:  Run case-insensitive single-word text queries against the collection
     *
     * Regression test for SERVER-21690. This test is a duplicate of Queries.Text.FindSingle, except that
     * each document inserted is given 'dictSize' terms instead of 'numTerm' terms. This makes most
     * queries in this test return ~900 large documents; in the other tests in this file, queries usually
     * return <15 small documents.
     */
    tests.push( { name: "Queries.Text.FindSingleLargeDocuments",
                  tags: ['query','text','core','indexed'],
                  pre: function(collection) {
                      populateCollection(collection, dictSize, dictSize);
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
        var oplist=[];
        Random.srand(13141517);
        for (var i=0; i<numQuery; i++) {
            var p = "";
            for (var j=0; j<3; j++) {
                var c = Random.randInt(dictSize-wordLength);
                p = p.concat(generatePhraseLowerCase(c,1), " ");
            }
            if (caseSensitive) {
                oplist.push({
                    op: "find",
                    query: {$text: {$search: p, $caseSensitive: caseSensitive }
                           }
                });
            }
            else {
                oplist.push({
                    op: "find",
                    query: {$text: {$search: p}
                           }
                });
            }
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
        var oplist=[];
        Random.srand(13141517);
        for (var i=0; i<numQuery; i++) {
            var c = Random.randInt(dictSize-wordLength);
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

})();
