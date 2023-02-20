if (typeof (tests) != "object") {
    tests = [];
}

(function() {
'use strict';

// Setting random seed is required for smallDoc for it uses Random.
Random.setRandomSeed(5147);

const namePrefix = '[CWI.insert]';

// Base perfomance test cases which will be used to generate performance test cases.
const baseCases = [
    {
        name: "Compound Regular Index with 2 fields",
        indexes: [{keyPattern: {'a': 1, 'b': 1}}],
        documentGenerator: smallDoc,
        tags: ["core"],
    },
    {
        name: "Compound Wildcard Index with 2 fields",
        indexes: [{keyPattern: {'a': 1, '$**': 1}, wildcardProjection: {'b': 1}}],
        documentGenerator: smallDoc,
        tags: ["core", "regression"],
    },
    {
        name: "Compound Regular Index with 2 fields, one of which is multikey",
        indexes: [{keyPattern: {'a': 1, 'e.f': 1}}],
        documentGenerator: smallDoc,
        tags: ["core"],
    },
    {
        name: "Compound Wildcard index with 2 fields, one of which is multikey",
        indexes: [{keyPattern: {'a': 1, '$**': 1}, wildcardProjection: {'e.f': 1}}],
        documentGenerator: smallDoc,
        tags: ["core", "regression"],
    },
    {
        name: "Multiple Compound Regular Indexes with 2 fields",
        indexes: [
            {keyPattern: {'a': 1, 'e.a': 1}},
            {keyPattern: {'a': 1, 'e.b': 1}},
            {keyPattern: {'a': 1, 'e.b': 1}},
            {keyPattern: {'a': 1, 'e.g': 1}},
            {keyPattern: {'a': 1, 'e.h': 1}}
        ],
        documentGenerator: smallDoc,
        tags: ["core"],
    },
    {
        name: "Compound Wildcard Index with 2 fields and multiple fields in the projection",
        indexes: [{
            keyPattern: {'a': 1, '$**': 1},
            wildcardProjection: {'e.a': 1, 'e.b': 1, 'e.c': 1, 'e.g': 1, 'e.h': 1}
        }],
        documentGenerator: smallDoc,
        tags: ["core", "regression"],
    },
    {
        name: "Compound Regular Index with 5 fields",
        indexes: [{keyPattern: {'a': 1, 'b': 1, 'c': 1, 'h': 1, 'i': 1}}],
        documentGenerator: smallDoc,
        tags: ["core"],
    },
    {
        name: "Compound Wildcard Index with 5 fields",
        indexes: [
            {keyPattern: {'a': 1, '$**': 1, 'c': 1, 'h': 1, 'i': 1}, wildcardProjection: {'b': 1}}
        ],
        documentGenerator: smallDoc,
        tags: ["core", "regression"],
    },
];

// Generate perfomance test cases for different document numbers to be inserted. They will be used
// to create benchmark test cases.
const numberOfDocumentsList = [1, 100, 1000];
const cases = [];
for (let baseCase of baseCases) {
    for (let numberOfDocuments of numberOfDocumentsList) {
        const perfCase = Object.assign({numberOfDocuments}, baseCase);
        perfCase.name = `${namePrefix} ${baseCase.name}. Inserting batches of ${
            numberOfDocuments} ${numberOfDocuments == 1 ? "doc" : "docs"}.`;
        cases.push(perfCase);
    }
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
        }
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

// Create test cases for the benchmark.
for (let perfCase of cases) {
    tests.push({
        name: perfCase.name,
        tags: ["compound-wildcard-insert"].concat(perfCase.tags),
        pre: getSetupFunction(perfCase),
        ops: [{'op': 'insert', 'doc': generateDocuments(perfCase)}]
    });
}
})();
