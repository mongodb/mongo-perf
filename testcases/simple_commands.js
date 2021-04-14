if (typeof(tests) != "object") {
    tests = [];
}

/*
 * Setup:
 * Test: Run command isMaster
 */
tests.push({
    name: "Commands.isMaster",
    tags: ['command'],
    ops: [{op: "command", ns: "#B_DB", command: {"isMaster": 1}}]
});

/*
 * Setup:
 * Test: Run command buildInfo
 */
tests.push({
    name: "Commands.buildInfo",
    tags: [],
    ops: [{op: "command", ns: "#B_DB", command: {"buildInfo": 1}}]
});

/*
 * Setup:
 * Test: Run a non-existent test
 */
tests.push({
    name: "Commands.illegalOp",
    tags: [],
    ops: [{op: "command", ns: "#B_DB", command: {"notExist": 1}}]
});

/*
 * Setup:
 * Test: Run benchrun command nop. Doesn't touch the server.
 */
tests.push({name: "Commands.nop", tags: [], ops: [{op: "nop"}]});

/*
 * Setup: Create collection of documents with only integer _id field
 * Test: Call count command on collection
 */
tests.push({
    name: "Commands.CountsFullCollection",
    tags: ['command', 'regression'],
    pre: function(collection) {
        collection.drop();
        var docs = [];
        for (var i = 0; i < 4800; i++) {
            docs.push({_id: i});
        }
        collection.insert(docs);
    },
    ops: [{op: "command", ns: "#B_DB", command: {"count": "#B_COLL"}}]
});

/*
 * Setup: Create collection of documents with only integer _id field
 * Test: Count documents with _id in range (10,100).
 */
tests.push({
    name: "Commands.CountsIntIDRange",
    tags: ['command', 'regression'],
    pre: function(collection) {
        collection.drop();
        var docs = [];
        for (var i = 0; i < 4800; i++) {
            docs.push({_id: i});
        }
        collection.insert(docs);
    },
    ops: [{
        op: "command",
        ns: "#B_DB",
        command: {count: "#B_COLL", query: {_id: {"$gt": 10, "$lt": 100}}}
    }]
});

/*
 * Setup:
 * Test: Call findAndModify with upsert on an integer _id field. The
 *       _id field is updated to the existing value. Each thread works
 *       on distinct range of documents.
 */
tests.push({
    name: "Commands.FindAndModifyInserts",
    tags: ['command', 'regression'],
    pre: function(collection) {
        collection.drop();
    },
    ops: [
        {op: "let", target: "x", value: {"#RAND_INT_PLUS_THREAD": [0, 100]}},
        {
          op: "command",
          ns: "#B_DB",
          command: {
              findAndModify: "#B_COLL",
              upsert: true,
              query: {_id: {"#VARIABLE": "x"}},
              update: {_id: {"#VARIABLE": "x"}}
          }
        }
    ]
});

/*
 * Setup: Create collection of documents with a counter set to 0, and a random field.
 * Test: Call findAndModify with a sort on {count: 1, rand: 1}, incrementing the count.
 */
tests.push({
    name: "Commands.FindAndModifySortedUpdate",
    tags: ["command", "regression"],
    pre: function setUpFindAndModifySortedUpdate(collection) {
        collection.drop();
        Random.setRandomSeed(22002);
        var nDocs = 5000;
        var bulk = collection.initializeUnorderedBulkOp();
        for (var i = 0; i < nDocs; i++) {
            bulk.insert({count: 0, rand: Random.rand()});
        }
        bulk.execute();
    },
    ops: [{
        op: "command",
        ns: "#B_DB",
        command: {
            findAndModify: "#B_COLL",
            query: {},
            update: {$inc: {count: 1}},
            sort: {count: 1, rand: 1}
        }
    }]
});

/*
 * Setup: Create collection of documents with timestamps.
 * Test: Call findAndModify with a sort on the timestamp, deleting the document, then inserting a
 * new document with a timestamp.
 */
tests.push({
    name: "Commands.FindAndModifySortedDelete",
    tags: ["command", "regression"],
    pre: function setUpFindAndModifySortedDelete(collection) {
        collection.drop();
        Random.setRandomSeed(22002);
        var nDocs = 5000;
        var bulk = collection.initializeUnorderedBulkOp();
        for (var i = 0; i < nDocs; i++) {
            bulk.insert({ts: new Date()});
        }
        bulk.execute();
    },
    ops: [
        {
          op: "command",
          ns: "#B_DB",
          command: {findAndModify: "#B_COLL", query: {}, remove: true, sort: {ts: 1}}
        },
        {op: "insert", doc: {ts: {"#CUR_DATE": 0}}}
    ]
});

/*
 * Setup: Create collection of documents with a counter set to 0, and a random field, with an index
 * on {count: 1, rand: 1}.
 * Test: Call findAndModify with a sort on {count: 1, rand: 1}, incrementing the count.
 */
tests.push({
    name: "Commands.FindAndModifySortedUpdateIndexed",
    tags: ["command", "regression"],
    pre: function setUpFindAndModifySortedUpdate(collection) {
        collection.drop();
        Random.setRandomSeed(22002);
        var nDocs = 5000;
        var bulk = collection.initializeUnorderedBulkOp();
        for (var i = 0; i < nDocs; i++) {
            bulk.insert({count: 0, rand: Random.rand()});
        }
        bulk.execute();
        collection.createIndex({count: 1, rand: 1});
    },
    ops: [{
        op: "command",
        ns: "#B_DB",
        command: {
            findAndModify: "#B_COLL",
            query: {},
            update: {$inc: {count: 1}},
            sort: {count: 1, rand: 1}
        }
    }]
});

/*
 * Setup: Create collection of documents with timestamps, and create an index on the timestamp
 * field.
 * Test: Call findAndModify with a sort on the timestamp, deleting the document, then inserting a
 * new document with a timestamp.
 */
tests.push({
    name: "Commands.FindAndModifySortedDeleteIndexed",
    tags: ["command", "regression"],
    pre: function setUpFindAndModifySortedDelete(collection) {
        collection.drop();
        Random.setRandomSeed(22002);
        var nDocs = 5000;
        var bulk = collection.initializeUnorderedBulkOp();
        for (var i = 0; i < nDocs; i++) {
            bulk.insert({ts: new Date()});
        }
        bulk.execute();
        collection.createIndex({ts: 1});
    },
    ops: [
        {
          op: "command",
          ns: "#B_DB",
          command: {findAndModify: "#B_COLL", query: {}, remove: true, sort: {ts: 1}}
        },
        {op: "insert", doc: {ts: {"#CUR_DATE": 0}}}
    ]
});

/*
 * Function to generate tests using distinct command.
 * name: The name to give to the test
 * index: Use an index or not
 * query: Use a query on field x to the distinct command
 *
 * The function creates a full test, with name, tags, ops, and pre fields
 */
function genDistinctTest(name, index, query) {
    var doc = {name: name, tags: ['distinct', 'command', 'core']};
    if (index) {
        doc.pre = function(collection) {
            collection.drop();
            var docs = [];
            for (var i = 0; i < 4800; i++) {
                docs.push({x: 1});
                docs.push({x: 2});
                docs.push({x: 3});
            }
            collection.insert(docs);
            collection.createIndex({x: 1});
        };
    } else {
        doc.pre = function(collection) {
            collection.drop();
            var docs = [];
            for (var i = 0; i < 4800; i++) {
                docs.push({x: 1});
                docs.push({x: 2});
                docs.push({x: 3});
            }
            collection.insert(docs);
        };
    }

    var op = {op: "command", ns: "#B_DB", command: {distinct: "#B_COLL", key: "x"}};
    if (query)
        op.command.query = {x: 1};

    doc.ops = [op];

    return doc;
}

/*
 * Setup: Create a collection with documents {_id, x}, with three
 *        distinct integer values of x, with an index on x.
 * Test:  Call distinct command on field x.
 */
tests.push(genDistinctTest("Commands.DistinctWithIndex", true, false));

/*
 * Setup: Create a collection with documents {_id, x}, with three
 *        distinct integer values of x, with an index on x.
 * Test: Call distinct command on key 'x' and query {x : 1}. Returns the 1 valid
 *       distinct value. Uses an index scan to compute the distinct values
 */
tests.push(genDistinctTest("Commands.DistinctWithIndexAndQuery", true, true));

/*
 * Setup: Create a collection with documents {_id, x}, with three
 *        distinct integer values of x
 * Test: Call distinct command on key 'x'. Returns the 3 valid
 *       distinct values. Performs a collection scan over all the
 *       documents to compute the distinct values
 */
tests.push(genDistinctTest("Commands.DistinctWithoutIndex", false, false));

/*
 * Setup: Create a collection with documents {_id, x}, with three
 *        distinct integer values of x
 * Test: Call distinct command on key 'x' and query {x : 1}. Returns the 1 valid
 *       distinct value. Performs a collection scan over all the
 *       documents to compute the distinct values
 */
tests.push(genDistinctTest("Commands.DistinctWithoutIndexAndQuery", false, true));

