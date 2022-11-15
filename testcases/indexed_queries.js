if (typeof(tests) !== "object") {
    tests = [];
}

(function() {
    "use strict";

    Random.setRandomSeed(258);

    // Tests: indexed plans
    let dropIndexesAndCaches = function (collection) {
        collection.dropIndexes();
        collection.getPlanCache().clear();
    }
    let createIndexes = function (collection, indexes) {
        indexes.forEach(function (index) {
            assert.commandWorked(collection.createIndex(index));
        });
    }

    function addTestCaseWithLargeDatasetAndIndexes(options) {
        options.pre = function (collection) {
            dropIndexesAndCaches(collection);
            createIndexes(collection, options.indexes);
        };
        options.post = dropIndexesAndCaches;
        addTestCaseWithLargeDataset(options);
    }

    addTestCaseWithLargeDatasetAndIndexes({
        name: "PointQuery_SingleIndex_LL",
        docGenerator: largeDoc,
        indexes: [{"a": 1}],
        query: {"a": 7}
    });
    addTestCaseWithLargeDatasetAndIndexes({
        name: "RangeQuery_SingleIndex_LowSelectivityMatch_LL",
        docGenerator: largeDoc,
        indexes: [{"a": 1}],
        query: {"a": {$gt: 1}}
    });
    addTestCaseWithLargeDatasetAndIndexes({
        name: "PointQuery_MultipleIndexes_LL",
        docGenerator: largeDoc,
        indexes: [{"a": 1}, {"b": 1}, {"a": 1, "b": 1}],
        query: {"a": 7, "b": 742}
    });
    addTestCaseWithLargeDatasetAndIndexes({
        name: "RangeQuery_MultipleIndexes_LowSelectivityMatch_LL",
        tags: ["indexed"],
        docGenerator: largeDoc,
        indexes: [{"a": 1}, {"b": 1}, {"a": 1, "b": 1}],
        query: {"a": {$gt: 1}, "b": {$lt: 900}}
    });
    addTestCaseWithLargeDatasetAndIndexes({
        name: "PointQuerySubField_SingleIndex_LL",
        docGenerator: largeDoc,
        indexes: [{"e.a": 1}],
        query: {"e.a": 7}
    });
    addTestCaseWithLargeDatasetAndIndexes({
        name: "RangeQuerySubField_SingleIndex_LowSelectivityMatch_LL",
        docGenerator: largeDoc,
        indexes: [{"e.a": 1}],
        query: {"e.a": {$gt: 1}}
    });

    // Select ~1% from a single indexed field.
    addTestCaseWithLargeDatasetAndIndexes({
        name: "RangeQuery_SingleIndex_SimpleRange_LS",
        tags: ["indexed"],
        docGenerator: smallDoc,
        indexes: [{"b": 1}],
        query: {"b": {$gt: 100, $lt: 109}}
    });

    // Select ~99% from a single indexed field.
    addTestCaseWithLargeDatasetAndIndexes({
        name: "RangeQuery_SingleIndex_SimpleRange_LowSelectivityMatch_LS",
        tags: ["indexed"],
        docGenerator: smallDoc,
        indexes: [{"b": 1}],
        query: {"b": {$gt: 1, $lt: 999}}
    });

    /**
     * Large arrays used for $in queries in the subsequent test cases.
     */
    var nLargeArrayElements = 1000;
    var largeArrayRandom = [];
    for (var i = 0; i < nLargeArrayElements; i++) {
        largeArrayRandom.push(Random.randInt(nLargeArrayElements));
    }

    // Select ~90% with two range predicates on two indexed fields of a compound index.
    addTestCaseWithLargeDatasetAndIndexes({
        name: "RangeQuery_CompoundIndex_SingleIntervals_LS",
        tags: ["indexed"],
        docGenerator: smallDoc,
        indexes: [{"b": 1, "h": 1}],
        query: {"b": {"$in": largeArrayRandom}, "h": {$gt: 100}}
    });

    // Select ~99% from a single indexed field.
    addTestCaseWithLargeDatasetAndIndexes({
        name: "RangeQuery_SingleFieldIndex_ComplexBounds_LS",
        tags: ["indexed"],
        docGenerator: smallDoc,
        indexes: [{"b": 1}],
        query: {$or: [{"b": {$gt: 99}}, {"b": {$lt: 9}}, {"b": {"$in": largeArrayRandom}}]}
    });

    // Select ~99% from two indexed fields of a compound index. There is a range predicate on the
    // leading field and a union of point predicates on the trailing field.
    addTestCaseWithLargeDatasetAndIndexes({
        name: "RangeQuery_CompoundIndex_ComplexBounds_TwoFields_LS",
        tags: ["indexed"],
        docGenerator: smallDoc,
        indexes: [{"h": 1, "b": 1}],
        query: {"h": {$gt: 1}, "b": {"$in": largeArrayRandom}}
    });

    // Select ~99% from three indexed fields of a compound index. There is a range predicate on
    // the leading field and unions of point intervals on the trailing fields.
    addTestCaseWithLargeDatasetAndIndexes({
        name: "RangeQuery_CompoundIndex_ComplexBounds_ThreeFields_LS",
        tags: ["indexed"],
        docGenerator: smallDoc,
        indexes: [{"h": 1, "b": 1, "a": 1}],
        query: {"h": {$gt: 1}, "b": {"$in": largeArrayRandom}, "a": {"$in": largeArrayRandom}}
    });

    // Select ~99% from two indexed fields of a compound index with range predicates on both fields.
    addTestCaseWithLargeDatasetAndIndexes({
        name: "RangeQuery_CompoundIndex_ComplexBounds_TwoFields_Range_LS",
        tags: ["indexed"],
        docGenerator: smallDoc,
        indexes: [{"h": 1, "b": 1}],
        query: {"h": {$gt: 1}, "b": {$lt: 100}}
    });

    // Select ~99% from three indexed fields of a compound index with range predicates on all
    // three fields.
    addTestCaseWithLargeDatasetAndIndexes({
        name: "RangeQuery_CompoundIndex_ComplexBounds_ThreeFields_Range_LS",
        tags: ["indexed"],
        docGenerator: smallDoc,
        indexes: [{"h": 1, "b": 1, "a": 1}],
        query: {"h": {$gt: 1}, "b": {$lt: 100}, "a": {$gt: 1}}
    });

    // Select ~99% from five indexed fields of a compound index.
    addTestCaseWithLargeDatasetAndIndexes({
        name: "RangeQuery_CompoundIndex_ComplexBounds_FiveFields_Range_LS",
        tags: ["indexed"],
        docGenerator: smallDoc,
        indexes: [{"h": 1, "b": 1, "e.b": 1, "d": 1, "e.h": 1}],
        query: {"h": {$gt: 1}, "b": {$lt: 100}, "e.b": {$gt: 1}, "d": {$gt: 10}, "e.h": {$gt: 1}}
    });
}());