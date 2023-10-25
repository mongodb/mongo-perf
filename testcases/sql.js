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

/**
 * Convert a list of $in values into the appropriate string for an SQL where clause. For example,
 * the array [2, "foo"] would be converted to in(2, "foo").
 */
function constructInClause(inArray) {
    // Add quotes explicitly around strings so that they appear quoted in the output. The SQL parser
    // seems to require single quotes rather than double quotes.
    inArray = inArray.map(x => typeof x === "string" ? `'${x}'` : x);
    return "x in(" + inArray.join(", ") + ")";
}

function constructInQuery(testName, inArray) {
    const collName = "Queries_SQL_" + testName + "0";
    return "select * from " + collName + " where " + constructInClause(inArray);
}

/**
 * Adds two string test cases for an in() query: One a small collection, and another on a
 * large collection.
 */
function addStringInTestCases({name, inArray}) {
    for (const [nameSuffix, size] of [["", 10], ["BigCollection", 10000]]) {
        const collName = "Queries_SQL_" + name + nameSuffix + "0";
        const sqlQuery =
            "select * from " + collName + " where " + constructInClause(inArray) + " order by x";
        addSqlTestCase({
            name: name + nameSuffix,
            nDocs: size,
            docs: function(i) {
                return {x: i.toString()};
            },
            op: {op: "sql", sqlQuery}
        });
    }
}

addStringInTestCases({
    name: "StringUnindexedInPredWithSimpleCollation",
    inArray: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
});

/**
 * Setup: Same as above.
 *
 * Test: Issue same queries as above, but with large array of strings as in() argument.
 */
const nLargeArrayElements = 1000;
const largeStringInArray = [];
for (let i = 0; i < nLargeArrayElements; i++) {
    largeStringInArray.push(Random.randInt(nLargeArrayElements).toString());
}
addStringInTestCases({
    name: "StringUnindexedLargeInPredWithSimpleCollation",
    inArray: largeStringInArray,
});

/**
 * Large arrays used for in() queries in the subsequent test cases.
 */
var largeArrayRandom = [];
for (var i = 0; i < nLargeArrayElements; i++) {
    largeArrayRandom.push(Random.randInt(nLargeArrayElements));
}

var largeArraySorted = [];
for (var i = 0; i < nLargeArrayElements; i++) {
    largeArraySorted.push(i * 2);
}

/**
 * Adds two test cases for an in() query: One a small collection with a in() filter that
 * includes every document, and another on a larger collection with a selective in() filter.
 */
function addInTestCases({name, largeInArray}) {
    // Setup: Create a collection and insert a small number of documents with a random even
    // integer field x in the range [0, nLargeArrayElements * 2).
    //
    // Test: Issue queries that must perform a collection scan, filtering the documents with an
    // in() predicate with a large number of elements.
    addSqlTestCase({
        name: name,
        nDocs: 10,
        docs: function(i) {
            return {x: 2 * Random.randInt(largeInArray.length)};
        },
        op: {op: "sql", sqlQuery: constructInQuery(name, largeInArray)}
    });

    // Similar test to above, but with a larger collection. Only a small fraction (10%)
    // of the documents will actually match the filter.
    addSqlTestCase({
        name: name + "BigCollection",
        nDocs: 10000,
        docs: function(i) {
            return {x: 2 * Random.randInt(largeInArray.length * 10)};
        },
        op: {op: "sql", sqlQuery: constructInQuery(name + "BigCollection", largeInArray)}
    });
};

addInTestCases({
    name: "UnindexedLargeInMatching",
    largeInArray: largeArraySorted,
});

addInTestCases({
    name: "UnindexedLargeInUnsortedMatching",
    largeInArray: largeArrayRandom,
});

/**
 * Repeat the same test as above, increasing the number of elements in the $in array to 10000.
 */
var nVeryLargeArrayElements = 10000;
var veryLargeArrayRandom = [];
for (var i = 0; i < nVeryLargeArrayElements; i++) {
    veryLargeArrayRandom.push(Random.randInt(nVeryLargeArrayElements));
}

var veryLargeArraySorted = [];
for (var i = 0; i < nVeryLargeArrayElements; i++) {
    veryLargeArraySorted.push(i * 2);
}

addInTestCases({
    name: "UnindexedVeryLargeInSortedMatching",
    largeInArray: veryLargeArraySorted,
});

addInTestCases({
    name: "UnindexedVeryLargeInUnsortedMatching",
    largeInArray: veryLargeArrayRandom,
});

/**
 * Setup: Create a collection and insert a small number of documents with a random odd integer
 * field x in the range [0, 2000).
 *
 * Test: Issue queries that must perform a collection scan, filtering the documents with an in()
 * predicate with a large number of elements. No documents will match the predicate, since the
 * in() array contains all even integers in the range [0, 2000).
 */
addSqlTestCase({
    name: "UnindexedLargeInNonMatching",
    nDocs: 10,
    docs: function (i) {
        return {x: 2 * Random.randInt(1000) + 1};
    },
    op: {
        op: "sql",
        sqlQuery: constructInQuery("UnindexedLargeInNonMatching", largeArraySorted),
        expected: 0
    }
});

/**
 * Repeat the same test as above, except using the $in array of unsorted elements.
 */
addSqlTestCase({
    name: "UnindexedLargeInUnsortedNonMatching",
    nDocs: 10,
    docs: function (i) {
        return {x: 2 * Random.randInt(1000) + 1};
    },
    op: {
        op: "sql",
        sqlQuery: constructInQuery("UnindexedLargeInUnsortedNonMatching", largeArrayRandom)
    }
});
}());
