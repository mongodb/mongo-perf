if (typeof (tests) !== "object") {
    tests = [];
}

(function() {
    "use strict";

    Random.setRandomSeed(259);

    /**
     * Sets up a collection and/or a view with the appropriate documents and indexes.
     *
     * @param {Number} nDocs - The number of documents to insert into the collection.
     * @param {function} docGenerator - A function that takes a document number and returns a
     * document.
     * @param {Object[]} indexes - A list of index specs to create on the collection.
     * @param {Object} collectionOptions - Options to use for view/collection creation.
     */
    function collectionPopulator(nDocs, indexes, docGenerator, collectionOptions) {
        return function(collection) {
            Random.setRandomSeed(259);

            collection.drop();

            var db = collection.getDB();

            var collectionCreationSpec = { create: collection.getName() };
            assert.commandWorked(
                db.runCommand(Object.extend(collectionCreationSpec, collectionOptions)));
            var bulkOp = collection.initializeUnorderedBulkOp();
            for (var i = 0; i < nDocs; i++) {
                bulkOp.insert(docGenerator(i));
            }
            bulkOp.execute();
            indexes.forEach(function(indexSpec) {
                assert.commandWorked(collection.createIndex(indexSpec));
            });
        };
    }

    /**
     * Creates test cases and adds them to the global testing array. By default, each test case
     * specification produces several test cases:
     *  - A find on a regular collection.
     *  - A find on an identity view.
     *  - The equivalent aggregation operation on a regular collection.
     *
     * @param {Object} options - Options describing the test case.
     * @param {String} options.name - The name of the test case. "Queries" is prepended for tests on
     * regular collections and "Queries.IdentityView" for tests on views.
     * @param {function} options.docs - A generator function that produces documents to insert into
     * the collection.
     * @param {Object[]} options.op - The operations to perform in benchRun.
     *
     * @param {Boolean} {options.createViewsPassthrough=true} - If false, specifies that a views
     * passthrough test should not be created, generating only one test on a regular collection.
     * @param {Object[]} {options.indexes=[]} - An array of index specifications to create on the
     * collection.
     * @param {String[]} {options.tags=[]} - Additional tags describing this test. The "query" tag
     * is automatically added to test cases for collections. The tags "views" and
     * "query_identityview" are added to test cases for views.
     * @param {Object} {options.collectionOptions={}} - Options to use for view/collection creation.
     */
    function addTestCase(options) {
        var indexes = options.indexes || [];
        var tags = options.tags || [];

        tests.push({
            tags: ["bigcollection"].concat(tags),
            name: "BigCollection." + options.name,
            pre: collectionPopulator(
                options.nDocs, indexes, options.docs, options.collectionOptions),
            post: function(collection) {
                collection.drop();
            },
            ops: [options.op]
        });

        // Generate a test which is the aggregation equivalent of this find operation.
        tests.push({
            tags: ["agg_bigcollection_comparison"].concat(tags),
            name: "BigCollectionAggregation." + options.name,
            pre: collectionPopulator(
                options.nDocs, indexes, options.docs, options.collectionOptions),
            post: function(collection) {
                collection.drop();
            },
            ops: [rewriteQueryOpAsAgg(options.op)]
        });
    }

    function testQuery(testName, nDocs, docSize, op) {
        var fullName = testName + " (nDocs: " + nDocs + ", docSize: " + docSize +
                       ", batchSize: " + (op.batchSize ? op.batchSize : "0") + ")";
        addTestCase({
            name: fullName,
            tags: ["query", "getmore"],
            // This generates documents to be inserted into the collection, resulting in 'nDocs'
            // documents with three fields: _id, x, and y. The exact size of each document is
            // 'docSize' bytes.
            nDocs: nDocs,
            docs: function(i) {
                const offsetForTheRemainderOfDoc = 37;
                return { _id: i, x: i + 1, y: 'y'.repeat(docSize - offsetForTheRemainderOfDoc) };
            },
            op: op
        });
    }

    /**
     * Setup: Create a collection of documents containing three fields.
     *
     * Test: Scan all documents  and expect a lot of getMore commands to fulfill the request.
     */
    function testScan(nDocs, docSize, batchSize) {
        var op = { op: "find", query: {} };
        if (batchSize) {
            op["batchSize"] = batchSize;
        }
        testQuery("Scan", nDocs, docSize, op);
    }

    /**
     * Setup: Create a collection of documents containing three fields.
     *
     * Test: Filter out 10% of documents (i.e., apply in non-selective filter) and expect a lot of
     * getMore commands to fulfill the request.
     */
    function testNonSelectiveFilter(nDocs, docSize, batchSize) {
        var op = { op: "find", query: { x: { $gt: Math.floor(nDocs / 10) } } };
        if (batchSize) {
            op["batchSize"] = batchSize;
        }
        testQuery("Filter", nDocs, docSize, op);
    }

    /**
     * This is a meta-function that runs the given 'testFn' with  several 'numDocs' and 'docSize'
     * parameters. In each call, 16x the number of documents is used with 1/16 the size of
     * previous call, up to 'numSteps' times.
     */
    function allTests(testFn, minNumDocs, maxDocSize, numSteps, batchSize) {
        for (var i = 0; i < numSteps; ++i) {
            if (maxDocSize > 64) {
                testFn(minNumDocs << (i * 4), maxDocSize >> (i * 4), batchSize << (i * 4));
            }
        }
    }

    // Run without 'batchSize'.
    allTests(testScan, 25, 16 * 1024 * 1024, 5, 0);
    allTests(testNonSelectiveFilter, 25, 16 * 1024 * 1024, 5, 0);

    // Run with 'batchSize' that can hold up to 1MB worth of documents in each batch.
    allTests(testScan, 400, 1 * 1024 * 1024, 4, 1);
    allTests(testNonSelectiveFilter, 400, 1 * 1024 * 1024, 4, 1);

}());
