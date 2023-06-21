if (typeof(tests) !== "object") {
    tests = [];
}

(function() {
    "use strict";

    Random.setRandomSeed(258);

    /**
     * Setup: Create a collection of documents containing only an ObjectId _id field.
     *
     * Test: Empty query that returns all documents.
     */
    addQueryTestCase({
        name: "Empty",
        tags: ["regression"],
        // This generates documents to be inserted into the collection, resulting in 100 documents
        // with only an _id field.
        nDocs: 100,
        docs: function(i) {
            return {};
        },
        op: {op: "find", query: {}}
    });

    /**
     * Setup: Create a large collection of large documents.
     *
     * Test: Empty query that returns all documents.
     */
    for (const numDocs of [[10000, '10K'], [100000, '100K']]) {
        addQueryTestCase({
            name: "Large" + numDocs[1],
            tags: ["regression"],
            nDocs: numDocs[0],
            docs: largeDoc,
            op: {op: "find", query: {}}
        });
    }

    /**
     * Setup: Create a collection of documents with only an ObjectID _id field.
     *
     * Test: Query for a document that doesn't exist. Scans all documents using a collection scan
     * and returns no documents.
     */
    addQueryTestCase({
        name: "NoMatch",
        tags: ["regression"],
        nDocs: 100,
        docs: function(i) {
            return {};
        },
        op: {op: "find", query: {nonexistent: 5}}
    });

    /**
     * Setup: Create a collection of documents with only an integer _id field.
     *
     * Test: Query for a random document based on _id. Each thread accesses a distinct range of
     * documents. This test generates queries that use IDHACK plans.
     */
    addQueryTestCase({
        name: "IntIdFindOne",
        tags: ["regression", "fast_running_query"],
        nDocs: 4800,
        docs: function(i) {
            return {_id: i};
        },
        op: {op: "findOne", query: {_id: {"#RAND_INT_PLUS_THREAD": [0, 100]}}}
    });

    /**
     * Setup: Create a collection of documents with an indexed integer field x.
     *
     * Test: Query for a random document based on integer field x. Each thread accesses a distinct
     * range of documents. Query uses the index.
     */
    addQueryTestCase({
        name: "IntNonIdFindOne",
        tags: ["core", "indexed", "fast_running_query"],
        nDocs: 4800,
        docs: function(i) {
            return {x: i};
        },
        indexes: [{x: 1}],
        op: {op: "findOne", query: {x: {"#RAND_INT_PLUS_THREAD": [0, 100]}}}
    });

    /**
     * Setup: Create a collection of documents with only an integer _id field.
     *
     * Test: Query for all documents with integer _id in the range (50,100). All threads are
     * returning the same documents.
     */
    addQueryTestCase({
        name: "IntIDRange",
        tags: ["regression", "fast_running_query"],
        nDocs: 4800,
        docs: function(i) {
            return {_id: i};
        },
        op: {op: "find", query: {_id: {$gt: 50, $lt: 100}}}
    });

    /**
     * Setup: Create a collection of documents with indexed integer field x.
     *
     * Test: Query for all documents with x in range (50,100). All threads are returning the same
     * documents and uses index on x.
     */
    addQueryTestCase({
        name: "IntNonIDRange",
        tags: ["indexed", "fast_running_query"],
        nDocs: 4800,
        docs: function(i) {
            return {x: i};
        },
        indexes: [{x: 1}],
        op: {op: "find", query: {x: {$gt: 50, $lt: 100}}}
    });

    /**
     * Setup: Create a collection of documents with indexed string field x.
     *
     * Test: Regex query for document with x starting with 2400. All threads are returning the same
     * document and uses index on x.
     */
    addQueryTestCase({
        name: "RegexPrefixFindOne",
        tags: ["core", "indexed", "fast_running_query"],
        nDocs: 4800,
        docs: function(i) {
            return {x: i.toString()};
        },
        indexes: [{x: 1}],
        op: {op: "find", query: {x: /^2400/}}
    });

    /**
     * Setup: Collection with documents with two integer fields, both indexed.
     *
     * Test: Query for document matching both int fields. The query will use one of the indexes. All
     * the threads access the documents in the same order.
     */
    addQueryTestCase({
        name: "TwoInts",
        tags: ["core", "indexed", "fast_running_query"],
        nDocs: 4800,
        docs: function(i) {
            return {x: i, y: 2 * i};
        },
        indexes: [{x: 1}, {y: 1}],
        op: {
            op: "find",
            query: {
                x: {"#SEQ_INT": {seq_id: 0, start: 0, step: 1, mod: 4800}},
                y: {"#SEQ_INT": {seq_id: 1, start: 0, step: 2, mod: 9600}}
            }
        }
    });

    /**
     * Setup: Create a collection with a non-simple default collation, and insert indexed strings.
     * We set several collation options in an attempt to make the collation processing in ICU more
     * expensive.
     *
     * Test: Query for a range of strings using the non-simple default collation.
     */
    addQueryTestCase({
        name: "StringRangeWithNonSimpleCollation",
        tags: ["indexed", "collation"],
        collectionOptions: {
            collation: {
                locale: "en",
                strength: 5,
                backwards: true,
                normalization: true,
            }
        },
        nDocs: 4800,
        docs: function(i) {
            var j = i + (1 * 1000 * 1000 * 1000);
            return {x: j.toString()};
        },
        indexes: [{x: 1}],
        op: {op: "find", query: {x: {$gte: "1000002400", $lt: "1000002404"}}}
    });

    /**
     * Setup: Create a collection and insert indexed strings.
     *
     * Test: Query for a range of strings using the simple collation.
     *
     * Comparing this test against StringRangeWithNonSimpleCollation is useful for determining the
     * performance impact of queries with non-simple collations whose string comparison predicates
     * are indexed.
     */
    addQueryTestCase({
        name: "StringRangeWithSimpleCollation",
        tags: ["indexed", "collation"],
        nDocs: 4800,
        docs: function(i) {
            var j = i + (1 * 1000 * 1000 * 1000);
            return {x: j.toString()};
        },
        indexes: [{x: 1}],
        op: {op: "find", query: {x: {$gte: "1000002400", $lt: "1000002404"}}}
    });

    // Projection tests.

    /**
     * Setup: Create a collection of documents with indexed integer field x.
     *
     * Test: Query for random document based on integer field x, and use projection to return only
     * the field x. Each thread accesses a distinct range of documents. Query should be a covered
     * index query.
     */
    addQueryTestCase({
        name: "IntNonIdFindOneProjectionCovered",
        tags: ["core", "indexed", "fast_running_query"],
        nDocs: 4800,
        docs: function(i) {
            return {x: i};
        },
        indexes: [{x: 1}],
        op: {
            op: "find",
            query: {x: {"#RAND_INT_PLUS_THREAD": [0, 100]}},
            limit: 1,
            filter: {x: 1, _id: 0}
        }
    });

    /**
     * Setup: Create a collection of documents with indexed integer field x.
     *
     * Test: Query for random document based on integer field x, and use projection to return the
     * field x and the _id. Each thread accesses a distinct range of documents.
     */
    addQueryTestCase({
        name: "IntNonIdFindOneProjection",
        tags: ["core", "indexed", "fast_running_query"],
        nDocs: 4800,
        docs: function(i) {
            return {x: i};
        },
        indexes: [{x: 1}],
        op: {
            op: "find",
            query: {x: {"#RAND_INT_PLUS_THREAD": [0, 100]}},
            limit: 1,
            filter: {x: 1, _id: 1}
        }
    });

    /**
     * Setup: Create a collection of documents with indexed integer field x.
     *
     * Test: Query for all documents with x >= 0 (all the documents), and use projection to return
     * the field x. Each thread accesses all the documents. Query should be a covered index query.
     */
    addQueryTestCase({
        name: "IntNonIdFindProjectionCovered",
        tags: ["indexed", "regression"],
        nDocs: 100,
        docs: function(i) {
            return {x: i};
        },
        indexes: [{x: 1}],
        op: {op: "find", query: {x: {$gte: 0}}, filter: {x: 1, _id: 0}}
    });

    /**
     * Setup: Create a collection of documents with indexed integer field x.
     *
     * Test: Query for all the documents (empty query), and use projection to return the field x.
     * Each thread accesses all the documents.
     */
    addQueryTestCase({
        name: "FindProjection",
        tags: ["regression", "indexed"],
        nDocs: 100,
        docs: function(i) {
            return {x: i};
        },
        indexes: [{x: 1}],
        op: {op: "find", query: {}, filter: {x: 1}}
    });

    /**
     * Setup: Create a collection of documents with 26 integer fields.
     *
     * Test: Query for all the documents (empty query), and use projection to return the field x.
     * Each thread accesses all the documents.
     */
    addQueryTestCase({
        name: "FindWideDocProjection",
        tags: ["regression"],
        nDocs: 100,
        docs: function(i) {
            return {
                a: i,
                b: i,
                c: i,
                d: i,
                e: i,
                f: i,
                g: i,
                h: i,
                i: i,
                j: i,
                k: i,
                l: i,
                m: i,
                n: i,
                o: i,
                p: i,
                q: i,
                r: i,
                s: i,
                t: i,
                u: i,
                v: i,
                w: i,
                x: i,
                y: i,
                z: 1
            };
        },
        op: {op: "find", query: {}, filter: {x: 1}}
    });

    /**
     * Setup: Create a collection of documents with 3 integer fields and a compound index on those
     * three fields.
     *
     * Test: Query for random document based on integer field x, and return the three integer
     * fields.  Each thread accesses a distinct range of documents. Query should be a covered index
     * scan.
     */
    addQueryTestCase({
        name: "FindProjectionThreeFieldsCovered",
        tags: ["core", "indexed", "fast_running_query"],
        nDocs: 4800,
        docs: function(i) {
            return {x: i, y: i, z: i};
        },
        indexes: [{x: 1, y: 1, z: 1}],
        op: {
            op: "find",
            query: {x: {"#RAND_INT_PLUS_THREAD": [0, 100]}},
            filter: {x: 1, y: 1, z: 1, _id: 0}
        }
    });

    /**
     * Setup: Create a collection of documents with 3 integer fields.
     *
     * Test: Query for all documents (empty query) and return the three integer fields.
     */
    addQueryTestCase({
        name: "FindProjectionThreeFields",
        tags: ["regression"],
        nDocs: 100,
        docs: function(i) {
            return {x: i, y: i, z: i};
        },
        op: {op: "find", query: {}, filter: {x: 1, y: 1, z: 1, _id: 0}}
    });

    /**
     * Setup: Create a collection of documents with integer field x.y.
     *
     * Test: Query for all documents (empty query) and return just x.y. Each thread accesses a
     * distinct range of documents.
     */
    addQueryTestCase({
        name: "FindProjectionDottedField",
        tags: ["regression"],
        nDocs: 100,
        docs: function(i) {
            return {x: {y: i}};
        },
        op: {op: "find", query: {}, filter: {"x.y": 1, _id: 0}}
    });

    /**
     * Utility to add a pair of inclusion/exclusion test cases.
     */
    const addInclusionExclusionTestCase = function(name, docGenerator, inclusionSpec, exclusionSpec) {
        for (const [prefix, testCase] of Object.entries({"FindInclusion.": inclusionSpec, "FindExclusion.": exclusionSpec})) {
            addQueryTestCase({
                name: prefix + name,
                tags: ["regression", "projection", ">=4.4.0"],
                nDocs: 10 * 1000,
                // Adding a views passthrough and an aggregation test would be redundant.
                createViewsPassthrough: false,
                createAggregationTest: false,
                docs: docGenerator,
                op: {op: "find", query: {}, filter: testCase}
            });
        }
    }

    /**
     * Set of test cases which stress the performance of projections with dotted paths as well
     * as wide projections.
     */
    const singlePathThreeComponentDocGenerator = function(i) {
            return {a: {b: {c: i, d: i}}}
    };

    addInclusionExclusionTestCase(
        "ProjectionDottedField.SinglePathThreeComponents" /* name */,
        singlePathThreeComponentDocGenerator,
        {"a.b.c": 1, _id: 0} /* inclusionSpec */,
        {"a.b.d": 0, _id: 1} /* exclusionSpec */);

    const singlePathThreePathComponentsDeepProjectionDocGenerator = function(i, arrSize) {
        return {a: Array(arrSize).fill(
            {b: Array(arrSize).fill({c: i, d: i})})};
    };

    addInclusionExclusionTestCase(
        "ProjectionDottedField.SinglePathThreeComponentsNestedArraysOfSizeOne" /* name */,
        i => singlePathThreePathComponentsDeepProjectionDocGenerator(i, 1),
        {"a.b.c": 1, _id: 0} /* inclusionSpec */,
        {"a.b.d": 0, _id: 1} /* exclusionSpec */);

    addInclusionExclusionTestCase(
        "ProjectionDottedField.SinglePathThreeComponentsNestedArraysOfSizeFive" /* name */,
        i => singlePathThreePathComponentsDeepProjectionDocGenerator(i, 5),
        {"a.b.c": 1, _id: 0} /* inclusionSpec */,
        {"a.b.d": 0, _id: 1} /* exclusionSpec */);

    const singlePathSixPathComponentsDeepProjectionDocGenerator = function(i, arrSize) {
        return {a: Array(5 /* arrayLength */).fill(Array(arrSize).fill(
            {b: {c: Array(arrSize).fill(
            {d: {e: Array(arrSize).fill({f: i, g: i})}})}}))};
    };

    addInclusionExclusionTestCase(
        "ProjectionDottedField.SinglePathSixComponentsNestedArraysOfSizeOne" /* name */,
        i => singlePathSixPathComponentsDeepProjectionDocGenerator(i, 1),
        {"a.b.c.d.e.f": 1, _id: 0} /* inclusionSpec */,
        {"a.b.c.d.e.g": 0, _id: 1} /* exclusionSpec */);

    addInclusionExclusionTestCase(
        "ProjectionDottedField.SinglePathSixComponentsNestedArraysOfSizeFive" /* name */,
        i => singlePathSixPathComponentsDeepProjectionDocGenerator(i, 5),
        {"a.b.c.d.e.f": 1, _id: 0} /* inclusionSpec */,
        {"a.b.c.d.e.g": 0, _id: 1} /* exclusionSpec */);

    const topLevelWideProjectionDocGenerator = function(i) {
        return {a: i, b: i, c: i, d: i, e: i, f: i, g: i, h: i, i: i, j: i};
    }

    addInclusionExclusionTestCase(
        "WideProjectionTopLevelField" /* name */,
        topLevelWideProjectionDocGenerator,
        {_id: 0, b: 1, c: 1, d: 1, e: 1, f: 1, g: 1, h: 1, i: 1, j: 1} /* inclusionSpec */,
        {_id: 1, b: 0, c: 0, d: 0, e: 0, f: 0, g: 0, h: 0, i: 0, j: 0} /* exclusionSpec */);

    addInclusionExclusionTestCase(
        "WideProjectionNestedField" /* name */,
        i => {return {n: topLevelWideProjectionDocGenerator(i)};},
        {_id: 0, n: {b: 1, c: 1, d: 1, e: 1, f: 1, g: 1, h: 1, i: 1, j: 1}} /* inclusionSpec */,
        {_id: 1, n: {b: 0, c: 0, d: 0, e: 0, f: 0, g: 0, h: 0, i: 0, j: 0}} /* exclusionSpec */);

    /**
     * Setup: Create a collection of documents with integer field x.y.
     *
     * Test: Query for a random document based on x.y field and return just x.y. Each thread
     * accesses a distinct range of documents. The query should be a covered index query.
     */
    addQueryTestCase({
        name: "FindProjectionDottedField.Indexed",
        tags: ["core", "indexed", "fast_running_query"],
        nDocs: 100,
        docs: function(i) {
            return {x: {y: i}};
        },
        indexes: [{"x.y": 1}],
        op: {
            op: "find",
            query: {"x.y": {"#RAND_INT_PLUS_THREAD": [0, 100]}},
            filter: {"x.y": 1, _id: 0}
        }
    });

    /**
     * Large string used for generating documents in the LargeDocs test.
     */
    var bigString = new Array(1024 * 1024 * 5).toString();

    /**
     * Setup: Create a collection with one hundred 5 MiB documents.
     *
     * Test: Do a table scan.
     */
    addQueryTestCase({
        name: "LargeDocs",
        nDocs: 100,
        docs: function(i) {
            return {x: bigString};
        },
        op: {op: "find", query: {}}
    });

    /**
     * Similar to 'addTestCase' but sets up the test to be able to share collections if running
     * as part of a suite that opts-in for sharing.
     * @param {query} - The query to benchmark with 'find' operation. Ignored if 'op' is defined.
     * @param {op} - The full definition of the op to be benchmarked.
     * @param {Number} [options.nDocs = largeCollectionSize] - The number of documents to insert in
     * the collection. Ignored, if 'generateData' is defined.
     * @param {function} [options.docGenerator] - To be used with populatorGenerator. Ignored, if
     * 'generatedData' is defined.
     * @param {function} [options.generateData = populatorGenerator] - Uses 'docGenerator' to populate
     * the collection with 'nDocs' documents. If the test is part of a suite that uses '--shareDataset'
     * flag, the generator is run once (for the first test in the suite).
     * @param {function} [options.pre=noop] - Any other setup, in addition to creating the data, that
     * the test might need. For example, creating indexes. The 'pre' fixture is run per test, so for
     * tests that share the dataset, the effects must be undone with 'post'.
     * @param {function} [options.post=noop] - cleanup after the test is done.
     */
    function addTestCaseWithLargeDataset(options) {
        const largeCollectionSize = 100000;
        var nDocs = options.nDocs || largeCollectionSize;
        var tags = options.tags || [];
        tests.push({
            tags: ["regression", "query_large_dataset"].concat(tags),
            name: "Queries." + options.name,
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
            ops: ("op" in options) ? [options.op] : [{op: "find", query: options.query}],
        });
    }

    /**
     * Benchmarks for find on large collections, targeting the basic functionality of the engine in
     * a systematic way.
     *
     * Naming convention: TestName_<access_method>_<collection_size><doc_size>[R]<group_cardinality>
     * access_method ::= CollScan
     * collection_size ::= L
     * doc_size ::= S | L
     * group_cardinality :: = 10 | 100 | ...
     * R means accessing fields at the end of the document (only applies to tests with doc_size = L)
     */

    // Tests: point-query on a top-level field with full collection scan.
    addTestCaseWithLargeDataset({
        name: "PointQuery_CollScan_LS", docGenerator: smallDoc, query: {a: 7}
    });
    addTestCaseWithLargeDataset({
        name: "PointQuery_CollScan_LL", docGenerator: largeDoc, query: {a: 7}
    });
    addTestCaseWithLargeDataset({
        name: "PointQuery_CollScan_LLR", docGenerator: largeDoc, query: {aa: 7}
    });

    // Tests: point-query on a sub-field with full collection scan.
    addTestCaseWithLargeDataset({
        name: "PointQuerySubField_CollScan_LS", docGenerator: smallDoc, query: {"e.a": 7}
    });
    addTestCaseWithLargeDataset({
        name: "PointQuerySubField_CollScan_LL", docGenerator: largeDoc, query: {"e.a": 7}
    });
    addTestCaseWithLargeDataset({
        name: "PointQuerySubField_CollScan_LLR", docGenerator: largeDoc, query: {"ee.a": 7}
    });

    // Tests: point-query on an array field with full collection scan.
    addTestCaseWithLargeDataset({
        name: "PointQueryArray_CollScan_LS", docGenerator: smallDoc, query: {"f": 7}
    });
    addTestCaseWithLargeDataset({
        name: "PointQueryArray_CollScan_LL", docGenerator: largeDoc, query: {"f": 7}
    });
    addTestCaseWithLargeDataset({
        name: "PointQueryArray_CollScan_LLR", docGenerator: largeDoc, query: {"ff": 7}
    });

    // Tests: query with a complex expression on top-level fields with full collection scan.
    let queryExpr = {
        $expr:
        {
          $or:
          [
            {$and: [{$eq: ["$a", 8]}, {$eq: ["$b", 70]}]},
            {$and: [{$eq: ["$c", 42.5]}, {$eq: ["$d", 17]}]},
            {$eq: ["$a", 9]}, {$eq: ["$b", 200]}, {$eq: ["$c", 51.2]}, {$eq: ["$d", 400]},
          ]
        }
    };
    addTestCaseWithLargeDataset({
        name: "ComplexExpressionQuery_CollScan_LS", docGenerator: smallDoc, query: queryExpr
    });
    addTestCaseWithLargeDataset({
        name: "ComplexExpressionQuery_CollScan_LL", docGenerator: largeDoc, query: queryExpr
    });

    // Tests: query with a complex expression on a single field with full collection scan.
    let queryExprSingleField = {
        $expr:
        {
            $or:
            [
            {$and: [{$gt: ["$b", 69]}, {$lt: ["$b", 71]}]},
            {$and: [{$gt: ["$b", 117]}, {$lt: ["$b", 118.5]}]},
            {$eq: ["$b", 200]}, {$eq: ["$b", 300]}, {$eq: ["$b", 400]}, {$eq: ["$b", 500]},
            ]
        }
    };
    addTestCaseWithLargeDataset({
        name: "ComplexExpressionSingleFieldQuery_CollScan_LS",
        docGenerator: smallDoc,
        query: queryExprSingleField
    });
    addTestCaseWithLargeDataset({
        name: "ComplexExpressionSingleFieldQuery_CollScan_LL",
        docGenerator: largeDoc,
        query: queryExprSingleField
    });
    let queryExprSingleSubField = {
        $expr:
        {
            $or:
            [
            {$and: [{$gt: ["$e.b", 69]}, {$lt: ["$e.b", 71]}]},
            {$and: [{$gt: ["$e.b", 117]}, {$lt: ["$e.b", 118.5]}]},
            {$eq: ["$e.b", 200]}, {$eq: ["$e.b", 300]}, {$eq: ["$e.b", 400]}, {$eq: ["$e.b", 500]},
            ]
        }
    };
    addTestCaseWithLargeDataset({
        name: "ComplexExpressionSingleSubFieldQuery_CollScan_LL",
        docGenerator: largeDoc,
        query: queryExprSingleSubField
    });

    // Tests: projection.
    addTestCaseWithLargeDataset({
        name: "ProjectInclude_CollScan_LS",
        docGenerator: smallDoc,
        op: {op: "find", query: {}, filter: {a:1, b:1, c:1, d:1, f:1, g:1, h:1, i:1}}
    });
    addTestCaseWithLargeDataset({
        name: "ProjectInclude_CollScan_LL",
        docGenerator: largeDoc,
        op: {op: "find", query: {}, filter: {a:1, b:1, c:1, d:1, f:1, g:1, h:1, i:1}}
    });
    addTestCaseWithLargeDataset({
        name: "ProjectNoExpressions_CollScan_LS",
        docGenerator: smallDoc,
        op: {
            op: "find",
            query: {},
            filter: {
                a1: "$a", b1: "$b", c1: "$c", d1: "$d",
                a2: "$a", b2: "$b", c2: "$c", d2: "$d",
            }
        }
    });
    addTestCaseWithLargeDataset({
        name: "ProjectExclude_CollScan_LL",
        docGenerator: largeDoc,
        op: {op: "find", query: {}, filter: {a:0, b:0, c:0, d:0, f:0, g:0, h:0, i:0}}
    });
    addTestCaseWithLargeDataset({
        name: "ProjectNoExpressions_CollScan_LL",
        docGenerator: largeDoc,
        op: {
            op: "find",
            query: {},
            filter: {
                a1: "$a", b1: "$b", c1: "$c", d1: "$d",
                a2: "$a", b2: "$b", c2: "$c", d2: "$d",
            }
        }
    });
    addTestCaseWithLargeDataset({
        name: "ProjectNoExpressions_CollScan_LLR",
        docGenerator: smallDoc,
        op: {
            op: "find",
            query: {},
            filter: {
                a1: "$aa", b1: "$bb", c1: "$cc", d1: "$dd",
                a2: "$aa", b2: "$bb", c2: "$cc", d2: "$dd",
            }
        }
    });
    let projectWithArithExpressions = {
        an: {$abs: "$a"}, bn: {$mod: ["$b", 17]}, cn: {$floor: "$c"},
        dl: {$ln: {$add: [{$abs: "$d"}, 1]}},
        ab: {$add: ["$a", "$b"]}, cd: {$divide: ["$d", "$c"]},
    };
    addTestCaseWithLargeDataset({
        name: "ProjectWithArithExpressions_CollScan_LS",
        docGenerator: smallDoc,
        op: {op: "find", query: {}, filter: projectWithArithExpressions}
    });

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
        tags: ["fast_running_query"],
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
        tags: ["fast_running_query"],
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
        tags: ["fast_running_query"],
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
        tags: ["indexed", "fast_running_query"],
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
