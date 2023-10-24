if (typeof (tests) !== "object") {
    tests = [];
}

(function() {
"use strict";

Random.setRandomSeed(258);

// TODO SMQL: These queries need to predict the name of the collection chosen elsewhere in the test
// code. Can we improve this?
addSqlTestCase({
    name: "Empty",
    // This generates documents to be inserted into the collection, resulting in 100 documents
    // with only an _id field.
    nDocs: 100,
    docs: function(i) {
        return {};
    },
    op: {op: "sql", sqlQuery: "select * from Queries_SQL_Empty0", expected: 100},
});

/**
 * Setup: Create a large collection of large documents.
 *
 * Test: Empty query that returns all documents.
 */
for (const numDocs of [[10000, '10K'], [100000, '100K']]) {
    const collName = "Queries_SQL_Large" + numDocs[1] + "0";
    addSqlTestCase({
        name: "Large" + numDocs[1],
        nDocs: numDocs[0],
        docs: largeDoc,
        op: {op: "sql", sqlQuery: "select * from " + collName, expected: numDocs[0]},
    });
}

/**
 * Setup: Create a collection of documents with only an ObjectID _id field.
 *
 * Test: Query for a document that doesn't exist. Scans all documents using a collection scan
 * and returns no documents.
 */
addSqlTestCase({
    name: "NoMatch",
    nDocs: 100,
    docs: function(i) {
        return {};
    },
    op: {
        op: "sql",
        sqlQuery: "select * from Queries_SQL_NoMatch0 where nonexistent = 5",
        expected: 0
    },
});

// TODO SMQL: Add an idhack test case. When I tried it, the parser seemed unhappy with the
// underscore prefixing in this query:
//
// select * from Queries_SQL_IntIdFindOne0 where _id = 2400"

/**
 * Setup: Create a collection of documents with an indexed integer field x.
 *
 * TODO SMQL: The MQL version of this test chooses a random value of 'x' for each query. This
 * currently hardcodes a particular 'x' value. This could lead to less variance but differs from
 * what the equivalent MQL test does.
 */
addSqlTestCase({
    name: "IntNonIdFindOne",
    nDocs: 4800,
    docs: function(i) {
        return {x: i};
    },
    indexes: [{x: 1}],
    op: {
        op: "sql",
        sqlQuery: "select * from Queries_SQL_IntNonIdFindOne0 where x = 2400",
        expected: 1
    },
});

// TODO SMQL: Equivalent of IntIdRange.

/**
 * Setup: Create a collection of documents with indexed integer field x.
 *
 * Test: Query for all documents with x in range (50,100). All threads are returning the same
 * documents and uses index on x.
 */
addSqlTestCase({
    name: "IntNonIDRange",
    nDocs: 4800,
    docs: function(i) {
        return {x: i};
    },
    indexes: [{x: 1}],
    op: {
        op: "sql",
        sqlQuery: "select * from Queries_SQL_IntNonIDRange0 where x > 50 and x < 100",
        expected: 49
    },
});
}());
