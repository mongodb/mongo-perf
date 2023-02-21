if (typeof (tests) != "object") {
    tests = [];
}

(function() {
'use strict';

// Setting random seed is required for smallDoc for it uses Random.
Random.setRandomSeed(7631);

const namePrefix = '[CWI.remove]';

// Base perfomance test cases which will be used to generate performance test cases.
const baseCases = [
    {
        name: "Compound Regular Index with 2 fields.",
        indexes: [{keyPattern: {'a': 1, 'e.a': 1}}],
        query: {a: 5, 'e.a': 5},  // roughly 0.1*0.1 = 0.01 = 1% of docs will be removed
        documentGenerator: smallDoc,
        tags: ["core"],
    },
    {
        name: "Compound Wildcard Index with 2 fields.",
        indexes: [{keyPattern: {'$**': 1, 'e.a': 1}, wildcardProjection: {'a': 1}}],
        query: {a: 5, 'e.a': 5},  // roughly 0.1*0.1 = 0.01 = 1% of docs will be removed
        documentGenerator: smallDoc,
        tags: ["core", "regression"],
    },
    {
        name: "Compound Regular Index with 2 fields, one of which is multikey.",
        indexes: [{keyPattern: {'a': 1, 'e.f': 1}}],
        query: {a: 5, 'e.f': 5},  // roughly 3*0.1*0.1 = 0.03 = 3% of docs will be removed
        documentGenerator: smallDoc,
        tags: ["core"],
    },
    {
        name: "Compound Wildcard index with 2 fields, one of which is multikey.",
        indexes: [{keyPattern: {'a': 1, '$**': 1}, wildcardProjection: {'e.f': 1}}],
        query: {a: 5, 'e.f': 5},  // roughly 3*0.1*0.1 = 0.03 = 3% of docs will be removed
        documentGenerator: smallDoc,
        tags: ["core", "regression"],
    },
    {
        name:
            "Compound Regular Index with 2 fields, baseline for a test with prefixed wildcard component.",
        indexes: [{keyPattern: {'a': 1, "e.a": 1}}],
        query: {a: 5, 'e.a': 5},  // roughly 3*0.1*0.1 = 0.03 = 3% of docs will be removed
        documentGenerator: smallDoc,
        tags: ["core"],
    },
    {
        name: "Compound Wildcard Index with prefixed wildcard component.",
        indexes: [{keyPattern: {'a': 1, "e.$**": 1}, wildcardProjection: undefined}],
        query: {a: 5, 'e.a': 5},  // roughly 3*0.1*0.1 = 0.03 = 3% of docs will be removed
        documentGenerator: smallDoc,
        tags: ["core", "regression"],
    },
    {
        name: "Compound Regular Index of with 3 fields, interval query.",
        indexes: [{keyPattern: {'a': 1, 'e.g': 1, 'g': 1}}],
        query: {
            a: 5,
            'e.g': {$gt: 5},
            g: {$lt: 5}
        },  // roughly 0.1*0.5*0.5 = 0.025 = 2.5% of docs will be removed
        documentGenerator: smallDoc,
        tags: ["core"],
    },
    {
        name: "Compound Wildcard index with 3 fields, interval query.",
        indexes: [{keyPattern: {'a': 1, '$**': 1, 'g': 1}, wildcardProjection: {'e.g': 1}}],
        query: {
            a: 5,
            'e.g': {$gt: 5},
            g: {$lt: 5}
        },  // roughly 0.1*0.5*0.5 = 0.025 = 2.5% of docs will be removed
        documentGenerator: smallDoc,
        tags: ["core", "regression"],
    },
    {
        name: "Compound Regular Index, most of the collection removal.",
        indexes: [{keyPattern: {'a': 1, 'e.a': 1}}],
        query: {a: {$ne: 5}, 'e.a': {$gte: 1}},  // 0.9 * 0.9 = 0.81 = 81% of docs will be removed
        documentGenerator: smallDoc,
        tags: ["core"],
    },
    {
        name: "Compound Wildcard Index, most of the collection removal.",
        indexes: [{keyPattern: {'$**': 1, 'e.a': 1}, wildcardProjection: {'a': 1}}],
        query: {a: {$ne: 5}, 'e.a': {$gte: 1}},  // 0.9 * 0.9 = 0.81 = 81% of docs will be removed
        documentGenerator: smallDoc,
        tags: ["core", "regression"],
    },
];

// Generate perfomance test cases for different document numbers to be inserted. They will be used
// to create benchmark test cases.
const numberOfDocumentsList = [1000, 100000];
const cases = [];
for (let baseCase of baseCases) {
    for (let numberOfDocuments of numberOfDocumentsList) {
        const perfCase = Object.assign({numberOfDocuments}, baseCase);
        perfCase.name = `${namePrefix} ${baseCase.name} Collection size ${numberOfDocuments} docs.`;
        cases.push(perfCase);
    }
}

// Generates documents list for the given perfomance test case.
function generateDocuments(perfCase) {
    const documents = [];
    for (let i = 0; i < perfCase.numberOfDocuments; ++i) {
        documents.push(perfCase.documentGenerator(i));
    }
    return documents;
}

// Returns setup function for the given perfomance test case.
function getSetupFunction(perfCase) {
    return function(collection) {
        collection.drop();
        for (let indexSpec of perfCase.indexes) {
            const indexOptions = {};
            if (indexSpec.wildcardProjection) {
                indexOptions.wildcardProjection = indexSpec.wildcardProjection;
            }
            assert.commandWorked(collection.createIndex(indexSpec.keyPattern, indexOptions));
            const docs = generateDocuments(perfCase);
            assert.commandWorked(collection.insertMany(docs));
        }
    }
}

// Create test cases for the benchmark.
for (let perfCase of cases) {
    tests.push({
        name: perfCase.name,
        tags: ["compound-wildcard-remove"].concat(perfCase.tags),
        pre: getSetupFunction(perfCase),
        ops: [{'op': 'remove', 'query': perfCase.query}]
    });
}
})();
