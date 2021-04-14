if ( typeof(tests) != "object" ) {
    tests = [];
}

/*
 * Create a collection with documents with identical integer fields x
 * and i, sequentially assigned.
 */
var setupTest = function (collection) {
    collection.drop();
    var docs = [];
    for ( var i = 0; i < 4800; i++ ) {
        docs.push( { x : i, a : i } );
    }
    collection.insert(docs);
 
};

/*
 * Create a collection with documents with identical integer fields x
 * and i, sequentially assigned, with a partial index on x, filtered on a. 
 */
var setupTestFiltered = function (collection) {
    setupTest(collection);
    collection.createIndex( { x : 1 }, { partialFilterExpression : { a : { $lt : 500 } } } );
};

/*
 * Create a collection with documents with identical integer fields x
 * and i, sequentially assigned, with a partial index on x, filtered
 * on a, with all documents satisfying the filter.
 */
var setupTestFilteredNonSelective = function (collection) {
    setupTest(collection);
    collection.createIndex( { x : 1 }, { partialFilterExpression : { a : { $lt : 4800 } } } );
};

/*
 * Create a collection with documents with identical integer fields x
 * and i, sequentially assigned, with a traditionl index on x.
 */
var setupTestIndexed = function (collection) {
    setupTest(collection);
    collection.createIndex( { x : 1 });
};

/* 
 * Setup: Create collection with documents with integer
 *        fields x and i, sequentially assigned, with a partial index
 *        on x, filtered on a. (10.4% of documents indexed)
 * Test: Query for random documents using the partial index
 */
tests.push( { name : "Queries.PartialIndex.FilteredRange",
              tags: ['partial_index','query','core','indexed'],
              pre: function( collection ) {
                  setupTestFiltered(collection);
              },

              ops : [
                  { op: "let", target: "x", value : {"#RAND_INT" : [ 0, 500]}},
                  { op: "find", query:  { x : {"#VARIABLE" : "x"}, a : {$lt : 500  } } }
              ] } );

/* 
 * Setup: Create collection with documents with integer
 *        fields x and i, sequentially assigned, with a partial index
 *        on x, filtered on a. (10.4% of documents indexed)
 * Test: Query for random documents with 'a' not satisfying the filter
 *       (collection scan)
 */
tests.push( { name : "Queries.PartialIndex.NonFilteredRange",
              tags: ['partial_index','query','indexed'],
              pre: function( collection ) {
                  setupTestFiltered(collection);
              },

              ops : [
                  { op: "let", target: "x", value : {"#RAND_INT" : [ 500, 4800 ]}},
                  { op: "find", query:  { x : {"#VARIABLE" : "x"}, a : {$gte : 500  } } }
              ] } );

/* 
 * Setup: Create collection with documents with identical integer
 *        fields x and i, sequentially assigned, with a partial index
 *        on x, filtered on a. (10.4% of documents indexed)
 * Test: Query for random documents based on x and a, such that 10.4% 
 *       of the searches can use the partial index.
 */
tests.push( { name : "Queries.PartialIndex.FullRange",
              tags: ['partial_index','query','indexed'],
              pre: function( collection ) {
                  setupTestFiltered(collection);
              },

              ops : [
                  { op: "let", target: "x", value : {"#RAND_INT" : [ 0, 4800 ]}},
                  { op: "find", query:  { x : {"#VARIABLE" : "x"}, a : {"VARIABLE" : "x"  } } }
              ] } );


/* 
 * Setup: Create collection with documents with integer
 *        fields x and i, sequentially assigned, with a partial index
 *        on x, filtered on a. All the documents satisfy the filter and are indexed,
 * Test: Query for random documents in a small range using the partial index. 
 * Notes: This test is for comparison with test with selective partial index. 
 */
tests.push( { name : "Queries.PartialIndex.AllInFilter.FilteredRange",
              tags: ['partial_index','query','core','indexed'],
              pre: function( collection ) {
                  setupTestFilteredNonSelective(collection);
              },

              ops : [
                  { op: "let", target: "x", value : {"#RAND_INT" : [ 0, 500 ]}},
                  { op: "find", query:  { x :  {"#VARIABLE" : "x"}, a : {$lt : 500  } } }
              ] } );

/* 
 * Setup: Create collection with documents with integer
 *        fields x and i, sequentially assigned, with a partial index
 *        on x, filtered on a. All the documents satisfy the filter and are indexed,
 * Test: Query for random documents using the partial index. 
 */
tests.push( { name : "Queries.PartialIndex.AllInFilter.FullRange",
              tags: ['partial_index','query','core','indexed'],
              pre: function( collection ) {
                  setupTestFilteredNonSelective(collection);
              },

              ops : [
                  { op: "let", target: "x", value : {"#RAND_INT" : [ 0, 4800 ]}},
                  { op: "find", query:  { x : {"#VARIABLE" : "x"}, a : {"#VARIABLE": "x" } } }
              ] } );
