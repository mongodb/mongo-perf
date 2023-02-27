if (typeof (tests) != "object") {
    tests = [];
}

(function() {
'use strict';

// Setting random seed is required for smallDoc for it uses Random.
Random.setRandomSeed(4921);

const namePrefix = '[CWI.query]';

const indexSpecs = [
    {
        description: "Regular. 3 fields.",
        keyPattern: {'a': 1, 'e.h': -1, 'e.e': 1},
        tags: ["core"],
    },
    {
        description: "Wildcard. 3 fields. Wildcard Component on 0.",
        keyPattern: {'$**': 1, 'e.h': -1, 'e.e': 1},
        wildcardProjection: {'a': 1},
        tags: ["core", "regression"],
    },
    {
        description: "Wildcard. 3 fields. Wildcard Component on 1.",
        keyPattern: {'a': 1, '$**': -1, 'e.e': 1},
        wildcardProjection: {'e.h': 1},
        tags: ["core", "regression"],
    },
];

const queries = [
    {
        description: 'Point Query.',
        query: {a: 5, 'e.h': 5, 'e.e': 5},
    },
    {
        description: 'Point Query with sort.',
        query: {a: 5, 'e.h': 5, 'e.e': 5},
        sort: {a: 1, 'e.h': -1, 'e.e': 1},
    },
    {
        description: 'Covered Point Query.',
        query: {a: 5, 'e.h': 5, 'e.e': 5},
        filter: {_id: 0, a: 1},
    },
    {
        description: 'Range Query.',
        query: {a: {$gt: 10}, 'e.h': {$lt: 10}, 'e.e': {$lt: 5}},
    },
    {
        description: 'Point and Range Query.',
        query: {a: 5, 'e.h': {$lt: 10}, 'e.e': {$lt: 5}},
    },
    {
        description: 'ESR Query',
        query: {a: 5, 'e.h': {$lt: 10}, 'e.e': {$lt: 5}},
        sort: {a: 1, 'e.h': -1, 'e.e': 1},
    },
    {
        description: 'Prefix query.',
        query: {a: 5},
    },
];

const numberOfDocumentsList = [1000, 100000];

const perfCases = [];
for (let indexSpec of indexSpecs) {
    for (let query of queries) {
        for (let numberOfDocuments of numberOfDocumentsList) {
            perfCases.push({
                name: `${namePrefix} ${indexSpec.description} ${
                    query.description} Collection size ${numberOfDocuments} docs.`,
                indexes: [indexSpec],
                query: query.query,
                sort: query.sort,
                filter: query.filter,
                tags: indexSpec.tags
            });
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
for (let perfCase of perfCases) {
    const op = {'op': 'find', 'query': perfCase.query};
    if (perfCase.sort !== undefined) {
        op.sort = perfCase.sort;
    }
    if (perfCase.filter !== undefined) {
        op.filter = perfCase.filter;
    }

    tests.push({
        name: perfCase.name,
        tags: ["compound-wildcard-query"].concat(perfCase.tags),
        pre: getSetupFunction(perfCase),
        ops: [op],
    });
}
})();
