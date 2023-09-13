/**
 * Additional tie breaking heuristics perfomance tests:
 * - index prefix heuristic
 * - docsExamined heuristic
 */

if (typeof (tests) != "object") {
    tests = [];
}

(function() {
'use strict';

// Generate documents for testing the index prefix heuristics.
const indexPrefixDocs = [];
for (let i = 0; i < 10000; ++i) {
    // Matchable documents.
    indexPrefixDocs.push({a: 1, b: "hello", c: i % 5, d: 111 * i - 100, e: i, h: i});

    // Non-matchable documents.
    for (let j = 0; j < 10; ++j) {
        indexPrefixDocs.push(
            {a: i + (j + 1) * 1000, b: `tie%{i}_%{j}`, c: i % 5, d: -i, e: i + 1000, h: i});
}
}

const docsExaminedDocs = [];
// Adding more than 101 documents to make sure we don't hit EOF.
for (let i = 0; i < 200; ++i) {
    docsExaminedDocs.push({i: i, a: "Jerry", b: "not mouse", c: "Tom", d: "degu"});
}
// Some additional payload data.
for (let i = 0; i < 1100; ++i) {
    docsExaminedDocs.push({i: i + 1000, a: "Jerry", b: "mouse", c: "Tom", d: "degu"});
}

const perfCases = [
    {
        name: "Longest Index Prefix",
        indexes: [{a: 1}, {b: 1, a: 1}],
        query: {a: {$gte: 1}, b: "hello"},
        docs: indexPrefixDocs,
    },
    {
        name: "Equality",
        indexes: [{a: 1, b: 1}, {b: 1, a: 1}],
        query: {a: {$gt: 0}, b: "hello"},
        docs: indexPrefixDocs,
    },
    {
        name: "Shortest Index",
        indexes: [{a: 1, b: 1, c: 1}, {b: 1, a: 1}],
        query: {a: 1, b: "hello"},
        docs: indexPrefixDocs,
    },
    {
        name: "Shortest Index With Comparisons",
        indexes: [{a: 1, b: 1, c: 1}, {a: 1, b: 1}],
        query: {a: {$gt: 1}, b: "hello"},
        docs: indexPrefixDocs,
    },
    {
        name: "Not Broken Tie",
        indexes: [{a: 1, b: 1}, {b: 1, a: 1}],
        query: {a: 1, b: "hello"},
        docs: indexPrefixDocs,
    },
    {
        name: "Multi Interval Index Bounds",
        indexes: [{e: 1, c: 1}, {e: 1, c: 1, a: 1}],
        query: {e: {$gt: 0, $lt: 2000}, c: {$lt: 3}, a: 1},
        docs: indexPrefixDocs,
    },
    {
        name: "Non-Blocking Sort",
        indexes: [{e: 1, c: 1}, {e: 1, c: 1, a: 1}],
        query: {e: {$gt: 0, $lt: 2000}, c: {$lt: 3}, a: 1},
        sort: {e: 1},
        docs: indexPrefixDocs,
    },
    {
        name: "Blocking Sort",
        indexes: [{e: 1, c: 1}, {e: 1, c: 1, a: 1}],
        query: {e: {$gt: 0, $lt: 2000}, c: {$lt: 3}, a: 1},
        sort: {d: -1},
        docs: indexPrefixDocs,
    },
    {
        name: "Multi IndexScans",
        indexes: [{e: 1, c: 1}, {e: 1, c: 1, a: 1}, {d: 1}],
        query: {$or: [{e: {$gt: 0, $lt: 2000}, c: {$lt: 3}, a: 1}, {d: 11}]},
        docs: indexPrefixDocs,
    },
    {
        name: "No Tie",
        indexes: [{a: 1, b: 1, c: 1}, {c: 1, d: 1}],
        query: {a: 1, b: "hello"},
        docs: indexPrefixDocs,
    },
    {
        name: "Docs Examined",
        indexes: [{i: 1, a: 1, c: 1}, {i: 1, a: 1, b: 1}],
        query: {a: "Jerry", b: /not mouse/, c: /Tom/, d: /degu/, i: {$gt: 10}},
        docs: docsExaminedDocs,
    },
];

// Returns setup function for the given perfomance test case.
function getSetupFunction(perfCase) {
    return function(collection) {
        collection.drop();
        assert.commandWorked(collection.createIndexes(perfCase.indexes));
        assert.commandWorked(collection.insertMany(perfCase.docs));
    }
}

// Create test cases for the benchmark.
for (let perfCase of perfCases) {
    const op = {'op': 'find', 'query': perfCase.query};
    if (perfCase.sort !== undefined) {
        op.sort = perfCase.sort;
    }

    tests.push({
        name: perfCase.name,
        tags: ["tie-breaking", "core", "regression"],
        pre: getSetupFunction(perfCase),
        ops: [op],
    });
}
})();
