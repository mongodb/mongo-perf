if ( typeof(tests) != "object" ) {
    tests = [];
}

var queryOnAbcOps = [
    { op: "let", target: "x", value: {"#RAND_INT_PLUS_THREAD": [0,100]}},
    { op: "find", query: { _id : {"#VARIABLE": "x"},
                             a : {"#VARIABLE": "x"},
                             b : {"#VARIABLE": "x"},
                             c : "foo" } }
];

var insertData = function(collection, threads) {
    collection.drop();
    var bulk = collection.initializeUnorderedBulkOp();
    for ( var i = 0; i < 100 * threads; i++ ) {
      bulk.insert( { _id: i, a: i, b: i, c: "foo", d: i } );
    }
    bulk.execute();
}

/*
 * Setup: Create collection with documents of shape {_id: i, a: i, b: i, c: "foo", d: i}.
 *
 * Test: query by _id, a, b, and c for a particular i value. This will execute by looking up i in
 * the unique {_id: 1} index.
 */
tests.push( { name: "Queries.UniqueIdx.Simple",
              tags: ['query','uniqueidx','compare'],
              pre: function(collection, env) {
                  insertData(collection, env.threads);
              },
              ops: queryOnAbcOps } );

/*
 * Setup: Create collection with documents of shape {_id: i, a: i, b: i, c: "foo", d: i}. Also
 * create non-unique indices on fields 'a' and 'c'.
 *
 * Test: query by _id, a, b, and c for a particular i value. This should execute by looking up i in
 * the unique {_id: 1} index after throwing out plans that do not use a unique index lookup.
 */
tests.push( { name: "Queries.UniqueIdx.HaveNonUniqueIndices",
              tags: ['query','uniqueidx'],
              pre: function(collection, env) {
                  insertData(collection, env.threads);
                  collection.ensureIndex({a: 1});
                  collection.ensureIndex({c: 1});
              },
              ops: queryOnAbcOps } );

/*
 * Setup: Create collection with documents of shape {_id: i, a: i, b: i, c: "foo", d: i}. Also
 * create a unique index on fields 'a' and a non-unique index on field 'c'.
 *
 * Test: query by _id, a, b, and c for a particular i value. This should execute by looking up i in
 * either the unique {_id: 1} index or the unique {a: 1} index. The planner should throw out the
 * plan using index {c: 1}.
 */
tests.push( { name: "Queries.UniqueIdx.MultipleUniqueIndices",
              tags: ['query','uniqueidx'],
              pre: function(collection, env) {
                  insertData(collection, env.threads);
                  collection.ensureIndex({a: 1}, {unique: true});
                  collection.ensureIndex({c: 1});
              },
              ops: queryOnAbcOps } );

/*
 * Setup: Create collection with documents of shape {_id: i, a: i, b: [...], c: "foo"}. Create a
 * non-multikey, non-unique index on 'a' and a multikey, non-unique index on 'b'.
 *
 * Test: query by a and b. There are no unique indices available for this query, as this is a
 * baseline for the following multikey test.
 */
tests.push( { name: "Queries.UniqueIdx.MultikeySimple",
              tags: ['query','uniqueidx','compare'],
              pre: function(collection) {
                  collection.drop();
                  var bulk = collection.initializeUnorderedBulkOp();
                  for ( var i = 0; i < 100; i++ ) {
                      bulk.insert( { _id : i, a: i, b: [i, (i+1)], c: "foo" } );
                  }
                  bulk.execute();
                  collection.ensureIndex({a: 1});
                  collection.ensureIndex({b: 1});
              },
              ops: [
                  { op: "find", query: { a : 50, b : {$all: [50, 51]} } }
              ] } );

/*
 * Setup: Create collection with documents of shape {_id: i, a: i, b: [...], c: "foo"}. Create a
 * non-multikey, unique index on 'a' and a multikey, non-unique index on 'b'.
 *
 * Test: query by a and b. This should execute by looking up i in {a: 1} index. The planner should
 * throw out the plan using index {b: 1}.
 */
tests.push( { name: "Queries.UniqueIdx.MultikeyWithUniqueIdx",
              tags: ['query','uniqueidx'],
              pre: function(collection) {
                  collection.drop();
                  var bulk = collection.initializeUnorderedBulkOp();
                  for ( var i = 0; i < 100; i++ ) {
                      bulk.insert( { _id: i, a: i, b: [i, (i+1)], c: "foo" } );
                  }
                  bulk.execute();
                  collection.ensureIndex({a: 1}, {unique: true});
                  collection.ensureIndex({b: 1});
              },
              ops: [
                  { op: "find", query: { a : 50, b : {$all: [50, 51]} } }
              ] } );

/*
 * Setup: Create collection with documents of shape {_id: i, a: i, b: i, c: "foo", d: i}. Also
 * create non-unique indices on fields 'a', 'b', 'c', and 'd'.
 *
 * Test: query by _id, a, b, c, and d for a particular i value.
 */
tests.push( { name: "Queries.UniqueIdx.ManyIdxIsect",
              tags: ['query','uniqueidx'],
              pre: function(collection) {
                  insertData(collection, 1);
                  collection.ensureIndex({a: 1});
                  collection.ensureIndex({b: 1});
                  collection.ensureIndex({c: 1});
                  collection.ensureIndex({d: 1});
              },
              ops: [
                  { op: "find", query: { _id : 50, a : 50, b : 50, c : "foo", d : 50 } }
              ] } );

/*
 * Setup: Create collection with documents of shape {_id: i, a: i, b: i, c: "foo", d: i}. Also
 * create non-unique indices on fields 'a', 'b', 'c', and 'd'.
 *
 * Test: query by _id, a, b, c, and d for a particular _id, with range predicates on 'a', 'b', and
 * 'd'.
 */
tests.push( { name: "Queries.UniqueIdx.ManyIdxIsectRangePredicates",
              tags: ['query','uniqueidx'],
              pre: function(collection) {
                  insertData(collection, 1);
                  collection.ensureIndex({a: 1});
                  collection.ensureIndex({b: 1});
                  collection.ensureIndex({c: 1});
                  collection.ensureIndex({d: 1});
              },
              ops: [
                  { op: "find", query: { _id : 50, a : {$gte: 1, $lte: 100},
                                           b : {$lt: 100}, d : {$gt: 1} } }
              ] } );
