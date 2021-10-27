if (typeof (tests) != "object") {
    tests = [];
}

(function () {
'use strict';

const largeCollectionSize = 100000;

/**
 * The intent of testing query or aggregation with small documents is to have small overhead
 * associated with parsing and copying them while having enough fields to run queries with different
 * characteristics such as selectivity, complex expressions, sub-fields and arrays access, etc.
 *
 * @param {Number} i - the number to be used as _id
 * @returns - a document of size 281 bytes (Object.bsonsize(smallDoc(1)))
 */
const smallDoc = function (i) {
    return {
        _id: i,
        a: Random.randInt(10),
        b: Random.randInt(1000),
        c: Random.rand() * 100 + 1, // no zeros in this field
        d: i % 10000,
        e: {
            a: Random.randInt(10),
            b: Random.randInt(1000),
            c: Random.rand() * 100 + 1,
            e: { u: Random.randInt(100), v: Random.randInt(100) },
            f: [Random.randInt(10), Random.randInt(10), Random.randInt(10)],
            g: Random.rand() * 10,
            h: Random.rand() * 1000,
            i: Random.rand() * 100000,
        },
        f: [Random.randInt(10), Random.randInt(10), Random.randInt(10)],
        g: Random.rand() * 10,
        h: Random.rand() * 1000,
        i: Random.rand() * 100000,
    };
}

/**
 * The intent of testing query or aggregation with large documents is to make it clear when there is
 * overhead associated with parsing and copying them.
 *
 * @param {Number} i - the number to be used as _id
 * @returns - a document of size 8543 bytes (Object.bsonsize(largeDoc(1)))
 */
const quotes = [
    "Silly things do cease to be silly if they are done by sensible people in an impudent way.",
    "I may have lost my heart, but not my self-control.",
    "Success supposes endeavour.",
    "One half of the world cannot understand the pleasures of the other.",
    "It is not every man’s fate to marry the woman who loves him best.",
    "Blessed with so many resources within myself the world was not necessary to me. I could do very well without it.",
    "It is very difficult for the prosperous to be humble.",
    "Better be without sense than misapply it as you do.",
    "Surprises are foolish things. The pleasure is not enhanced, and the inconvenience is often considerable.",
];
const largeDoc = function (i) {
    return {
        _id: i,
        a: Random.randInt(10),
        b: Random.randInt(1000),
        c: Random.rand() * 100 + 1, // no zeros in this field
        d: i % 10000,
        e: {
            a: Random.randInt(10),
            b: Random.randInt(1000),
            c: Random.rand() * 100 + 1,
            e: { u: Random.randInt(100), v: Random.randInt(100) },
            f: [Random.randInt(10), Random.randInt(10), Random.randInt(10)],
            g: Random.rand() * 10,
            h: Random.rand() * 1000,
            i: Random.rand() * 100000,
        },

        
        f: [Random.randInt(10), Random.randInt(10), Random.randInt(10)],
        g: Random.rand() * 10,
        h: Random.rand() * 1000,
        i: Random.rand() * 100000,

        // Fields the queries won't be accessing but might need to copy/scan over.
        p1: [quotes, quotes, quotes, quotes, quotes],
        p2: { author: " Jane Austen", work: "Emma", quotes: quotes },
        p3: { a: quotes[0] + i.toString(), b: quotes[2] + (i % 10).toString(), c: quotes[4] },
        p4: [quotes, quotes, quotes, quotes, quotes],

        // Fields towards the end of the object some of the tests will be using.
        aa: Random.randInt(10),
        bb: Random.randInt(1000),
        cc: Random.rand() * 100 + 1,
        dd: i % 10000,
        ee: {
            a: Random.randInt(10),
            b: Random.randInt(1000),
            c: Random.rand() * 100 + 1,
            e: { u: Random.randInt(100), v: Random.randInt(100) },
            f: [Random.randInt(10), Random.randInt(10), Random.randInt(10)],
            g: Random.rand() * 10,
            h: Random.rand() * 1000,
            i: Random.rand() * 100000,
        },
        ff: [Random.randInt(10), Random.randInt(10), Random.randInt(10)],
        gg: Random.rand() * 10,
        hh: Random.rand() * 1000,
        ii: Random.rand() * 100000,
    };
}

/**
 * Returns a string of the given size.
 *
 * @param {Number} size - The number of characters in the resulting string.
 */
var getStringOfLength = function() {
    var maxStrLen = 12 * 1024 * 1024;  // May need to be updated if a larger string is needed.
    var hugeStr = new Array(maxStrLen + 1).join("x");
    return function getStringOfLength(size) {
        assert.lte(size, maxStrLen, "Requested size was too large.");
        return hugeStr.substr(0, size);
    };
}();

var kDefaultDocumentSourceLookupCacheSize = 100 * 1024 * 1024;
var setDocumentSourceLookupCacheSize = function(sizeInBytes) {
    assert.commandWorked(db.adminCommand(
        {setParameter: 1, internalDocumentSourceLookupCacheSizeBytes: sizeInBytes}));
};

/**
 * Generates a generic document to use in aggregation pipelines that don't care what the data looks
 * like. These documents are at least 12 KB in size.
 *
 * @param {Number} i - Which number document this is in the collection, monotonically increasing.
 */
function defaultDocGenerator(i) {
    return {
        _id: new ObjectId(),
        string: getStringOfLength(12 * 1024),  // 12 KB.
        sub_docs: [{_id: new ObjectId(), x: i, y: i * i}],
        metadata: {about: "Used only for performance testing", created: new ISODate()}
    };
}

/**
 * Returns a function which will populate a collection with 'nDocs' documents, each document
 * generated by calling 'docGenerator' with the document number. Will also create all indices
 * specified in 'indices' on the given collection. Also seeds the random number generator.
 *
 * @param {Boolean} isView - True if the namespace being populated is an identity view; false if it
 * is a collection.
 * @param {Object[]} indices - An array of index specifications to be created on the collection.
 * @param {function} docGenerator - A function that takes a document number and returns a document.
 * Used to seed the collection.
 * @param {Number} nDocs - The number of documents to insert into the collection.
 */
function populatorGenerator(isView, nDocs, indices, docGenerator) {
    return function(collectionOrView) {
        var db = collectionOrView.getDB();
        collectionOrView.drop();

        var collection;
        if (isView) {
            // 'collectionOrView' is an identity view, so specify a backing collection to serve as
            // its source and perform the view creation.
            var viewName = collectionOrView.getName();
            var collectionName = viewName + "_backing";
            collection = db.getCollection(collectionName);
            collection.drop();

            assert.commandWorked(db.runCommand({create: viewName, viewOn: collectionName}));
        } else {
            collection = collectionOrView;
        }

        var bulkop = collection.initializeUnorderedBulkOp();
        Random.setRandomSeed(258);

        for (var i = 0; i < nDocs; i++) {
            bulkop.insert(docGenerator(i));
        }
        bulkop.execute();
        indices.forEach(function(indexSpec) {
            assert.commandWorked(collection.createIndex(indexSpec));
        });
    };
}

/**
 * Adds test objects to the 'tests' array, to be used by {@link #runTests}.
 *
 * @param {Object} options - Options describing the test case.
 * @param {String} options.name - The name of the test case. "Aggregation." will be prepended.
 * @param {Object[]} options.pipeline - The aggregation pipeline to run.
 *
 * @param {Bool} [options.addSkipStage=true] - Indicates whether a final $skip stage, skipping 1
 * billion documents, should be added to the end of the pipeline. This is useful, and true by
 * default, because it avoids the overhead of BSON serialization, which helps to better qualify the
 * performance of the agg stages themselves.
 * @param {String[]} [options.tags=["aggregation", "regression"]] - The tags describing what type of
 * test this is.
 * @param {Object[]} [options.indices=[]] - An array of index specifications to create on the
 * collection.
 * @param {Number} [options.nDocs=500] - The number of documents to insert in the collection.
 * @param {function} [options.docGenerator=defaultDocGenerator] - A function that takes a document
 * number and returns a document. Used to seed the collection. The random number generator will be
 * seeded before the first call.
 * @param {function} [options.pre=populatorGenerator] - A function run before the test starts,
 * intended to set up state necessary for the test to run. For example, creating collections and
 * indices. If this option is specified, the 'docGenerator' and 'indices' options will be ignored.
 * @param {function} [options.post=drop] - A function run after the test completes, intended to
 * clean up any state on the server it may have created during setup or execution. If 'pipeline'
 * uses more than one collection, this will need to drop the other collection(s) involved.
 */
function generateTestCase(options) {
    var isView = true;  // Constant for use when calling populatorGenerator().
    var nDocs = options.nDocs || 500;
    var pipeline = options.pipeline;
    var tags = options.tags || [];

    var addSkipStage = options.addSkipStage;
    if (addSkipStage === undefined) {
        addSkipStage = true;
    }

    if (pipeline.length > 0 && addSkipStage) {
        // $_internalInhibitOptimization is added before $skip to prevent it from participating in
        // the query optimization process.
        pipeline = pipeline.concat([{$_internalInhibitOptimization: {}}, {$skip: 1e9}]);
    }

    var tagsForTest = ["regression"].concat(tags);
    // Tests get tagged as "aggregation" automatically, unless they are specially tagged as
    // "agg_query_comparison".
    if (tagsForTest.indexOf("agg_query_comparison") < 0) {
        tagsForTest = tagsForTest.concat("aggregation");
    }

    tests.push({
        tags: tagsForTest,
        name: "Aggregation." + options.name,
        pre: (options.pre !== undefined)
            ? options.pre(!isView)
            : populatorGenerator(!isView,
                                 nDocs,
                                 options.indices || [],
                                 options.docGenerator || defaultDocGenerator),
        post: options.post ||
            function(collection) {
                collection.drop();
            },
        ops: [{
            op: "command",
            ns: "#B_DB",
            command: {aggregate: "#B_COLL", pipeline: pipeline, cursor: {}}
        }]
    });

    var tagsForViewsTest = ["views", "regression", "aggregation_identityview"].concat(tags);

    // Identity view tests should not participate in the agg to query comparison suite, so they
    // should not get tagged as such.
    tagsForViewsTest = tagsForViewsTest.filter(function(curTag) {
        return curTag !== "agg_query_comparison";
    });

    tests.push({
        tags: tagsForViewsTest,
        name: "Aggregation.IdentityView." + options.name,
        pre: (options.pre !== undefined)
            ? options.pre(isView)
            : populatorGenerator(isView,
                                 nDocs,
                                 options.indices || [],
                                 options.docGenerator || defaultDocGenerator),
        post: options.post ||
            function(view) {
                var collection = view.getDB()[view.getName() + "_backing"];
                view.drop();
                collection.drop();
            },
        ops: [{
            op: "command",
            ns: "#B_DB",
            command: {aggregate: "#B_COLL", pipeline: pipeline, cursor: {}}
        }]
    });
}

/**
 * Similar to 'generateTestCase' but sets up the test to be able to share collections if running
 * as part of a suite that opts-in for sharing.
 * @param {Number} [options.nDocs = largeCollectionSize] - The number of documents to insert in the collection.
 * @param {function} [options.docGenerator] - To be used with populatorGenerator. Ignored, if 
 * 'generatedData' is defined.
 * @param {function} [options.generateData = populatorGenerator] - Uses 'docGenerator' to populate
 * the collection. If the test is part of a suite that uses '--shareDataset' flag, the generator is
 * run once (for the first test in the suite).
 * @param {function} [options.pre=noop] - Any other setup, in addition to creating the data, that
 * the test might need. For example, creating indexes. The 'pre' fixture is run per test, so for
 * tests that share the dataset, the effects must be undone with 'post'.
 * @param {function} [options.post=noop] - cleanup after the test is done.
 */
function generateTestCaseWithLargeDataset(options) {
    var nDocs = options.nDocs || largeCollectionSize;
    var pipeline = options.pipeline;
    var tags = options.tags || [];
    tests.push({
        tags: ["regression", "aggregation_large_dataset"].concat(tags),
        name: "Aggregation." + options.name,
        generateData: options.generateData ||
            function(collection) {
                Random.setRandomSeed(258);
                collection.drop();
                var bulkop = collection.initializeUnorderedBulkOp();
                for (var i = 0; i < nDocs; i++) {
                    bulkop.insert(options.docGenerator(i));
                }
                bulkop.execute();
            },
        pre: options.pre || function (collection) {},
        post: options.post || function(collection) {},
        ops: [{
            op: "command",
            ns: "#B_DB",
            command: {aggregate: "#B_COLL", pipeline: pipeline, cursor: {}}
        }]
    });
}

//
// Empty pipeline.
//

generateTestCase({name: "Empty", pipeline: []});

//
// Single stage pipelines.
//

generateTestCase({
    name: "GeoNear2d",
    docGenerator: function geoNear2dGenerator(i) {
        return {
            _id: i,
            geo: [
                // Two random values in range [-100, 100).
                Random.randInt(200) - 100,
                Random.randInt(200) - 100
            ],
            boolFilter: i % 2 === 0
        };
    },
    indices: [{geo: "2d"}],
    pipeline: [
        {
            $geoNear: {
                near: [0, 0],
                minDistance: 0,
                maxDistance: 300,
                distanceField: "foo",
                query: {boolFilter: true}
            }
        },
        // For $geoNear, we limit the number of results to 100 documents, to match the default
        // behavior the $geoNear stage prior to 4.2.
        {$limit: 100},
    ]
});

generateTestCase({
    name: "GeoNear2dSphere",
    indices: [{geo: "2dsphere"}],
    docGenerator: function geoNear2dGenerator(i) {
        return {
            _id: i,
            geo: [
                (Random.rand() * 360) - 180,  // Longitude, in range [-180, 180).
                (Random.rand() * 180) - 90    // Latitude, in range [-90, 90).
            ],
            boolFilter: i % 2 === 0
        };
    },
    pipeline: [
        {
            $geoNear: {
                near: [0, 0],
                minDistance: 0,
                maxDistance: 300,
                distanceField: "foo",
                query: {boolFilter: true},
                spherical: true
            }
        },
        // For $geoNear, we limit the number of results to 100 documents, to match the default
        // behavior the $geoNear stage prior to 4.2.
        {$limit: 100},
    ]
});

generateTestCase({name: "Group.All", pipeline: [{$group: {_id: "constant"}}]});

generateTestCase({
    name: "Group.TenGroups",
    docGenerator: function basicGroupDocGenerator(i) {
        return {_id: i, _idMod10: i % 10};
    },
    pipeline: [{$group: {_id: "$_idMod10"}}]
});

generateTestCase({
    name: "Group.TenGroupsWithAvg",
    docGenerator: function basicGroupDocGenerator(i) {
        return {_id: i, _idMod10: i % 10};
    },
    pipeline: [{$group: {_id: "$_idMod10", avg: {$avg: "$_id"}}}]
});

/**
 * Pair of document generator functions used for testing $minN and $maxN as accumulators and window
 * functions.
 *
 * @param {Number} i - Which number document this is in the collection. Note that this is required
 * by the populatorGenerator when generating documents.
 */
function minNDocGenerator(i) {
    // The _ids are monotonically decreasing. This maximizes the amount of work that $minN will do
    // for each group as the next value in the sequence will be lower than any current value seen so
    // far.
    return {_id: -i, _idMod10: i % 10};
}

function maxNDocGenerator(i) {
    // The _ids are monotonically increasing. This maximizes the amount of work that $maxN will do
    // for each group as the next value in the sequence will be higher than any current value
    // seen so far.
    return {_id: i, _idMod10: i % 10};
}

/**
 * Test case which splits 1000 documents into 10 groups of 100 and returns the minimum 10 values in
 * each group. Because the documents are in descending order, the number of comparisons and
 * evictions performed is maximized.
 */
generateTestCase({
    name: "Group.TenGroupsWithMinN",
    tags: ['>=5.1.0'],
    nDocs: 1000,
    docGenerator: minNDocGenerator,
    pipeline: [{$group: {_id: "$_idMod10", minVals: {$minN: {n: 10, output: "$_id"}}}}]
});

/**
 * Test case which splits 1000 documents into 10 groups of 100 and returns the maximum 10 values in
 * each group. Because the documents are in ascending order, the number of comparisons and evictions
 * performed is maximized.
 */
generateTestCase({
    name: "Group.TenGroupsWithMaxN",
    tags: ['>=5.1.0'],
    nDocs: 1000,
    docGenerator: maxNDocGenerator,
    pipeline: [{$group: {_id: "$_idMod10", maxVals: {$maxN: {n: 10, output: "$_id"}}}}]
});

/**
 * Generates an array of 50 elements to be used for testing the performance of $minN/$maxN as
 * aggregation expressions. In particular, if we're testing $minN, we generate an array whose
 * elements are in descending order, and if we're testing $maxN, the elements are in ascending
 * order. This maximizes the number of comparisons made during expression evaluation.
 *
 * @param: {Boolean} isMin: true if we're generating an array for $minN.
 */
function generateProjectArray(isMin){
    var arr = [];
    for(var idx = 0; idx < 50; ++idx){
        arr.push(isMin ? -idx : idx);
    }
    return arr;
}

/**
 * Function which generates a document to be used when evaluating $minN/$maxN as expressions.
 *
 * @param {Number} i - Which number document this is in the collection. Note that this is required
 * by the populatorGenerator when generating documents.
 * @param {Array} arr - Array to add to each document.
 */
function minMaxNExpressionDocGenerator(i, arr){
    return {_id: i, array: arr};
}

/**
 * Test case which, for each document, evaluates taking the minimum 10 values of an array whose 50
 * elements are in descending order.
 */
generateTestCase({
    name: "Project.MinN",
    tags: ['>=5.1.0'],
    nDocs: 1000,
    docGenerator: i => minMaxNExpressionDocGenerator(i, generateProjectArray(true)),
    pipeline: [{$project: {_id: 0, output: {$minN: {n: 10, output: "$array"}}}}]
});

/**
 * Test case which, for each document, evaluates taking the maximum 10 values of an array whose 50
 * elements are in ascending order.
 */
generateTestCase({
    name: "Project.MaxN",
    tags: ['>=5.1.0'],
    nDocs: 1000,
    docGenerator: i => minMaxNExpressionDocGenerator(i, generateProjectArray(false)),
    pipeline: [{$project: {_id: 0, output: {$maxN: {n: 10, output: "$array"}}}}]
});

/**
 * Test case which splits 1000 documents into 10 partitions of 100. For each document within the
 * partition, we take the minimum 10 documents over a sliding window of at least 10 documents and up
 * to 21 documents. This window consists of the 10 documents before the current document, the 10
 * documents after the current document, and the current document itself.
 */
generateTestCase({
    name: "SetWindowFields.TenPartitionsWithMinN",
    tags: ['>=5.1.0'],
    nDocs: 1000,
    docGenerator: minNDocGenerator,
    pipeline: [{$setWindowFields: {sortBy: {_id: 1}, partitionBy: "$_idMod10",
            output: {minVals: {$minN: {n: 10, output: "$_id"}, window: {range: [-10, 10]}}}}}]
});

/**
 * Test case which splits 1000 documents into 10 partitions of 100. For each document within the
 * partition, we take the maximum 10 documents over a sliding window of at least 10 documents and up
 * to 21 documents. This window consists of the 10 documents before the current document, the 10
 * documents after the current document, and the current document itself.
 */
generateTestCase({
    name: "SetWindowFields.TenPartitionsWithMaxN",
    tags: ['>=5.1.0'],
    nDocs: 1000,
    docGenerator: maxNDocGenerator,
    pipeline: [{$setWindowFields: {sortBy: {_id: 1}, partitionBy: "$_idMod10",
            output: {maxVals: {$maxN: {n: 10, output: "$_id"}, window: {range: [-10, 10]}}}}}]
});

generateTestCase({
    name: "Group.TenGroupsWithSumJs",
    tags: ['js', '>=4.3.4'],
    nDocs: 10000,
    docGenerator: function basicGroupDocGenerator(i) {
        return {_id: i, _idMod10: i % 10};
    },
    pipeline: [{$group: {_id: "$_idMod10", sum: {$accumulator:{
        lang: "js",
        init: function() { return 0; },
        accumulateArgs: ["$_id"],
        accumulate: function(state, value) { return state + value; },
        merge: function(state1, state2) { return state1 + state2; },
    }}}}]
});

generateTestCase({
    name: "Group.TenGroupsWithAvgJs",
    tags: ['js', '>=4.3.4'],
    nDocs: 10000,
    docGenerator: function basicGroupDocGenerator(i) {
        return {_id: i, _idMod10: i % 10};
    },
    pipeline: [{$group: {_id: "$_idMod10", sum: {$accumulator:{
        lang: "js",
        init: function() { return { count: 0, sum: 0 }; },
        accumulateArgs: ["$_id"],
        accumulate: function(state, value) {
            return {
                count: state.count + 1,
                sum: state.sum + value,
            };
        },
        merge: function(state1, state2) {
            return {
                count: state1.count + state2.count,
                sum: state1.sum + state2.sum,
            };
        },
        finalize: function(state) { return state.sum / state.count; },
    }}}}]
});

generateTestCase({
    name: "Group.OneFieldReferencedOutOfMany",
    docGenerator: function basicGroupDocGenerator(i) {
        var doc = {_id: i, _idMod10: i % 10};
        for (var j = 0; j < 100; j++) {
            doc["field" + j] = i;
        }
        return doc;
    },
    pipeline: [{$group: {_id: "$_idMod10"}}]
});

generateTestCase({name: "Limit", nDocs: 500, pipeline: [{$limit: 250}]});

function getBackingCollection(isView, collectionOrView) {
    if (isView) {
        // 'collectionOrView' is an identity view, so specify a backing collection to serve as
        // its source and perform the view creation.
        const viewName = collectionOrView.getName();
        const db = collectionOrView.getDB();
        const backingCollName = viewName + "_backing";
        assert.commandWorked(db.createView(viewName, backingCollName, []));
        return db[backingCollName];
    } else {
        return collectionOrView;
    }
}
/**
 * Basic function to populate documents in the given collections. The 'foreignCollsInfo' array
 * should have the information about collections that need to be populated with documents.
 * Each object in 'foreignCollsInfo' array should have a 'suffix' field representing the collection
 * name and 'docGen' field representing the function used for document generation.
 */
function basicMultiCollectionDataPopulator({isView, localDocGen, foreignCollsInfo, nDocs, postFunction}) {
    return function(collectionOrView) {
        const db = collectionOrView.getDB();
        collectionOrView.drop();
        const sourceCollection = getBackingCollection(isView, collectionOrView);

        for (let foreignCollInfo of foreignCollsInfo) {
            const foreignCollName = collectionOrView.getName() + foreignCollInfo.suffix;
            const foreignCollection = db[foreignCollName];
            foreignCollection.drop();
            const foreignBulk = foreignCollection.initializeUnorderedBulkOp();
            for (let i = 0; i < nDocs; i++) {
                foreignBulk.insert(foreignCollInfo.docGen(i));
            }
            foreignBulk.execute();
        }
        const sourceBulk = sourceCollection.initializeUnorderedBulkOp();
        for (let i = 0; i < nDocs; i++) {
            sourceBulk.insert(localDocGen(i));
        }
        sourceBulk.execute();
        if (postFunction) {
            postFunction();
        }
    };
}

/**
 * Creates a basic $lookup data set, allowing for join across simple fields.
 */
function basicLookupPopulator(isView) {
    function localDocGen(val) {
        return {_id: val, foreignKey: val};
    }

    function foreignDocGen(val) {
        return {_id: val};
    }

    var nDocs = 100;
    return basicMultiCollectionDataPopulator({isView, localDocGen, foreignCollsInfo: [{suffix: "_lookup", docGen: foreignDocGen}], nDocs});
}

/**
 * Creates a $lookup data set with the local collection containing array of values which can be
 * joined with simple foreign collections values.
 */
function basicArrayLookupPopulator(isView) {
    function localDocGen(val) {
        return {_id: val, foreignKey: [val - 1, val, val + 1]};
    }

    function foreignDocGen(val) {
        return {_id: val};
    }

    var nDocs = 100;
    return basicMultiCollectionDataPopulator({isView, localDocGen, foreignCollsInfo: [{suffix: "_lookup", docGen: foreignDocGen}], nDocs});
}

/**
 * Creates a $lookup data set with the local collection documents containing an array of objects
 * which can be joined with a foreign collection object.
 */
function basicArrayOfObjectLookupPopulator(isView) {
    function localDocGen(val) {
        return {_id: val, foreignKey: [{x: val - 1}, {x: val}, {x: val + 1}]};
    }

    function foreignDocGen(val) {
        return {_id: {x: val}};
    }

    var nDocs = 50;
    return basicMultiCollectionDataPopulator({isView, localDocGen, foreignCollsInfo: [{suffix: "_lookup", docGen: foreignDocGen}], nDocs});
}

/**
 * Creates a minimal $lookup data set for uncorrelated (and uncorrelated prefix) join via $lookup.
 */
function basicUncorrelatedPipelineLookupPopulator(isView, disableCache) {
    function localDocGen(val) {
        return {_id: val};
    }

    function foreignDocGen(val) {
        return {_id: val};
    }

    var nDocs = 50;
    if (disableCache === undefined) {
        disableCache = false;
    }
    return basicMultiCollectionDataPopulator({isView, localDocGen, foreignCollsInfo: [{suffix: "_lookup", docGen: foreignDocGen}], nDocs, postFunction: (disableCache ? (function() {
            setDocumentSourceLookupCacheSize(0);
        })
                                    : undefined) });
}

/**
 * Same as 'basicUncorrelatedPipelineLookupPopulator' but disables $lookup caching for uncorrelated
 * pipeline prefix.
 */
function basicUncorrelatedPipelineLookupPopulatorDisableCache(isView) {
    var disableCache = true;
    return basicUncorrelatedPipelineLookupPopulator(isView, disableCache);
}

/**
 * Data cleanup function used by the 'Lookup', 'LookupViaGraphLookup' and 'LookupOrders' tests.
 */
function basicLookupCleanup(sourceCollection) {
    var lookupCollName = sourceCollection.getName() + "_lookup";
    var lookupCollection = sourceCollection.getDB()[lookupCollName];
    var backingCollName = sourceCollection.getName() + "_backing";
    var backingCollection = sourceCollection.getDB()[backingCollName];
    sourceCollection.drop();
    lookupCollection.drop();
    backingCollection.drop();
}

/**
 * Same as 'basicLookupCleanup' but reenables $lookup caching for uncorrelated pipeline prefix.
 */
function basicLookupCleanupEnableCache(sourceCollection) {
    setDocumentSourceLookupCacheSize(kDefaultDocumentSourceLookupCacheSize);
    basicLookupCleanup(sourceCollection);
}

/**
 * Basic $lookup test. $lookup tests need two collections, so they use their own setup code.
 */
generateTestCase({
    name: "Lookup",
    // The setup function is only given one collection, but $lookup needs two. We'll treat the given
    // one as the source collection, and create a second one with the name of the first plus
    // '_lookup', which we'll use to look up from.
    pre: basicLookupPopulator,
    post: basicLookupCleanup,
    pipeline: [{
        $lookup:
            {from: "#B_COLL_lookup", localField: "foreignKey", foreignField: "_id", as: "match"}
    }],
    tags: ["lookup", ">=3.5"]
});

/**
 * Same as the 'Lookup' test but written with let/pipeline syntax.
 */
generateTestCase({
    name: "Lookup.Pipeline",
    pre: basicLookupPopulator,
    post: basicLookupCleanup,
    pipeline: [
        {
            $lookup: {
                from: "#B_COLL_lookup",
                let: {
                    foreignKey: "$foreignKey",
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {$eq: ["$$foreignKey", "$_id"]}
                        }
                    },
                ],
                as: "match"
            }
        }
    ],
    tags: ["lookup", ">=3.5"]
});

/**
 * $lookup with a 'localField' being an array of numeric values.
 */
generateTestCase({
    name: "Lookup.LocalArray",
    // The setup function is only given one collection, but $lookup needs two. We'll treat the given
    // one as the source collection, and create a second one with the name of the first plus
    // '_lookup', which we'll use to look up from.
    pre: basicArrayLookupPopulator,
    post: basicLookupCleanup,
    pipeline: [{
        $lookup:
            {from: "#B_COLL_lookup", localField: "foreignKey", foreignField: "_id", as: "match"}
    }],
    tags: ["lookup", ">=3.5"]
});

/**
 * Same as the 'LookupWithLocalArray' test but written with let/pipeline syntax.
 */
generateTestCase({
    name: "Lookup.LocalArray.Pipeline",
    pre: basicArrayLookupPopulator,
    post: basicLookupCleanup,
    pipeline: [
        {
            $lookup: {
                from: "#B_COLL_lookup",
                let: {
                    foreignKey: "$foreignKey",
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {$in: ["$_id", "$$foreignKey"]}
                        }
                    },
                ],
                as: "match"
            }
        }
    ],
    tags: ["lookup", ">=3.5"]
});

/**
 * $lookup with a 'localField' being an array of objects.
 */
generateTestCase({
    name: "Lookup.LocalArrayOfObject",
    // The setup function is only given one collection, but $lookup needs two. We'll treat the given
    // one as the source collection, and create a second one with the name of the first plus
    // '_lookup', which we'll use to look up from.
    pre: basicArrayOfObjectLookupPopulator,
    post: basicLookupCleanup,
    pipeline: [{
        $lookup:
            {from: "#B_COLL_lookup", localField: "foreignKey.x", foreignField: "_id.x", as: "match"}
    }],
    tags: ["lookup", ">=3.5"]
});

/**
 * Same as the 'LookupWithLocalArrayOfObject' test but written with let/pipeline syntax.
 */
generateTestCase({
    name: "Lookup.LocalArrayOfObject.Pipeline",
    pre: basicArrayOfObjectLookupPopulator,
    post: basicLookupCleanup,
    pipeline: [
        {
            $lookup: {
                from: "#B_COLL_lookup",
                let: {
                    foreignKey: "$foreignKey.x",
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {$in: ["$_id.x", "$$foreignKey"]}
                        }
                    },
                ],
                as: "match"
            }
        }
    ],
    tags: ["lookup", ">=3.5"]
});

/**
 * $lookup with an uncorrelated join on foreign collection.
 */
generateTestCase({
    name: "Lookup.UncorrelatedJoin",
    pre: basicUncorrelatedPipelineLookupPopulator,
    post: basicLookupCleanup,
    pipeline: [
        {
            $lookup: {
                from: "#B_COLL_lookup",
                pipeline: [
                    {
                        $match: {}
                    },
                ],
                as: "match"
            }
        }
    ],
    tags: ["lookup", ">=3.5"]
});

/**
 * Same as 'Lookup.UncorrelatedJoin' but disables caching of uncorrelated pipeline prefix for the
 * duration of the test.
 */
generateTestCase({
    name: "Lookup.UncorrelatedJoin.NoCache",
    pre: basicUncorrelatedPipelineLookupPopulatorDisableCache,
    post: basicLookupCleanupEnableCache,
    pipeline: [
        {
            $lookup: {
                from: "#B_COLL_lookup",
                pipeline: [
                    {
                        $match: {}
                    },
                ],
                as: "match"
            }
        }
    ],
    tags: ["lookup", ">=3.5"]
});

/**
 * $lookup where the prefix of the foreign collection join is uncorrelated.
 */
generateTestCase({
    name: "Lookup.UncorrelatedPrefixJoin",
    pre: basicUncorrelatedPipelineLookupPopulator,
    post: basicLookupCleanup,
    pipeline: [
        {
            $lookup: {
                from: "#B_COLL_lookup",
                let: {
                    foreignKey: "$_id",
                },
                pipeline: [
                    {
                        $addFields: {
                            newField: { $mod: ["$_id", 5] }
                        }
                    },
                    {
                        $match: {
                            $expr: {
                                $eq: ["$newField", {$mod: ["$$foreignKey", 5] }]
                            }
                        }
                    }
                ],
                as: "match"
            }
        }
    ],
    tags: ["lookup", ">=3.5"]
});

/**
 * Same as 'Lookup.UncorrelatedPrefixJoin' but disables caching of uncorrelated pipeline prefix for
 * the duration of the test.
 */
generateTestCase({
    name: "Lookup.UncorrelatedPrefixJoin.NoCache",
    pre: basicUncorrelatedPipelineLookupPopulatorDisableCache,
    post: basicLookupCleanupEnableCache,
    pipeline: [
        {
            $lookup: {
                from: "#B_COLL_lookup",
                let: {
                    foreignKey: "$_id",
                },
                pipeline: [
                    {
                        $addFields: {
                            newField: { $mod: ["$_id", 5] }
                        }
                    },
                    {
                        $match: {
                            $expr: {
                                $eq: ["$newField", {$mod: ["$$foreignKey", 5] }]
                            }
                        }
                    }
                ],
                as: "match"
            }
        }
    ],
    tags: ["lookup", ">=3.5"]
});

/**
 * Mimics the basic 'Lookup' test using $graphLookup for comparison.
 */
generateTestCase({
    name: "LookupViaGraphLookup",
    pre: basicLookupPopulator,
    post: basicLookupCleanup,
    pipeline: [
        {
            $graphLookup: {
                from: "#B_COLL_lookup",
                startWith: "$foreignKey",
                connectFromField: "foreignKey",
                connectToField: "_id",
                as: "match"
            }
        }
    ],
    tags: ["lookup", ">=3.5"]
});

generateTestCase({
    name: "LookupOrders",
    // The setup function is only given one collection, but $lookup needs two. We'll treat the given
    // one as a collection of orders, and create a second one with the name of the first plus
    // '_lookup', which we'll use as a collection of products, referred to by the orders.
    pre: function lookupPopulator(isView) {
        return function(ordersCollectionOrView) {
            var db = ordersCollectionOrView.getDB();
            var productCollName = ordersCollectionOrView.getName() + "_lookup";
            var productsCollection = db[productCollName];
            var nDocs = 20;

            productsCollection.drop();
            ordersCollectionOrView.drop();

            var ordersCollection;
            if (isView) {
                // 'ordersCollectionOrView' is an identity view, so specify a backing collection to
                // serve as its source and perform the view creation.
                var viewName = ordersCollectionOrView.getName();
                var backingCollName = viewName + "_backing";
                ordersCollection = db[backingCollName];
                ordersCollectionOrView.drop();
                assert.commandWorked(db.createView(viewName, backingCollName, []));
            } else {
                ordersCollection = ordersCollectionOrView;
            }

            // Insert orders, referencing products.
            Random.setRandomSeed(parseInt("5ca1ab1e", 16));
            var productsBulk = productsCollection.initializeUnorderedBulkOp();
            var ordersBulk = ordersCollection.initializeUnorderedBulkOp();
            for (var i = 0; i < nDocs; i++) {
                // Products are simple, just an _id.
                productsBulk.insert({_id: i});

                // Each order will contain a random number of products in an array.
                var nProducts = Random.randInt(10);
                var products = [];
                for (var p = 0; p < nProducts; p++) {
                    products.push({_id: Random.randInt(nDocs), quantity: Random.randInt(20)});
                }

                ordersBulk.insert({
                    _id: new ObjectId(),
                    products: products,
                    ts: new ISODate()
                });
            }
            productsBulk.execute();
            ordersBulk.execute();
        };
    },
    post: basicLookupCleanup,
    pipeline: [
        {
            $unwind: "$products"
        },
        {
            $lookup: {
                from: "#B_COLL_lookup",
                localField: "products._id",
                foreignField: "_id",
                as: "product"
            }
        }
    ],
    tags: ["lookup"]
});

generateTestCase({
    name: "GraphLookupSocialite",
    pre: function socialitePopulator(isView) {
        return function(userCollectionOrView) {
            var db = userCollectionOrView.getDB();
            var followerCollName = userCollectionOrView.getName() + "_follower";
            var followerCollection = db[followerCollName];

            userCollectionOrView.drop();
            followerCollection.drop();

            var userCollection;
            if (isView) {
                // 'userCollectionOrView' is an identity view, so specify a backing collection to
                // serve as its source and perform the view creation.
                var viewName = userCollectionOrView.getName();
                var backingCollName = viewName + "_backing";
                userCollection = db[backingCollName];
                assert.commandWorked(db.createView(viewName, backingCollName, []));
            } else {
                userCollection = userCollectionOrView;
            }

            var userDocs = [
                {_id: "djw", fullname: "Darren", country: "Australia"},
                {_id: "bmw", fullname: "Bob", country: "Germany"},
                {_id: "jsr", fullname: "Jared", country: "USA"},
                {_id: "ftr", fullname: "Frank", country: "Canada"},
                {_id: "jhw", fullname: "James", country: "USA"},
                {_id: "cxs", fullname: "Charlie", country: "USA"},
                {_id: "sss", fullname: "Stephen", country: "Australia"},
                {_id: "ada", fullname: "Adam", country: "Ireland"},
                {_id: "mar", fullname: "Mark", country: "Ireland"},
            ];

            var userBulk = userCollection.initializeUnorderedBulkOp();
            userDocs.forEach(function(userDoc) {
                userBulk.insert(userDoc);
            });
            userBulk.execute();

            var followers = [
                {_f: "djw", _t: "jsr"},
                {_f: "jsr", _t: "bmw"},
                {_f: "ftr", _t: "bmw"},
                {_f: "jhw", _t: "bmw"},
                {_f: "sss", _t: "jhw"},
                {_f: "cxs", _t: "sss"},
                {_f: "aaa", _t: "cxs"},
                {_f: "djw", _t: "cxs"},
                {_f: "djw", _t: "jhw"},
                {_f: "djw", _t: "sss"},
                {_f: "djw", _t: "ftr"},
                {_f: "djw", _t: "bmw"},
                {_f: "ada", _t: "mar"},
            ];

            var followerBulk = followerCollection.initializeUnorderedBulkOp();
            followers.forEach(function(follower) {
                followerBulk.insert(follower);
            });
            followerBulk.execute();
        };
    },
    post: function lookupPost(userCollection) {
        var followerCollName = userCollection.getName() + "_follower";
        var followerCollection = userCollection.getDB()[followerCollName];
        var backingCollName = userCollection.getName() + "_backing";
        var backingCollection = userCollection.getDB()[backingCollName];
        userCollection.drop();
        followerCollection.drop();
        backingCollection.drop();
    },
    pipeline: [
        {
           $graphLookup: {
               from: "#B_COLL_follower",
               startWith: "$_id",
               connectFromField: "_t",
               connectToField: "_f",
               as: "network"
           }
        },
        {$unwind: "$network"},
        {$project: {_id: "$network._t"}}
    ],
    tags: ["lookup"]
});

generateTestCase({
    name: "GraphLookupNeighbors",
    pre: function neighborPopulator(isView) {
        return function(sourceCollectionOrView) {
            var db = sourceCollectionOrView.getDB();
            var neighborCollName = sourceCollectionOrView.getName() + "_neighbor";
            var neighborCollection = db[neighborCollName];

            sourceCollectionOrView.drop();
            neighborCollection.drop();

            var sourceCollection;
            if (isView) {
                // 'sourceCollectionOrView' is an identity view, so specify a backing collection to
                // serve as its source and perform the view creation.
                var viewName = sourceCollectionOrView.getName();
                var backingCollName = viewName + "_backing";
                sourceCollection = db[backingCollName];
                assert.commandWorked(db.createView(viewName, backingCollName, []));
            } else {
                sourceCollection = sourceCollectionOrView;
            }

            var bulk = neighborCollection.initializeUnorderedBulkOp();
            for (var i = 0; i < 100; i++) {
                bulk.insert({_id: i, neighbors: [i - 1, i + 1]});
            }
            bulk.execute();

            sourceCollection.insert({starting: 50});
        };
    },
    post: function lookupPost(sourceCollection) {
        var neighborCollName = sourceCollection.getName() + "_follower";
        var neighborCollection = sourceCollection.getDB()[neighborCollName];
        var backingCollName = sourceCollection.getName() + "_backing";
        var backingCollection = sourceCollection.getDB()[backingCollName];
        sourceCollection.drop();
        neighborCollection.drop();
        backingCollection.drop();
    },
    pipeline: [
        {
          $graphLookup: {
              from: "#B_COLL_neighbor",
              startWith: "$starting",
              connectFromField: "neighbors",
              connectToField: "_id",
              maxDepth: 10,
              depthField: "distence",
              as: "integers"
          }
        }
    ],
    tags: ["lookup"]
});

generateTestCase({
    name: "Match",
    nDocs: 500,
    docGenerator: function simpleMatchDocGenerator(i) {
        return {_id: i};
    },
    // Ensure that $match stage isn't pushed down to the query layer.
    pipeline: [{$_internalInhibitOptimization: {}}, {$match: {_idTimes10: {$lt: 250}}}]
});

/**
 * Makes a document generator which creates a document with 50 fields with the same value, and a
 * 'predicate' field set to 0 if 'i' is even and 1 otherwise.
 */
function docGenerator50FieldsOnePredicate(i) {
    var doc = {};
    for (var j = 0; j < 50; j++) {
        doc["field" + j] = "placeholder kinda big";
    }
    doc.predicate = i % 2;
    return doc;
}

generateTestCase({
    name: "MatchOneFieldFromBigDocument",
    nDocs: 1000,
    docGenerator: docGenerator50FieldsOnePredicate,
    // Ensure that $match stage isn't pushed down to the query layer.
    pipeline: [{$_internalInhibitOptimization: {}}, {$match: {predicate: {$eq: 0}}}]
});

generateTestCase({
    name: "MatchManyFieldsFromBigDocument",
    nDocs: 1000,
    docGenerator: docGenerator50FieldsOnePredicate,
    // Ensure that $match stage isn't pushed down to the query layer.
    pipeline: [
        {$_internalInhibitOptimization: {}},
        {
            $match: {
                predicate: {$eq: 0},
                // The following are present just to increase the number of fields we need to
                // serialize to BSON to perform the match.
                field0: {$type: "string"},
                field1: {$type: "string"},
                field2: {$type: "string"},
                field10: {$type: "string"},
                field25: {$type: "string"},
                field40: {$type: "string"},
                field48: {$type: "string"},
                field49: {$type: "string"},
            }
        }
    ]
});

generateTestCase({
    name: "Project",
    docGenerator: function simpleProjectionDocGenerator(i) {
        return {_id: i, w: i, x: i, y: i, z: i};
    },
    pipeline: [{$project: {_id: 0, x: 1, y: 1}}]
});

// Tests the performance of the ExpressionObject class, which is used to represent object literals.
// The easiest way to test this is with the $replaceRoot stage.
generateTestCase({
    name: "ExpressionObject",
    nDocs: 5000,
    docGenerator: function simpleReplaceRootDocGenerator(i) {
        return {_id: i, x: i, string: new Array(1024).join("x")};
    },
    pipeline: [
        {
            $replaceRoot: {
                newRoot: {
                    a: {$literal: 5},
                    longishNameHere: {$substr: ["$string", 0, 10]},
                    longishNameForNestedDocument: {
                        doingSomeMath: {$add: ["$x", 1]},
                        anotherSubDocument: {
                            literalField: {$literal: "Hello!"},
                            arrayField: [1, 2, 3, 4],
                        }
                    }
                }
            }
        }
    ],
});

generateTestCase({
    name: "Redact",
    docGenerator: function simpleRedactDocGenerator(i) {
        return {_id: i, has_permissions: i % 2 === 0};
    },
    pipeline: [{$redact: {$cond: {if: "$has_permissions", then: "$$DESCEND", else: "$$PRUNE"}}}]
});

generateTestCase({name: "Sample.SmallSample", nDocs: 500, pipeline: [{$sample: {size: 5}}]});

generateTestCase({name: "Sample.LargeSample", nDocs: 500, pipeline: [{$sample: {size: 200}}]});

generateTestCase({name: "Skip", nDocs: 500, pipeline: [{$skip: 250}], addSkipStage: false});

generateTestCase({
    name: "Sort",
    docGenerator: function simpleSortDocGenerator(i) {
        return {_id: i, x: Random.rand()};
    },
    pipeline: [{$sort: {x: 1}}]
});

generateTestCase({
    name: "Unwind",
    docGenerator: function simpleUnwindDocGenerator(i) {
        return {
            _id: i,
            array: [1, "some string data", new ObjectId(), null, NumberLong(23), [4, 5], {x: 1}]
        };
    },
    pipeline: [{$unwind: {path: "$array", includeArrayIndex: "index"}}]
});

//
// Multi-stage pipelines that should be optimized to some extent.
//

generateTestCase({
    name: "SortWithLimit",
    docGenerator: function simpleSortDocGenerator(i) {
        return {_id: i, x: Random.rand()};
    },
    pipeline: [{$sort: {x: 1}}, {$limit: 10}]
});

generateTestCase({
    name: "UnwindThenGroup",
    docGenerator: function simpleUnwindLargeDocGenerator(i) {
        var largeArray = [];
        for (var j = 0; j < 50; j++) {
            largeArray.push(getStringOfLength(10) + j);
        }
        return {_id: i, array: largeArray, largeString: getStringOfLength(1024 * 1024)};
    },
    pipeline: [{$unwind: "$array"}, {$group: {_id: "$array", count: {$sum: 1}}}]
});

generateTestCase({
    name: "UnwindThenMatch",
    docGenerator: function simpleUnwindAndMatchDocGenerator(i) {
        var valArray = [];
        for (var j = 0; j < 30; j++) {
            valArray.push(j % 10);
        }
        return {_id: i, array: valArray, smallString: getStringOfLength(10)};
    },
    pipeline: [{$unwind: "$array"}, {$match: {array: 5}}]
});

/**
 * Data population function used by 'UnwindThenSort' and 'UnwindThenSkip' tests. Geared towards
 * unwind tests that require/benefit from small documents.
 */
function simpleSmallDocUnwindGenerator(i) {
    var valArray = [];
    for (var j = 0; j < 10; j++) {
        valArray.push(getStringOfLength(10) + j);
    }
    return {_id: i, array: valArray, smallString: getStringOfLength(10)};
}

generateTestCase({
    name: "UnwindThenSort",
    docGenerator: simpleSmallDocUnwindGenerator,
    pipeline: [{$unwind: "$array"}, {$sort: {array: -1}}]
});

generateTestCase({
    name: "UnwindThenSkip",
    docGenerator: simpleSmallDocUnwindGenerator,
    pipeline: [{$unwind: "$array"}, {$skip: 10}]
});

//
// Count operations expressed as aggregations.
//

generateTestCase({
    name: "CountsFullCollection",
    tags: ["agg_query_comparison"],
    nDocs: 4800,
    docGenerator: function(i) {
        return {_id: i};
    },
    pipeline: [{$count: "n"}],
    addSkipStage: false,
});

generateTestCase({
    name: "CountsIntIDRange",
    tags: ["agg_query_comparison"],
    nDocs: 4800,
    docGenerator: function(i) {
        return {_id: i};
    },
    pipeline: [{$match: {_id: {$gt: 10, $lt: 100}}}, {$count: "n"}],
    addSkipStage: false,
});

//
// Distinct operations expressed as aggregations.
//

function distinctTestDocGenerator(i) {
    return {x: (i % 3) + 1};
}

generateTestCase({
    name: "DistinctWithIndex",
    tags: ["distinct", "agg_query_comparison"],
    nDocs: 14400,
    docGenerator: distinctTestDocGenerator,
    indices: [{x: 1}],
    pipeline: [
        {$unwind: {path: "$x", preserveNullAndEmptyArrays: true}},
        {$group: {_id: 1, distinct: {$addToSet: "$x"}}}
    ],
    addSkipStage: false,
});

generateTestCase({
    name: "DistinctWithIndexAndQuery",
    tags: ["distinct", "agg_query_comparison"],
    nDocs: 14400,
    docGenerator: distinctTestDocGenerator,
    indices: [{x: 1}],
    pipeline: [
        {$match: {x: 1}},
        {$unwind: {path: "$x", preserveNullAndEmptyArrays: true}},
        {$group: {_id: 1, distinct: {$addToSet: "$x"}}}
    ],
    addSkipStage: false,
});

generateTestCase({
    name: "DistinctWithoutIndex",
    tags: ["distinct", "agg_query_comparison"],
    nDocs: 14400,
    docGenerator: distinctTestDocGenerator,
    pipeline: [
        {$unwind: {path: "$x", preserveNullAndEmptyArrays: true}},
        {$group: {_id: 1, distinct: {$addToSet: "$x"}}}
    ],
    addSkipStage: false,
});

generateTestCase({
    name: "DistinctWithoutIndexAndQuery",
    tags: ["distinct", "agg_query_comparison"],
    nDocs: 14400,
    docGenerator: distinctTestDocGenerator,
    pipeline: [
        {$match: {x: 1}},
        {$unwind: {path: "$x", preserveNullAndEmptyArrays: true}},
        {$group: {_id: 1, distinct: {$addToSet: "$x"}}}
    ],
    addSkipStage: false,
});

generateTestCase({
    name: "SortByComputedField",
    tags: ["sort", "agg_query_comparison"],
    nDocs: 14400,
    docGenerator: function simpleSortDocGenerator(i) {
        return {_id: i, x: Random.randInt(200000)};
    },
    pipeline: [{$addFields: {y: {$add: ["$x", "$x"]}}}, {$sort: {y: 1}}]
});

function largeDocGenerator(i) {
    return {
        _id: i,
        x: Random.randInt(200000),
        y: 10,
        string1: getStringOfLength(50 * 1024),
        string2: getStringOfLength(50 * 1024),
        string3: getStringOfLength(50 * 1024),
        string4: getStringOfLength(50 * 1024),
        string5: getStringOfLength(50 * 1024),
        string6: getStringOfLength(50 * 1024),
        string7: getStringOfLength(50 * 1024),
        string8: getStringOfLength(50 * 1024),
        string9: getStringOfLength(50 * 1024)
    };
}

generateTestCase({
    name: "SortProjectWithBigDocuments",
    tags: ["sort", "agg_query_comparison"],
    nDocs: 220,
    docGenerator: largeDocGenerator,
    pipeline: [{$sort: {x: 1}}, {$project: {x: 1, y: 1}}]
});

// We set 'addSkipStage: false' flag for three workloads below because they already contain $skip
// stage skipping most of the documents from the input.
generateTestCase({
    name: "SortProjectSkipWithBigDocuments",
    tags: ["sort", "agg_query_comparison"],
    nDocs: 220,
    docGenerator: largeDocGenerator,
    pipeline: [{$sort: {x: 1}}, {$project: {x: 1, y: 1}}, {$skip: 200}],
    addSkipStage: false
});

generateTestCase({
    name: "SortSkipProjectWithBigDocuments",
    tags: ["sort", "agg_query_comparison"],
    nDocs: 220,
    docGenerator: largeDocGenerator,
    pipeline: [{$sort: {x: 1}}, {$skip: 200}, {$project: {x: 1, y: 1}}],
    addSkipStage: false
});

generateTestCase({
    name: "ProjectSkipWithBigDocuments",
    tags: ["agg_query_comparison"],
    nDocs: 220,
    docGenerator: largeDocGenerator,
    pipeline: [
        {
            $project: {
                string1: 1,
                string2: 1,
                string3: 1,
                string4: 1,
                string5: 1,
                string6: 1,
                string7: 1,
                string8: 1,
                string9: 1
            }
        },
        {$skip: 200}
    ],
    addSkipStage: false
});

function sortGroupBigDocGenerator(i) {
    return {
        _id: i,
        x: Random.randInt(200000),
        y: 10,
        z: Random.randInt(50),
        string1: getStringOfLength(50 * 1024),
        string2: getStringOfLength(50 * 1024),
        string3: getStringOfLength(50 * 1024),
        string4: getStringOfLength(50 * 1024),
        string5: getStringOfLength(50 * 1024),
        string6: getStringOfLength(50 * 1024),
        string7: getStringOfLength(50 * 1024),
        string8: getStringOfLength(50 * 1024),
        string9: getStringOfLength(50 * 1024)
    };
}

generateTestCase({
    name: "SortGroupWithBigDocuments",
    tags: ["sort"],
    nDocs: 220,
    docGenerator: sortGroupBigDocGenerator,
    pipeline: [{$sort: {x: 1}}, {$group: {_id: "$z", x: {$last: "$x"}, y: {$last: "$y"}}}]
});

generateTestCase({
    name: "IndexedSortGroupWithBigDocuments",
    tags: ["sort"],
    nDocs: 220,
    indices: [{x: 1}],
    docGenerator: sortGroupBigDocGenerator,
    pipeline: [{$sort: {x: 1}}, {$group: {_id: "$z", x: {$last: "$x"}, y: {$last: "$y"}}}]
});

/**
 * test the performance of $function using document shapes similar to $where.
 */
generateTestCase({
    name: "Function.CompareToInt",
    tags: ['js', '>=4.3.4'],
    nDocs: 500,
    docGenerator: increasingXGenerator(),
    pipeline: [
        {
            $match: {
                $expr: {
                    $function: {
                        body: function(x) {
                            return x == 1;
                        },
                        args: ["$x"],
                        lang: 'js',
                    }
                }
            }
        },
    ],
});

generateTestCase({
    name: "Function.SimpleNested.FieldPathInArgs",
    tags: ['js', '>=4.3.4'],
    nDocs: 13,
    docGenerator: nestedGenerator(false),
    pipeline: [
        {
            $match: {
                $expr: {
                    $function: {
                        body: function(x) {
                            return x == 1;
                        },
                        args: ["$d.b.c.a"],
                        lang: 'js',
                    }
                }
            }
        },
    ],
});

generateTestCase({
    name: "Function.SimpleNested.CurrentInArgs",
    tags: ['js', '>=4.3.4'],
    nDocs: 100,
    docGenerator: nestedGenerator(false),
    pipeline: [
        {
            $match: {
                $expr: {
                    $function: {
                        body: function(doc) {
                            return doc.d.c.b.a == 1;
                        },
                        args: ["$$CURRENT"],
                        lang: 'js',
                    }
                }
            }
        },
    ],
});

generateTestCase({
    name: "Function.CompareFields.Eq.CurrentInArgs",
    tags: ['js', '>=4.3.4'],
    nDocs: 100,
    docGenerator: increasingXGenerator(),
    pipeline: [
        {
            $match: {
                $expr: {
                    $function: {
                        body: function(doc) {
                            return doc.x == doc.y;
                        },
                        args: ["$$CURRENT"],
                        lang: 'js',
                    }
                }
            }
        },
    ],
});

generateTestCase({
    name: "Function.CompareFields.Eq.TwoArgs",
    tags: ['js', '>=4.3.4'],
    nDocs: 100,
    docGenerator: increasingXGenerator(),
    pipeline: [
        {
            $match: {
                $expr: {
                    $function: {
                        body: function(x, y) {
                            return x == y;
                        },
                        args: ["$x", "$y"],
                        lang: 'js',
                    }
                }
            }
        },
    ],
});

generateTestCase({
    name: "Function.CompareFields.Gt.CurrentInArgs",
    tags: ['js', '>=4.3.4'],
    nDocs: 200,
    docGenerator: tupleGenerator(200),
    pipeline: [
        {
            $match: {
                $expr: {
                    $function: {
                        body: function(doc) {
                            return doc.x > doc.y;
                        },
                        args: ["$$CURRENT"],
                        lang: 'js',
                    }
                }
            }
        },
    ],
});

generateTestCase({
    name: "Function.CompareFields.Gt.TwoArgs",
    tags: ['js', '>=4.3.4'],
    nDocs: 200,
    docGenerator: tupleGenerator(200),
    pipeline: [
        {
            $match: {
                $expr: {
                    $function: {
                        body: function(x, y) {
                            return x > y;
                        },
                        args: ["$x", "$y"],
                        lang: 'js',
                    }
                }
            }
        },
    ],
});

generateTestCase({
    name: "Function.CompareFields.Lt.CurrentInArgs",
    tags: ['js', '>=4.3.4'],
    nDocs: 200,
    docGenerator: tupleGenerator(200),
    pipeline: [
        {
            $match: {
                $expr: {
                    $function: {
                        body: function(doc) {
                            return doc.x < doc.y;
                        },
                        args: ["$$CURRENT"],
                        lang: 'js',
                    }
                }
            }
        },
    ],
});

generateTestCase({
    name: "Function.CompareFields.Lt.TwoArgs",
    tags: ['js', '>=4.3.4'],
    nDocs: 200,
    docGenerator: tupleGenerator(200),
    pipeline: [
        {
            $match: {
                $expr: {
                    $function: {
                        body: function(x, y) {
                            return x < y;
                        },
                        args: ["$x", "$y"],
                        lang: 'js',
                    }
                }
            }
        },
    ],
});

generateTestCase({
    name: "Function.Mixed",
    tags: ['js', '>=4.3.4'],
    nDocs: 200,
    docGenerator: tupleGenerator(200),
    pipeline: [{
        $match: {
            $or: [
                {x: 2},
                {
                    $expr: {
                        $function: {
                            body: function(y) {
                                return y == 3;
                            },
                            args: ["$y"],
                            lang: 'js',
                        }
                    }
                }
            ]
        },
    }],
});

generateTestCase({
    name: "Function.ComplexNested.CurrentInArgs",
    tags: ['js', '>=4.3.4'],
    nDocs: 10,
    docGenerator: nestedGenerator(true),
    pipeline: [{
        $match: {
            $expr: {
                $function: {
                    body: function(doc) {
                        return doc.d.c.b.a == doc.a.b.c.d;
                    },
                    args: ["$$CURRENT"],
                    lang: 'js'
                }
            }
        }
    }]
});

/**
 * Basic test case with a $unionWith stage.
 */
generateTestCase({
    name: "UnionWith.Basic",
    tags: ["unionWith", ">=4.3.5"],
    pre: function basicUnionFun(isView) {
        return basicMultiCollectionDataPopulator({
            isView: isView,
            foreignCollsInfo: [{
                suffix: "_unionWith",
                docGen: function f(i) {
                    return {_id: i};
                }
            }],
            localDocGen: function f(i) {
                return {_id: i};
            },
            nDocs: 1000
        });
    },
    post: function cleanup(sourceColl) {
        sourceColl.drop();
        sourceColl.getDB()[sourceColl.getName() + "_backing"].drop();
        sourceColl.getDB()[sourceColl.getName() + "_unionWith"].drop();
    },
    pipeline: [{$unionWith: {coll: '#B_COLL_unionWith'}}]
});

/**
 * Test case with multiple levels of $unionWith and no indexes present.
 */
generateTestCase({
    name: "UnionWith.MultiLevelNoIndex",
    tags: ["unionWith", ">=4.3.5"],
    pre: function basicUnionFun(isView) {
        return basicMultiCollectionDataPopulator({
            isView: isView,
            foreignCollsInfo: [
                {
                    suffix: "_unionWith1",
                    docGen: function docGenerator(val) {
                        return {_id: val};
                    }
                },
                {
                    suffix: "_unionWith2",
                    docGen: function docGenerator(val) {
                        return {_id: val};
                    }
                }
            ],
            localDocGen: function docGenerator(val) {
                return {_id: val, a: val, b: val};
            },
            nDocs: 1000
        });
    },
    post: function cleanup(sourceColl) {
        sourceColl.drop();
        sourceColl.getDB()[sourceColl.getName() + "_backing"].drop();
        sourceColl.getDB()[sourceColl.getName() + "_unionWith1"].drop();
        sourceColl.getDB()[sourceColl.getName() + "_unionWith2"].drop();
    },
    pipeline: [{
        $match: {a: 1}},  {
        $unionWith: {
            coll: '#B_COLL_unionWith1',
            pipeline: [
                {
                    $unionWith: {
                        coll: '#B_COLL_unionWith2',
                        pipeline: [{$unionWith: {coll: '#B_COLL', pipeline: [{$match: {b: 1}}]}}]
                    }
                }
            ]
        }
    }]
});

generateTestCase({
    name: "Function.ComplexNested.TwoArgs",
    tags: ['js', '>=4.3.4'],
    nDocs: 10,
    docGenerator: nestedGenerator(true),
    pipeline: [{
        $match: {
            $expr: {
                $function: {
                    body: function(x, y) {
                        return x == y;
                    },
                    args: ["$x", "$y"],
                    lang: 'js'
                }
            }
        }
    }]
});

generateTestCase({
    name: "Function.ReallyBigNestedComparison.CurrentInArgs",
    tags: ['js', '>=4.3.4'],
    nDocs: 10,
    docGenerator: nestedGenerator(true),
    pipeline: [{
        $match: {
            $expr: {
                $function: {
                    body: function(doc) {
                        return doc.a.b.c.d == 1;
                    },
                    args: ["$$CURRENT"],
                    lang: 'js'
                }
            }
        }
    }]
});

/**
 * Test case with multiple levels of $unionWith and indexes present for corresponding $match stages.
 */
generateTestCase({
    name: "UnionWith.MultiLevelWithIndex",
    tags: ["unionWith", ">=4.3.4"],
    indices: [{a: 1},{b: 1}],
    pre: function basicUnionFun(isView) {
        return basicMultiCollectionDataPopulator({
            isView: isView,
            foreignCollsInfo: [
                {
                    suffix: "_unionWith1",
                    docGen: function docGenerator(val) {
                        return {_id: val};
                    }
                },
                {
                    suffix: "_unionWith2",
                    docGen: function docGenerator(val) {
                        return {_id: val};
                    }
                }
            ],
            localDocGen: function docGenerator(val) {
                return {_id: val, a: val, b: val};
            },
            nDocs: 1000
        });
    },
    post: function cleanup(sourceColl) {
        sourceColl.drop();
        sourceColl.getDB()[sourceColl.getName() + "_backing"].drop();
        sourceColl.getDB()[sourceColl.getName() + "_unionWith1"].drop();
        sourceColl.getDB()[sourceColl.getName() + "_unionWith2"].drop();
    },
    pipeline: [{
        $match: {a: 1}}, {
        $unionWith: {
            coll: '#B_COLL_unionWith1',
            pipeline: [
                {
                    $unionWith: {
                        coll: '#B_COLL_unionWith2',
                        pipeline: [{$unionWith: {coll: '#B_COLL', pipeline: [{$match: {b: 1}}]}}]
                    }
                }
            ]
        }
    }]
});

generateTestCase({
    name: "Function.ReallyBigNestedComparison.FieldPathInArgs",
    tags: ['js', '>=4.3.4'],
    nDocs: 10,
    docGenerator: nestedGenerator(true),
    pipeline: [{
        $match: {
            $expr: {
                $function: {
                    body: function(x) {
                        return x == 1;
                    },
                    args: ["$a.b.c.d"],
                    lang: 'js'
                }
            }
        }
    }]
});

/**
 * Test case where a $unionWith'd pipeline has a blocking stage.
 */
generateTestCase({
    name: "UnionWith.BlockingStage",
    tags: ["unionWith", ">=4.3.4"],
    pre: function basicUnionFun(isView) {
        return basicMultiCollectionDataPopulator({
            isView: isView,
            foreignCollsInfo: [{
                suffix: "_unionWith",
                docGen: function f(i) {
                    return {_id: i, val: i};
                }
            }],
            localDocGen: function f(i) {
                return {_id: i, val: i};
            },
            nDocs: 1000
        });
    },
    post: function cleanup(sourceColl) {
        sourceColl.drop();
        sourceColl.getDB()[sourceColl.getName() + "_backing"].drop();
        sourceColl.getDB()[sourceColl.getName() + "_unionWith"].drop();
    },
    pipeline: [{$unionWith: {coll: '#B_COLL_unionWith', pipeline: [{$sort: {val: 1}}]}}]
});

/**
 * Benchmarks for $group with a large dataset targeting the basic performance of the stage in a
 * systematic way.
 *
 * Naming convention: TestName_<collection_size><doc_size>[R]<group_cardinality>
 * collection_size ::= L
 * doc_size ::= S | L
 * group_cardinality :: = 10 | 100 | ...
 * R means accessing fields at the end of the document (only applies to tests with doc_size = L)
 */

// Group on top field, no accumulators
generateTestCaseWithLargeDataset({
    name: "Group.NoAccTopField_LS10", docGenerator: smallDoc, pipeline: [{$group: {_id: "$a"}}]
});
generateTestCaseWithLargeDataset({
    name: "Group.NoAccTopField_LS1000", docGenerator: smallDoc, pipeline: [{$group: {_id: "$b"}}]
});
generateTestCaseWithLargeDataset({
    name: "Group.NoAccTopField_LL10", docGenerator: largeDoc, pipeline: [{$group: {_id: "$a"}}]
});
generateTestCaseWithLargeDataset({
    name: "Group.NoAccTopField_LL1000", docGenerator: largeDoc, pipeline: [{$group: {_id: "$b"}}]
});
generateTestCaseWithLargeDataset({
    name: "Group.NoAccTopField_LLR10", docGenerator: largeDoc, pipeline: [{$group: {_id: "$aa"}}]
});

// Group on sub-field, no accumulators
generateTestCaseWithLargeDataset({
    name: "Group.NoAccSubField_LS10", docGenerator: smallDoc, pipeline: [{$group: {_id: "$e.a"}}]
});
generateTestCaseWithLargeDataset({
    name: "Group.NoAccSubField_LL10", docGenerator: largeDoc, pipeline: [{$group: {_id: "$e.a"}}]
});
generateTestCaseWithLargeDataset({
    name: "Group.NoAccSubField_LLR10", docGenerator: largeDoc, pipeline: [{$group: {_id: "$ee.a"}}]
});

// $min
generateTestCaseWithLargeDataset({
    name: "Group.MinAccTopField_LS10",
    docGenerator: smallDoc,
    pipeline: [{$group: {_id: "$a", res: {$min: "$c"}}}]
});
generateTestCaseWithLargeDataset({
    name: "Group.MinAccTopField_LS1000",
    docGenerator: smallDoc,
    pipeline: [{$group: {_id: "$b", res: {$min: "$c"}}}]
});
generateTestCaseWithLargeDataset({
    name: "Group.MinAccTopField_LL10",
    docGenerator: largeDoc,
    pipeline: [{$group: {_id: "$a", res: {$min: "$c"}}}]
});
generateTestCaseWithLargeDataset({
    name: "Group.MinAccTopField_LL1000",
    docGenerator: largeDoc,
    pipeline: [{$group: {_id: "$b", res: {$min: "$c"}}}]
});
generateTestCaseWithLargeDataset({
    name: "Group.MinAccTopField_LLR10",
    docGenerator: largeDoc,
    pipeline: [{$group: {_id: "$aa", res: {$min: "$cc"}}}]
});

// $max
generateTestCaseWithLargeDataset({
    name: "Group.MaxAccTopField_LL10",
    docGenerator: largeDoc,
    pipeline: [{$group: {_id: "$a", res: {$max: "$c"}}}]
});

// $first
generateTestCaseWithLargeDataset({
    name: "Group.FirstAccTopField_LL10",
    docGenerator: largeDoc,
    pipeline: [{$group: {_id: "$a", res: {$first: "$c"}}}]
});
generateTestCaseWithLargeDataset({
    name: "Group.FirstAccTopField_LL1000",
    docGenerator: largeDoc,
    pipeline: [{$group: {_id: "$b", res: {$first: "$c"}}}]
});

// $last
generateTestCaseWithLargeDataset({
    name: "Group.LastAccTopField_LL10",
    docGenerator: largeDoc,
    pipeline: [{$group: {_id: "$a", res: {$last: "$c"}}}]
});
generateTestCaseWithLargeDataset({
    name: "Group.LastAccTopField_LL1000",
    docGenerator: largeDoc,
    pipeline: [{$group: {_id: "$b", res: {$last: "$c"}}}]
});

// $sum
generateTestCaseWithLargeDataset({
    name: "Group.SumAccTopField_LL10",
    docGenerator: largeDoc,
    pipeline: [{$group: {_id: "$a", res: {$sum: "$c"}}}]
});
generateTestCaseWithLargeDataset({
    name: "Group.SumAccTopField_LL1000",
    docGenerator: largeDoc,
    pipeline: [{$group: {_id: "$b", res: {$sum: "$c"}}}]
});

// $avg
generateTestCaseWithLargeDataset({
    name: "Group.AvgAccTopField_LL10",
    docGenerator: largeDoc,
    pipeline: [{$group: {_id: "$a", res: {$avg: "$c"}}}]
});

// $stdDevPop
generateTestCaseWithLargeDataset({
    name: "Group.StdDevPopAccTopField_LL10",
    docGenerator: largeDoc,
    pipeline: [{$group: {_id: "$a", res: {$stdDevPop: "$c"}}}]
});

// $stdDevSamp
generateTestCaseWithLargeDataset({
    name: "Group.StdDevSampAccTopField_LL10",
    docGenerator: largeDoc,
    pipeline: [{$group: {_id: "$a", res: {$stdDevSamp: "$c"}}}]
});

// $addToSet
// TODO: Tests with larger accumulated sets (e.g. [{$group: {_id: "$a", res: {$addToSet: "$i"}}}]) 
// would require 'allowDiskUse()'. Need to figure out whether it's possible to run them via benchrun.
generateTestCaseWithLargeDataset({
    name: "Group.AddToSetAccTopFieldSmallResultingSet_LL10",
    docGenerator: largeDoc,
    pipeline: [{$group: {_id: "$a", res: {$addToSet: "$g"}}}] // 10 sets of 10 items each
});

// $push
// [{$group: {_id: "$a", res: {$push: "$b"}}}] (10^5 docs, 10 groups => ~10^4 items in each 'res')
// [{$group: {_id: "$b", res: {$push: "$a"}}}] (10^5 docs, 10^3 groups => ~10^2 items ins each 'res')
// Both queries would require 'allowDiskUse()'. Need to figure out whether it's possible to run them
// via benchrun.

// $mergeObjects
generateTestCaseWithLargeDataset({
    name: "Group.MergeObjectsAccTopField_LL10",
    docGenerator: largeDoc,
    pipeline: [{$group: {_id: "$a", res: {$mergeObjects: "$e"}}}]
});
generateTestCaseWithLargeDataset({
    name: "Group.MergeObjectsAccTopField_LL1000",
    docGenerator: largeDoc,
    pipeline: [{$group: {_id: "$b", res: {$mergeObjects: "$e"}}}]
});

// Multiple (3) accumulators on the same field.
generateTestCaseWithLargeDataset({
    name: "Group.MultipleAccSameTopField_LL10",
    docGenerator: largeDoc,
    pipeline: [{$group: {_id: "$a", min: {$min: "$c"}, max: {$max: "$c"}, avg: {$avg: "$c"}}}]
});
generateTestCaseWithLargeDataset({
    name: "Group.MultipleAccSameTopField_LLR10",
    docGenerator: largeDoc,
    pipeline: [{$group: {_id: "$aa", min: {$min: "$cc"}, max: {$max: "$cc"}, avg: {$avg: "$cc"}}}]
});
generateTestCaseWithLargeDataset({
    name: "Group.MultipleAccSameSubField_LL10",
    docGenerator: largeDoc,
    pipeline: [{$group: {_id: "$a", min: {$min: "$e.c"}, max: {$max: "$e.c"}, avg: {$avg: "$e.c"}}}]
});

// Multiple (3) accumulators on different fields.
generateTestCaseWithLargeDataset({
    name: "Group.MultipleAccDiffTopFields_LL10",
    docGenerator: largeDoc,
    pipeline: [{$group: {_id: "$a", min: {$min: "$c"}, max: {$max: "$g"}, avg: {$avg: "$h"}}}]
});
generateTestCaseWithLargeDataset({
    name: "Group.MultipleAccDiffTopFields_LLR10",
    docGenerator: largeDoc,
    pipeline: [{$group: {_id: "$aa", min: {$min: "$cc"}, max: {$max: "$gg"}, avg: {$avg: "$hh"}}}]
});
generateTestCaseWithLargeDataset({
    name: "Group.MultipleAccDiffSubFields_LL10",
    docGenerator: largeDoc,
    pipeline: [{$group: {_id: "$a", min: {$min: "$e.c"}, max: {$max: "$e.g"}, avg: {$avg: "$e.h"}}}]
});

// Multiple (12) accumulators on top fields.
generateTestCaseWithLargeDataset({
    name: "Group.MultipleAccDiffTopFieldsStress_LL10",
    docGenerator: largeDoc,
    pipeline: [
        {$group: {_id: "$a", 
            o1: {$min: "$b"}, o2: {$max: "$c"}, o3: {$avg: "$d"},
            o4: {$sum: "$g"}, o5: {$first: "$h"}, o6: {$last: "$i"},
            o7: {$sum: "$bb"}, o8: {$first: "$cc"}, o9: {$last: "$dd"},
            o10: {$min: "$gg"}, o11: {$max: "$hh"}, o12: {$avg: "$ii"},
        }}
    ]
});
generateTestCaseWithLargeDataset({
    name: "Group.MultipleAccSameTopFieldStress_LL10",
    docGenerator: largeDoc,
    pipeline: [
        {$group: {_id: "$a", 
            o1: {$min: "$c"}, o2: {$max: "$c"}, o3: {$avg: "$c"},
            o4: {$sum: "$c"}, o5: {$first: "$c"}, o6: {$last: "$c"},
            o7: {$sum: "$c"}, o8: {$first: "$c"}, o9: {$last: "$c"},
            o10: {$min: "$c"}, o11: {$max: "$c"}, o12: {$avg: "$c"},
        }}
    ]
});
generateTestCaseWithLargeDataset({
    name: "Group.MultipleAccSameSubFieldStress_LL10",
    docGenerator: largeDoc,
    pipeline: [
        {$group: {_id: "$a", 
            o1: {$min: "$e.c"}, o2: {$max: "$e.c"}, o3: {$avg: "$e.c"},
            o4: {$sum: "$e.c"}, o5: {$first: "$e.c"}, o6: {$last: "$e.c"},
            o7: {$sum: "$e.c"}, o8: {$first: "$e.c"}, o9: {$last: "$e.c"},
            o10: {$min: "$e.c"}, o11: {$max: "$e.c"}, o12: {$avg: "$e.c"},
        }}
    ]
});

// Multiple $group stages.
generateTestCaseWithLargeDataset({
    name: "Group.MultipleGroupStages_LS",
    docGenerator: smallDoc,
    pipeline: [
        {$group: {_id: "$b", f: {$first: "$a"}, av: {$avg: "$a"}}},
        {$group: {_id: "$f", min: {$min: "$av"}, max: {$max: "$av"}}}
    ]
});
generateTestCaseWithLargeDataset({
    name: "Group.MultipleGroupStages_LL",
    docGenerator: largeDoc,
    pipeline: [
        {$group: {_id: "$b", f: {$first: "$a"}, av: {$avg: "$a"}}},
        {$group: {_id: "$f", min: {$min: "$av"}, max: {$max: "$av"}}}
    ]
});
generateTestCaseWithLargeDataset({
    name: "Group.MultipleGroupStagesWithMatchBetween_LS",
    docGenerator: smallDoc,
    pipeline: [
        {$group: {_id: "$b", f: {$first: "$a"}, av: {$avg: "$a"}}},
        {$match: {av: {$gt:4.5}}},
        {$group: {_id: "$f", min: {$min: "$av"}, max: {$max: "$av"}}}
    ]
});
})();

