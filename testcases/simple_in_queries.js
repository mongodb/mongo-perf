if (typeof(tests) !== "object") {
    tests = [];
}

(function() {
    "use strict";

    Random.setRandomSeed(258);

    /**
     * Adds two string test cases for a $in query: One a small collection, and another on a
     * large collection.
     */
    function addStringInTestCases({name, collation, inArray}) {
        const collectionOptions = {};
        if (collation) {
            collectionOptions.collation = collation;
        }
        for (const [nameSuffix, size] of [["", 10], ["BigCollection", 10000]]) {
            addQueryTestCase({
                name: name + nameSuffix,
                tags: ["regression", "collation"],
                // TODO (SERVER-5722): We cannot create a views passthrough because benchRun doesn't support
                // sorting when running in read command mode.
                createViewsPassthrough: false,
                collectionOptions: collectionOptions,
                nDocs: size,
                docs: function (i) {
                    return {x: i.toString()};
                },
                op: {
                    op: "find",
                    query: {x: {$in: inArray}},
                    sort: {x: 1}
                }
            });
        }
    }
    /**
     * Setup: Create a collection with a non-simple default collation and insert a small number of
     * documents with strings. We set several collation options in an attempt to make the collation
     * processing in ICU more expensive.
     *
     * Test: Issue queries that must perform a collection scan, filtering the documents with an $in
     * predicate. Request a sort which the query system must satisfy by sorting the documents in
     * memory according to the collation.
     */
    addStringInTestCases({
        name: "StringUnindexedInPredWithNonSimpleCollation",
        collation: {
            locale: "en",
            strength: 5,
            backwards: true,
            normalization: true,
        },
        inArray: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
    });

    /**
     * Setup: Create a collection with the simple default collation and insert documents with
     * strings.
     *
     * Test: Issue queries that must perform a collection scan, filtering the documents with an $in
     * predicate. Request a sort which the query system must satisfy by sorting the documents in
     * memory.
     *
     * Comparing this test against StringUnidexedInPredWithNonSimpleCollation is useful for
     * determining the performance impact of queries with non-simple collations whose string
     * comparison predicates are unindexed, in addition to the perf impact of an in-memory SORT
     * stage which uses a collator.
     */
    addStringInTestCases({
        name: "StringUnindexedInPredWithSimpleCollation",
        inArray: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
    });

    /**
     * Setup: Same as above.
     *
     * Test: Issue same queries as above, but with large array of strings as $in argument.
     */
    const nLargeArrayElements = 1000;
    const largeStringInArray = [];
    for (let i = 0; i < nLargeArrayElements; i++) {
        largeStringInArray.push(Random.randInt(nLargeArrayElements).toString());
    }
    addStringInTestCases({
        name: "StringUnindexedLargeInPredWithNonSimpleCollation",
        collation: {
            locale: "en",
            strength: 5,
            backwards: true,
            normalization: true,
        },
        inArray: largeStringInArray,
    });
    addStringInTestCases({
        name: "StringUnindexedLargeInPredWithSimpleCollation",
        inArray: largeStringInArray,
    });

    /**
     * Large arrays used for $in queries in the subsequent test cases.
     */
    var largeArrayRandom = [];
    for (var i = 0; i < nLargeArrayElements; i++) {
        largeArrayRandom.push(Random.randInt(nLargeArrayElements));
    }

    var largeArraySorted = [];
    for (var i = 0; i < nLargeArrayElements; i++) {
        largeArraySorted.push(i * 2);
    }

    /**
     * Adds two test cases for a $in query: One a small collection with a $in filter that
     * includes every document, and another on a larger collection with a selective $in filter.
     */
    function addInTestCases({name, largeInArray}) {
        // Setup: Create a collection and insert a small number of documents with a random even
        // integer field x in the range [0, nLargeArrayElements * 2).

        // Test: Issue queries that must perform a collection scan, filtering the documents with an
        // $in predicate with a large number of elements. All documents will match the predicate,
        // since the $in array contains all even integers in the range [0, nLargeArrayElements *
        // 2).
        addQueryTestCase({
            name: name,
            tags: ["regression"],
            nDocs: 10,
            docs: function (i) {
                return {x: 2 * Random.randInt(largeInArray.length)};
            },
            op: {
                op: "find",
                query: {x: {$in: largeInArray}}
            }
        });

        // Similar test to above, but with a larger collection. Only a small fraction (10%)
        // of the documents will actually match the filter.
        addQueryTestCase({
            name: name + "BigCollection",
            tags: ["regression"],
            nDocs: 10000,
            docs: function (i) {
                return {x: 2 * Random.randInt(largeInArray.length * 10)};
            },
            op: {
                op: "find",
                query: {x: {$in: largeInArray}}
            }
        });
    };


    addInTestCases({
        name: "UnindexedLargeInMatching",
        largeInArray: largeArraySorted,
    });

    addInTestCases({
        name: "UnindexedLargeInUnsortedMatching",
        largeInArray: largeArrayRandom,
    });

    /**
     * Repeat the same test as above, increasing the number of elements in the $in array to 10000.
     */
    var nVeryLargeArrayElements = 10000;
    var veryLargeArrayRandom = [];
    for (var i = 0; i < nVeryLargeArrayElements; i++) {
        veryLargeArrayRandom.push(Random.randInt(nVeryLargeArrayElements));
    }

    var veryLargeArraySorted = [];
    for (var i = 0; i < nVeryLargeArrayElements; i++) {
        veryLargeArraySorted.push(i * 2);
    }

    addInTestCases({
        name: "UnindexedVeryLargeInSortedMatching",
        largeInArray: veryLargeArraySorted,
    });

    addInTestCases({
        name: "UnindexedVeryLargeInUnsortedMatching",
        largeInArray: veryLargeArrayRandom,
    });


    /**
     * Setup: Create a collection and insert a small number of documents with a random odd integer
     * field x in the range [0, 2000).
     *
     * Test: Issue queries that must perform a collection scan, filtering the documents with an $in
     * predicate with a large number of elements. No documents will match the predicate, since the
     * $in array contains all even integers in the range [0, 2000).
     */
    addQueryTestCase({
        name: "UnindexedLargeInNonMatching",
        tags: ["regression"],
        nDocs: 10,
        docs: function (i) {
            return {x: 2 * Random.randInt(1000) + 1};
        },
        op: {
            op: "find",
            query: {x: {$in: largeArraySorted}}
        }
    });

    /**
     * Repeat the same test as above, except using the $in array of unsorted elements.
     */
    addQueryTestCase({
        name: "UnindexedLargeInUnsortedNonMatching",
        tags: ["regression"],
        nDocs: 10,
        docs: function (i) {
            return {x: 2 * Random.randInt(1000) + 1};
        },
        op: {
            op: "find",
            query: {x: {$in: largeArrayRandom}}
        }
    });
}());
