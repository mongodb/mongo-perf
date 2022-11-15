if (typeof(tests) !== "object") {
    tests = [];
}

(function() {
    "use strict";

    Random.setRandomSeed(258);

    /**
     * Setup: Create a collection with an array of scalars x:[...].
     *
     * Test: Sort the collection by the x (array) field.
     */
    addQueryTestCase({
        name: "SortByArrayOfScalars",
        tags: ["core", "sort"],
        // TODO (SERVER-5722): We cannot create a views passthrough because benchRun doesn't support
        // sorting when running in read command mode.
        createViewsPassthrough: false,
        nDocs: 1000,
        docs: function (i) {
            var nArrayElements = 10;
            var arrayRandom = [];
            for (var i = 0; i < nArrayElements; i++) {
                arrayRandom.push(Random.randInt(10000));
            }
            return {x: arrayRandom};
        },
        op: {op: "find", query: {}, sort: {x: 1}}
    });

    /**
     * Setup: Create a collection with an array of documents arr:[x:{...},...].
     *
     * Test: Sort the collection by the nested arr.x field.
     */
    addQueryTestCase({
        name: "SortByArrayOfNestedDocuments",
        tags: ["core", "sort"],
        // TODO (SERVER-5722): We cannot create a views passthrough because benchRun doesn't support
        // sorting when running in read command mode.
        createViewsPassthrough: false,
        nDocs: 1000,
        docs: function (i) {
            var nArrayElements = 10;
            var arrayRandom = [];
            for (var j = 0; j < nArrayElements; j++) {
                arrayRandom.push({x: Random.randInt(10000)});
            }
            return {arr: arrayRandom};
        },
        op: {op: "find", query: {}, sort: {"arr.x": 1}}
    });

    /**
     * Setup: Create a collection with a scalar field x and an index on x.
     *
     * Test: Sort the collection by the x field.
     */
    addQueryTestCase({
        name: "CoveredNonBlockingSort",
        tags: ["core", "sort", "indexed"],
        // TODO (SERVER-5722): We cannot create a views passthrough because benchRun doesn't support
        // sorting when running in read command mode.
        createViewsPassthrough: false,
        nDocs: 1000,
        docs: function (i) {
            return {x: Random.randInt(10000)};
        },
        indexes: [{x: 1}],
        op: {op: "find", query: {}, sort: {x: 1}, filter: {x: 1, _id: 0}}
    });

    /**
     * Setup: Create a collection with scalar fields x, y and an index on x, y.
     *
     * Test: Sort the collection by the y field which is eligible for covering but still requires a
     * blocking SORT stage.
     */
    addQueryTestCase({
        name: "CoveredBlockingSort",
        tags: ["core", "sort", "indexed"],
        // TODO (SERVER-5722): We cannot create a views passthrough because benchRun doesn't support
        // sorting when running in read command mode.
        createViewsPassthrough: false,
        nDocs: 1000,
        docs: function (i) {
            return {x: Random.randInt(10000), y: Random.randInt(10000)};
        },
        indexes: [{x: 1, y: 1}],
        op: {
            op: "find",
            query: {x: {$gt: 0}, y: {$gt: 0}},
            filter: {x: 1, y: 1, _id: 0},
            sort: {y: 1},
        }
    });

    /**
     * Setup: Create a collection with field 'x' and indexed field 'y'.
     *
     * Test: Query the collection by 'x' field and sort by the 'y' field.
     */
    addQueryTestCase({
        name: "NonCoveredNonBlockingSort",
        tags: ["core", "sort", "indexed"],
        createViewsPassthrough: false,
        createAggregationTest: false,
        nDocs: 1000,
        docs: function (i) {
            return {x: Random.randInt(10000), y: Random.randInt(10000)};
        },
        indexes: [{y: 1}],
        op: {
            op: "find",
            query: {x: {$gt: 0}},
            filter: {x: 1, y: 1, _id: 0},
            sort: {y: 1},
        }
    });

    /**
     * Setup: Create a collection with indexed fields 'a', 'b', and 'c'.
     *
     * Test: Query the collection by 'a' and 'b' fields using $or then sort by the 'c' field,
     * MERGE_SORT will be used to merge two branches from $or.
     */
    addQueryTestCase({
        name: "CoveredMergeSort",
        tags: ["core", "sort", "indexed"],
        createViewsPassthrough: false,
        createAggregationTest: false,
        nDocs: 1000,
        docs: function (i) {
            return {a: Random.randInt(5), b: Random.randInt(5), c: Random.randInt(10000)};
        },
        indexes: [{a: 1, b: 1, c: 1}],
        op: {
            op: "find",
            query: {$or: [{a: 1, b: 2}, {a: 2, b: 3}]},
            filter: {a: 1, b: 1, c: 1, _id: 0},
            sort: {c: 1},
        }
    });

    /**
     * Setup: Create a collection with indexed field 'x', and unindexed field 'y'.
     *
     * Test: Query the collection by 'x' and 'y' fields using $or then sort by the 'x' field,
     * MERGE_SORT will be used to merge two branches from $or.
     */
    addQueryTestCase({
        name: "NonCoveredMergeSort",
        tags: ["core", "sort", "indexed"],
        createViewsPassthrough: false,
        createAggregationTest: false,
        nDocs: 1000,
        docs: function (i) {
            return {x: Random.randInt(10), y: Random.randInt(5)};
        },
        indexes: [{x: 1}],
        op: {
            op: "find",
            query: {$or: [{x: 1, y: 2}, {x: 2, y: 3}]},
            filter: {x: 1, y: 1, _id: 0},
            sort: {x: 1},
        }
    });

    /**
     * Setup: Create a collection with field 'a', 'b', and 'c'. Build two indexes {a:1, b:1, c:1}
     * and {b:1, c:1}.
     *
     * Test: Query the collection by 'a' and 'b' fields using $or then sort by the 'c' field, the
     * first branch will choose index {a:1, b:1, c:1}, the second branch will use {b:1, c:1}
     * because it has 'a' range predicate for field 'a', then MERGE_SORT will be used to merge two
     * branches.
     */
    addQueryTestCase({
        name: "NonCoveredMergeSortMultiIndexes",
        tags: ["core", "sort", "indexed"],
        createViewsPassthrough: false,
        createAggregationTest: false,
        nDocs: 1000,
        docs: function (i) {
            return {a: Random.randInt(5), b: Random.randInt(5), c: Random.randInt(10000)};
        },
        indexes: [{a: 1, b: 1, c: 1}, {b: 1, c: 1}],
        op: {
            op: "find",
            query: {$or: [{a: 1, b: 2}, {a: {$gt: 3}, b: 3}]},
            filter: {a: 1, b: 1, c: 1, _id: 0},
            sort: {c: 1},
        }
    });

    /**
     * Setup: Create a collection with field 'a' and 'b'. Build two indexes {a:1, b:1}.
     *
     * Test: Query the collection by field 'a' using $in and sort by field 'b', a prefix of the
     * index will be used to answer the filter predicate with a series of fixed bounds, then bounds
     * on the suffix is used to answer the sort portion of the query. This results in a series of
     * IXSCANs joined together with a MERGE_SORT stage.
     */
    addQueryTestCase({
        name: "ExplodeMergeSort",
        tags: ["core", "sort", "indexed"],
        createViewsPassthrough: false,
        createAggregationTest: false,
        nDocs: 1000,
        docs: function (i) {
            return {a: Random.randInt(30), b: Random.randInt(10000)};
        },
        indexes: [{a: 1, b: 1}],
        op: {
            op: "find",
            query: {a: {$in: [1, 3, 5, 7, 9, 10, 11, 13, 15, 17, 19, 20, 21, 23, 25, 27, 29]}},
            filter: {a: 1, b: 1, _id: 0},
            sort: {b: 1},
        }
    });

    /**
     * Setup: Create a collection with scalar fields x, y with no index.
     *
     * Test: Sort the collection by one or two fields, with simple and dotted paths,
     * with and without a limit, for increasing number of documents.
     */
    for (const limit of [[null, 'NoLimit'], [1, 'LimitOne'], [100, 'LimitHundred']]) {
        for (const numdocs of [[1000, '1K'], [10000, '10K'], [100000, '100K']]) {
            for (const sortKey of [[{y: 1}, '1Key'],
                [{y: 1, x: 1}, '2Key'],
                [{"z.w.j": 1}, '1PathKey3Components'],
                [{"k.x": 1, "k.y": 1}, '2KeyCommonPrefix']]) {
                var testcase = {
                    name: "Sort" + limit[1] + "Collection" + numdocs[1] + "_" + sortKey[1],
                    tags: ["core", "sort"],
                    // TODO (SERVER-5722): We cannot create a views passthrough because benchRun doesn't support
                    // sorting when running in read command mode.
                    createViewsPassthrough: false,
                    nDocs: numdocs[0],
                    docs: function (i) {
                        return {
                            x: Random.randInt(10000),
                            y: Random.randInt(10000),
                            z: {w: {j: Random.randInt(10000)}},
                            k: {x: Random.randInt(10000), y: Random.randInt(10000)}
                        };
                    },
                    op: {
                        op: "find",
                        sort: sortKey[0]
                    }
                };
                if (limit[0] != null) {
                    testcase.op['limit'] = limit[0];
                }
                addQueryTestCase(testcase);
            }
        }
    }

    /**
     * Setup: Create a collection with scalar fields x, y and an index on x, y.
     *
     * Test: Sort the collection by the y field. The sort can be computed based on the index,
     * although a blocking SORT stage is still required. In addition, the query cannot be covered
     * since there is no projection.
     */
    addQueryTestCase({
        name: "NonCoveredBlockingSortWithIndexToSupportSort",
        tags: ["core", "sort", "indexed"],
        // TODO (SERVER-5722): We cannot create a views passthrough because benchRun doesn't support
        // sorting when running in read command mode.
        createViewsPassthrough: false,
        nDocs: 1000,
        docs: function (i) {
            return {x: Random.randInt(10000), y: Random.randInt(10000)};
        },
        indexes: [{x: 1, y: 1}],
        op: {
            op: "find",
            query: {x: {$gt: 0}, y: {$gt: 0}},
            sort: {y: 1},
        }
    });
}());