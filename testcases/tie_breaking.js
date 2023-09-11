if (typeof (tests) != "object") {
    tests = [];
}

(function() {
'use strict';

// Generate documents for testing the index prefix heuristics.
const indexPrefixDocs = [];
for (let i = 0; i < 1000; ++i) {
    indexPrefixDocs.push({a: 1, b: "hello", c: i * 12, d: 111 * i - 100, h: i});
    indexPrefixDocs.push({a: i + 1000, b: `hello%{i}`, c: i * 77, d: -i, h: i});
}

// Generate documents for testing the number of documents examined heuristics.
const docsExaminedDocs = [];
for (let i = 0; i < 200; ++i) {
    docsExaminedDocs.push({i: i, a: "Jerry", b: "not mouse", c: "Tom", d: "degu"});
}
for (let i = 0; i < 1100; i++) {
    docsExaminedDocs.push({i: i, a: "Jerry", b: "mouse", c: "Tom", d: "degu"});
}

const baseCases = [
    {
        name: "Longest Index Prefix",
        indexes: [{a: 1}, {b: 1, a: 1}],
        query: {a: 1, b: "hello"},
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
        indexes: [{a: 1, b: 1}, {a: 1, b: 1, c: 1}],
        query: {a: 10, b: {$in: [5, 6]}, c: {$gt: 3}},
        docs: indexPrefixDocs,
    },
    {
        name: "Non-Blocking Sort",
        indexes: [{a: 1, b: 1}, {a: 1, b: 1, c: 1}],
        query: {a: 10, b: {$in: [5, 6]}, c: {$gt: 3}},
        sort: {a: -1},
        docs: indexPrefixDocs,
    },
    {
        name: "Blocking Sort",
        indexes: [{a: 1, b: 1}, {a: 1, b: 1, c: 1}],
        query: {a: 10, b: {$in: [5, 6]}, c: {$gt: 3}},
        sort: {d: -1},
        docs: indexPrefixDocs,
    },
    {
        name: "Multi IndexScans",
        indexes: [{a: 1, b: 1}, {a: 1, b: 1, c: 1}, {d: 1}],
        query: {$or: [{a: 10, b: {$in: [5, 6]}, c: {$gt: 3}}, {d: 1}]},
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

const perfCases = [];
for (let baseCase of baseCases) {
    const perfCaseTB = Object.assign({enableTieBreaking: true}, baseCase);
    perfCaseTB.name = `TB.${perfCaseTB.name}`;
    perfCases.push(perfCaseTB);
    const perfCaseNTB = Object.assign({enableTieBreaking: false}, baseCase);
    perfCaseNTB.name = `NTB.${perfCaseNTB.name}`;
    perfCases.push(perfCaseNTB);
}

// Returns setup function for the given perfomance test case.
function getSetupFunction(perfCase) {
    return function(collection) {
        collection.drop();
        assert.commandWorked(db.adminCommand({
            setParameter: 1,
            internalQueryPlanTieBreakingWithIndexHeuristics: perfCase.enableTieBreaking
        }));
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
        tags: ["tie-breaking"],
        pre: getSetupFunction(perfCase),
        ops: [op],
    });
}
})();