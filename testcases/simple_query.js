if (typeof(tests) !== "object") {
    tests = [];
}

Random.setRandomSeed(258);

/**
 * Sets up a collection and/or a view with the appropriate documents and indexes.
 *
 * @param {Boolean} isView - True if 'collectionOrView' is a view; false otherwise.
 * @param {Number} nDocs - The number of documents to insert into the collection.
 * @param {function} docGenerator - A function that takes a document number and returns a document.
 * @param {Object[]} indexes - A list of index specs to create on the collection.
 * @param {Object} collectionOptions - Options to use for view/collection creation.
 */
function collectionPopulator(isView, nDocs, indexes, docGenerator, collectionOptions) {
    return function(collectionOrView) {
        Random.setRandomSeed(258);

        collectionOrView.drop();

        var db = collectionOrView.getDB();
        var collection;
        if (isView) {
            // 'collectionOrView' is a view, so specify a backing collection to serve as its source
            // and perform the view creation.
            var viewName = collectionOrView.getName();
            var collectionName = viewName + "_BackingCollection";
            collection = db.getCollection(collectionName);
            collection.drop();

            var viewCreationSpec = {create: viewName, viewOn: collectionName};
            assert.commandWorked(db.runCommand(Object.extend(viewCreationSpec, collectionOptions)));
        } else {
            collection = collectionOrView;
        }

        var collectionCreationSpec = {create: collection.getName()};
        assert.commandWorked(
            db.runCommand(Object.extend(collectionCreationSpec, collectionOptions)));
        var bulkOp = collection.initializeUnorderedBulkOp();
        for (var i = 0; i < nDocs; i++) {
            bulkOp.insert(docGenerator(i));
        }
        bulkOp.execute();
        indexes.forEach(function(indexSpec) {
            assert.commandWorked(collection.ensureIndex(indexSpec));
        });
    };
}

/**
 * Rewrites a query op in benchRun format to the equivalent aggregation command op, also in benchRun
 * format.
 */
function rewriteQueryOpAsAgg(op) {
    var newOp = {
        op: "command",
        ns: "#B_DB",
        command: {
            aggregate: "#B_COLL",
            pipeline: [],
            cursor: {}
        }
    };
    var pipeline = newOp.command.pipeline;

    // Special case handling for legacy OP_QUERY find $query syntax. This is used as a workaround to
    // test queries with sorts in a fashion supported by benchRun.
    //
    // TODO SERVER-5722: adding full-blown sort support in benchRun should prevent us from requiring
    // this hack.
    if (op.query && op.query.$query) {
        pipeline.push({$match: op.query.$query});

        if (op.query.$orderby) {
            pipeline.push({$sort: op.query.$orderby});
        }

        return newOp;
    }

    if (op.query) {
        pipeline.push({$match: op.query});
    }

    if (op.skip) {
        pipeline.push({$skip: op.skip});
    }

    if (op.limit) {
        pipeline.push({$limit: op.limit});
    } else if (op.op === "findOne") {
        pipeline.push({$limit: 1});
    }

    // Confusingly, benchRun uses the name "filter" to refer to the projection (*not* the query
    // predicate).
    if (op.filter) {
        pipeline.push({$project: op.filter});
    }

    return newOp;
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
 * @param {function} options.docs - A generator function that produces documents to insert into the
 * collection.
 * @param {Object[]} options.op - The operations to perform in benchRun.
 *
 * @param {Boolean} {options.createViewsPassthrough=true} - If false, specifies that a views
 * passthrough test should not be created, generating only one test on a regular collection.
 * @param {Object[]} {options.indexes=[]} - An array of index specifications to create on the
 * collection.
 * @param {String[]} {options.tags=[]} - Additional tags describing this test. The "query" tag is
 * automatically added to test cases for collections. The tags "views" and "query_identityview" are
 * added to test cases for views.
 * @param {Object} {options.collectionOptions={}} - Options to use for view/collection creation.
 */
function addTestCase(options) {
    var isView = true;
    var indexes = options.indexes || [];
    var tags = options.tags || [];

    tests.push({
        tags: ["query"].concat(tags),
        name: "Queries." + options.name,
        pre: collectionPopulator(
            !isView, options.nDocs, indexes, options.docs, options.collectionOptions),
        post: function(collection) {
            collection.drop();
        },
        ops: [options.op]
    });

    if (options.createViewsPassthrough !== false) {
        tests.push({
            tags: ["views", "query_identityview"].concat(tags),
            name: "Queries.IdentityView." + options.name,
            pre: collectionPopulator(
                isView, options.nDocs, indexes, options.docs, options.collectionOptions),
            post: function(view) {
                view.drop();
                var collName = view.getName() + "_BackingCollection";
                view.getDB().getCollection(collName).drop();
            },
            ops: [options.op]
        });
    }

    // Generate a test which is the aggregation equivalent of this find operation.
    tests.push({
        tags: ["agg_query_comparison"].concat(tags),
        name: "Aggregation." + options.name,
        pre: collectionPopulator(
            !isView, options.nDocs, indexes, options.docs, options.collectionOptions),
        post: function(collection) {
            collection.drop();
        },
        ops: [rewriteQueryOpAsAgg(options.op)]
    });
}

/**
 * Setup: Create a collection of documents containing only an ObjectId _id field.
 *
 * Test: Empty query that returns all documents.
 */
addTestCase({
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
 * Setup: Create a collection of documents with only an ObjectID _id field.
 *
 * Test: Query for a document that doesn't exist. Scans all documents using a collection scan and
 * returns no documents.
 */
addTestCase({
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
 * documents.
 */
addTestCase({
    name: "IntIdFindOne",
    tags: ["regression"],
    nDocs: 4800,
    docs: function(i) {
        return {_id: i};
    },
    op: {op: "findOne", query: {_id: {"#RAND_INT_PLUS_THREAD": [0, 100]}}}
});

/**
 * Setup: Create a collection of documents with an indexed integer field x.
 *
 * Test: Query for a random document based on integer field x. Each thread accesses a distinct range
 * of documents. Query uses the index.
 */
addTestCase({
    name: "IntNonIdFindOne",
    tags: ["core", "indexed"],
    nDocs: 4800,
    docs: function(i) {
        return {_id: i};
    },
    indexes: [{x: 1}],
    op: {op: "findOne", query: {_id: {"#RAND_INT_PLUS_THREAD": [0, 100]}}}
});

/**
 * Setup: Create a collection of documents with only an integer _id field.
 *
 * Test: Query for all documents with integer _id in the range (50,100). All threads are returning
 * the same documents.
 */
addTestCase({
    name: "IntIDRange",
    tags: ["regression"],
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
addTestCase({
    name: "IntNonIDRange",
    tags: ["indexed"],
    nDocs: 4800,
    docs: function(i) {
        return {_id: i};
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
addTestCase({
    name: "RegexPrefixFindOne",
    tags: ["core", "indexed"],
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
 * Test: Query for document matching both int fields. The query will use one of the indexes. All the
 * threads access the documents in the same order.
 */
addTestCase({
    name: "TwoInts",
    tags: ["core", "indexed"],
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
 * Setup: Create a collection with a non-simple default collation, and insert indexed strings. We
 * set several collation options in an attempt to make the collation processing in ICU more
 * expensive.
 *
 * Test: Query for a range of strings using the non-simple default collation.
 */
addTestCase({
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
 * performance impact of queries with non-simple collations whose string comparison predicates are
 * indexed.
 */
addTestCase({
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

/**
 * Setup: Create a collection with a non-simple default collation and insert a small number of
 * documents with strings. We set several collation options in an attempt to make the collation
 * processing in ICU more expensive.
 *
 * Test: Issue queries that must perform a collection scan, filtering the documents with an $in
 * predicate. Request a sort which the query system must satisfy by sorting the documents in memory
 * according to the collation.
 */
addTestCase({
    name: "StringUnindexedInPredWithNonSimpleCollation",
    tags: ["regression", "collation"],
    // TODO (SERVER-5722): We cannot create a views passthrough because benchRun doesn't support
    // sorting when running in read command mode.
    createViewsPassthrough: false,
    collectionOptions: {
        collation: {
            locale: "en",
            strength: 5,
            backwards: true,
            normalization: true,
        }
    },
    nDocs: 10,
    docs: function(i) {
        return {x: i.toString()};
    },
    op: {
        op: "find",
        query: {
            $query: {x: {$in: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]}},
            $orderby: {x: 1},
        }
    }
});

/**
 * Setup: Create a collection with the simple default collation and insert a small number of
 * documents with strings.
 *
 * Test: Issue queries that must perform a collection scan, filtering the documents with an $in
 * predicate. Request a sort which the query system must satisfy by sorting the documents in memory.
 *
 * Comparing this test against StringUnidexedInPredWithNonSimpleCollation is useful for determining
 * the performance impact of queries with non-simple collations whose string comparison predicates
 * are unindexed, in addition to the perf impact of an in-memory SORT stage which uses a collator.
 */
addTestCase({
    name: "StringUnindexedInPredWithSimpleCollation",
    tags: ["regression", "collation"],
    // TODO (SERVER-5722): We cannot create a views passthrough because benchRun doesn't support
    // sorting when running in read command mode.
    createViewsPassthrough: false,
    nDocs: 10,
    docs: function(i) {
        return {x: i.toString()};
    },
    op: {
        op: "find",
        query: {
            $query: {x: {$in: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]}},
            $orderby: {x: 1},
        }
    }
});

/**
 * Large arrays used for $in queries in the subsequent test cases.
 */
var nLargeArrayElements = 1000;
var largeArrayRandom = [];
for (var i = 0; i < nLargeArrayElements; i++) {
    largeArrayRandom.push(Random.randInt(nLargeArrayElements));
}

var largeArraySorted = [];
for (var i = 0; i < nLargeArrayElements; i++) {
    largeArraySorted.push(i * 2);
}

/**
 * Setup: Create a collection and insert a small number of documents with a random even integer
 * field x in the range [0, nLargeArrayElements * 2).
 *
 * Test: Issue queries that must perform a collection scan, filtering the documents with an $in
 * predicate with a large number of elements. All documents will match the predicate, since the $in
 * array contains all even integers in the range [0, nLargeArrayElements * 2).
 */
function addInTestCase({name, largeInArray}) {
    addTestCase({
        name: name,
        tags: ["regression"],
        nDocs: 10,
        docs: function(i) {
            return {x: 2 * Random.randInt(largeInArray.length)};
        },
        op: {
            op: "find",
            query: {x: {$in: largeInArray}}
        }
    });
};

addInTestCase({
    name: "UnindexedLargeInMatching",
    largeInArray: largeArraySorted,
});

addInTestCase({
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

addInTestCase({
    name: "UnindexedVeryLargeInSortedMatching",
    largeInArray: veryLargeArraySorted,
});

addInTestCase({
    name: "UnindexedVeryLargeInUnsortedMatching",
    largeInArray: veryLargeArrayRandom,
});

/**
 * Setup: Create a collection and insert a small number of documents with a random odd integer
 * field x in the range [0, 2000).
 *
 * Test: Issue queries that must perform a collection scan, filtering the documents with an $in
 * predicate with a large number of elements. No documents will match the predicate, since the $in
 * array contains all even integers in the range [0, 2000).
 */
addTestCase({
    name: "UnindexedLargeInNonMatching",
    tags: ["regression"],
    nDocs: 10,
    docs: function(i) {
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
addTestCase({
    name: "UnindexedLargeInUnsortedNonMatching",
    tags: ["regression"],
    nDocs: 10,
    docs: function(i) {
        return {x: 2 * Random.randInt(1000) + 1};
    },
    op: {
        op: "find",
        query: {x: {$in: largeArrayRandom}}
    }
});

// Projection tests.

/**
 * Setup: Create a collection of documents with indexed integer field x.
 *
 * Test: Query for random document based on integer field x, and use projection to return only the
 * field x. Each thread accesses a distinct range of documents. Query should be a covered index
 * query.
 */
addTestCase({
    name: "IntNonIdFindOneProjectionCovered",
    tags: ["core", "indexed"],
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
 * Test: Query for random document based on integer field x, and use projection to return the field
 * x and the _id. Each thread accesses a distinct range of documents.
 */
addTestCase({
    name: "IntNonIdFindOneProjection",
    tags: ["core", "indexed"],
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
 * Test: Query for all documents with x >= 0 (all the documents), and use projection to return the
 * field x. Each thread accesses all the documents. Query should be a covered index query.
 */
addTestCase({
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
 * Test: Query for all the documents (empty query), and use projection to return the field x. Each
 * thread accesses all the documents.
 */
addTestCase({
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
 * Test: Query for all the documents (empty query), and use projection to return the field x. Each
 * thread accesses all the documents.
 */
addTestCase({
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
 * Setup: Create a collection of documents with 3 integer fields and a compound index on those three
 * fields.
 *
 * Test: Query for random document based on integer field x, and return the three integer fields.
 * Each thread accesses a distinct range of documents. Query should be a covered index scan.
 */
addTestCase({
    name: "FindProjectionThreeFieldsCovered",
    tags: ["core", "indexed"],
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
addTestCase({
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
 * Test: Query for all documents (empty query) and return just x.y. Each thread accesses a distinct
 * range of documents.
 */
addTestCase({
    name: "FindProjectionDottedField",
    tags: ["regression"],
    nDocs: 100,
    docs: function(i) {
        return {x: {y: i}};
    },
    op: {op: "find", query: {}, filter: {"x.y": 1, _id: 0}}
});

/**
 * Setup: Create a collection of documents with integer field x.y.
 *
 * Test: Query for a random document based on x.y field and return just x.y. Each thread accesses a
 * distinct range of documents. The query should be a covered index query.
*/
addTestCase({
    name: "FindProjectionDottedField.Indexed",
    tags: ["core", "indexed"],
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
addTestCase({
    name: "LargeDocs",
    nDocs: 100,
    docs: function(i) {
        return {x: bigString};
    },
    op: {op: "find", query: {}}
});

/**
 * Setup: Create a collection with an array of scalars x:[...].
 *
 * Test: Sort the collection by the x (array) field.
 */
addTestCase({
    name: "SortByArrayOfScalars",
    tags: ["core", "sort"],
    nDocs: 1000,
    docs: function(i) {
        var nArrayElements = 10;
        var arrayRandom = [];
        for (var i = 0; i < nArrayElements; i++) {
            arrayRandom.push(Random.randInt(10000));
        }
        return {x: arrayRandom};
    },
    op: {op: "find", query: {$query:{}, $orderby: {x: 1}}}
});

/**
 * Setup: Create a collection with an array of documents arr:[x:{...},...].
 *
 * Test: Sort the collection by the nested arr.x field.
 */
addTestCase({
    name: "SortByArrayOfNestedDocuments",
    tags: ["core", "sort"],
    nDocs: 1000,
    docs: function(i) {
        var nArrayElements = 10;
        var arrayRandom = [];
        for (var i = 0; i < nArrayElements; i++) {
            arrayRandom.push({x:Random.randInt(10000)});
        }
        return {arr: arrayRandom};
    },
    op: {op: "find", query: {$query:{}, $orderby: {"arr.x": 1}}}
});

/**
 * Setup: Create a collection with a scalar field x and an index on x.
 *
 * Test: Sort the collection by the x field.
 */
addTestCase({
    name: "CoveredNonBlockingSort",
    tags: ["core", "sort", "indexed"],
    nDocs: 1000,
    docs: function(i) {
        return {x: Random.randInt(10000)};
    },
    indexes: [{x: 1}],
    op: {op: "find", query: {$query:{}, $orderby: {x: 1}}, filter: {x: 1, _id: 0}}
});

/**
 * Setup: Create a collection with scalar fields x, y and an index on x, y.
 *
 * Test: Sort the collection by the y field which is eligible for covering but still requires
 * a blocking SORT stage.
 */
addTestCase({
    name: "CoveredBlockingSort",
    tags: ["core", "sort", "indexed"],
    nDocs: 1000,
    docs: function(i) {
        return {x: Random.randInt(10000), y: Random.randInt(10000)};
    },
    indexes: [{x: 1,  y: 1}],
    op: {
        op: "find",
        query: {$query:{x: {$gt: 0}, y: {$gt: 0}},
        $orderby: {y: 1}},
        filter: {x: 1, y:1, _id: 0}
    }
});
