if (typeof (tests) != "object") {
    tests = [];
}

(function() {
'use strict';

// Setting random seed is required for smallDoc for it uses Random.
Random.setRandomSeed(7998);

const namePrefix = '[CWI.update]';

// Base perfomance test cases which will be used to generate performance test cases.
const baseCases = [
    {
        name: "Compound Regular Index with 2 fields.",
        indexes: [{keyPattern: {'a': 1, 'e.a': 1}}],
        update: { $inc : { a : Random.randInt(10) } },
        documentGenerator: smallDoc,
        tags: ["core"],
    },
    {
        name: "Compound Wildcard Index with 2 fields.",
        indexes: [{keyPattern: {'$**': 1, 'e.a': 1}, wildcardProjection: {'a': 1}}],
        update: { $inc : { a : Random.randInt(10) } },
        documentGenerator: smallDoc,
        tags: ["core", "regression"],
    },
    {
        name: "Compound Regular Index with 2 fields, one of which is multikey.",
        indexes: [{keyPattern: {'a': 1, 'e.f': 1}}],
        update: {"$set": {"e.f": [Random.randInt(10), Random.randInt(10), Random.randInt(10)]}},
        documentGenerator: smallDoc,
        tags: ["core"],
    },
    {
        name: "Compound Wildcard index with 2 fields, one of which is multikey.",
        indexes: [{keyPattern: {'a': 1, '$**': 1}, wildcardProjection: {'e.f': 1}}],
        update: {"$set": {"e.f": [Random.randInt(10), Random.randInt(10), Random.randInt(10)]}},
        documentGenerator: smallDoc,
        tags: ["core", "regression"],
    },
    {
        name:
            "Compound Regular Index with 2 fields, prefixed wildcard field. Nested object update.",
        indexes: [{keyPattern: {'a': 1, "e.e.u": 1}}],
        update: {"$inc": {"e.e.u": Random.randInt(100)}},
        documentGenerator: smallDoc,
        tags: ["core"],
    },
    {
        name: "Compound Wildcard Index with prefixed wildcard field. Nested object update.",
        indexes: [{keyPattern: {'a': 1, "e.$**": 1}, wildcardProjection: undefined}],
        update: {"$inc": {"e.e.u": Random.randInt(100)}},
        documentGenerator: smallDoc,
        tags: ["core", "regression"],
    },
    {
        name: "Compound Regular Index, update all.",
        indexes: [{keyPattern: {'a': 1, 'e.a': 1}}],
        query: {},
        update: { $inc : { a : Random.randInt(10) } },
        documentGenerator: smallDoc,
        tags: ["core"],
    },
    {
        name: "Compound Wildcard Index, update all.",
        indexes: [{keyPattern: {'$**': 1, 'e.a': 1}, wildcardProjection: {'a': 1}}],
        query: {},
        update: { $inc : { a : Random.randInt(10) } },
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
    const opCmd = {'op': 'update',
                   'query': { _id : { "#RAND_INT_PLUS_THREAD" : [ 0, 100 ] } },
                   'update': perfCase.update,
                   'multi': true};

    if (perfCase.hasOwnProperty('query')) {
        opCmd['query'] = perfCase['query'];
    }

    tests.push({
        name: perfCase.name,
        tags: ["compound-wildcard-update"].concat(perfCase.tags),
        pre: getSetupFunction(perfCase),
        ops: [opCmd]
    });
}
})();
