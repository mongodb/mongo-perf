if (typeof (tests) != "object") {
    tests = [];
}

(function() {
'use strict';

const docs = [];
for (let i = 0; i < 1000; ++i) {
    docs.push({a: 1, b: "hello", c: i * 12, d: 111 * i - 100, h: i});
    docs.push({a: i + 1000, b: `hello%{i}`, c: i * 77, d: -i, h: i});
}

const baseCases = [
    {
        name: "Longest Index Prefix",
        indexes: [{a: 1}, {b: 1, a: 1}],
        query: {a: 1, b: "hello"},
        docs: docs,
    },
    {
        name: "Equality",
        indexes: [{a: 1, b: 1}, {b: 1, a: 1}],
        query: {a: {$gt: 0}, b: "hello"},
        docs: docs,
    },
    {
        name: "Shortest Index",
        indexes: [{a: 1, b: 1, c: 1}, {b: 1, a: 1}],
        query: {a: 1, b: "hello"},
        docs: docs,
    },
    {
        name: "Shortest Index With Comparisons",
        indexes: [{a: 1, b: 1, c: 1}, {a: 1, b: 1}],
        query: {a: {$gt: 1}, b: "hello"},
        docs: docs,
    },
    {
        name: "Not Broken Tie",
        indexes: [{a: 1, b: 1}, {b: 1, a: 1}],
        query: {a: 1, b: "hello"},
        docs: docs,
    },
    {
        name: "Multi Interval Index Bounds",
        indexes: [{a: 1, b: 1}, {a: 1, b: 1, c: 1}],
        query: {a: 10, b: {$in: [5, 6]}, c: {$gt: 3}},
        docs: docs,
    },
    {
        name: "Non-Blocking Sort",
        indexes: [{a: 1, b: 1}, {a: 1, b: 1, c: 1}],
        query: {a: 10, b: {$in: [5, 6]}, c: {$gt: 3}},
        sort: {a: -1},
        docs: docs,
    },
    {
        name: "Blocking Sort",
        indexes: [{a: 1, b: 1}, {a: 1, b: 1, c: 1}],
        query: {a: 10, b: {$in: [5, 6]}, c: {$gt: 3}},
        sort: {d: -1},
        docs: docs,
    },
    {
        name: "Multi IndexScans",
        indexes: [{a: 1, b: 1}, {a: 1, b: 1, c: 1}, {d: 1}],
        query: {$or: [{a: 10, b: {$in: [5, 6]}, c: {$gt: 3}}, {d: 1}]},
        docs: docs,
    },
    {
        name: "No Tie",
        indexes: [{a: 1, b: 1, c: 1}, {c: 1, d: 1}],
        query: {a: 1, b: "hello"},
        docs: docs,
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
