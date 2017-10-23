if ( typeof(tests) != "object" ) {
    tests = [];
}

var setupTest = function (collection) {
    collection.drop();
};

/*
 * Create a selective partial index for tests
 */
var setupTestFiltered = function (collection) {
    setupTest(collection);
    collection.createIndex( { x : 1 }, { partialFilterExpression : { a : { $lt : 500 } } } );
};

/*
 * Setup: Create a partial index for a < 500 
 * Test: Insert documents with two random integer fields a and x, with
 *       a satisfying the filter for the partial index. Document will
 *       be indexed.
 */
tests.push( { name : "Inserts.PartialIndex.FilteredRange",
              tags: ['partial_index','insert','indexed','regression'],
              pre: function( collection ) {
                  setupTestFiltered(collection);
              },

              ops : [
                  { op: "insert", doc:  { x : {"#RAND_INT" : [ 0, 500 ]}, a : {"#RAND_INT" : [ 0, 500 ]} } }
              ] } );

/*
 * Setup: Create a partial index for a < 500 
 * Test: Insert documents with two random integer fields a and x, with
 *       a not satisfying the filter for the partial index. Document will
 *       not be indexed.
 */
tests.push( { name : "Inserts.PartialIndex.NonFilteredRange",
              tags: ['partial_index','insert','indexed'],
              pre: function( collection ) {
                  setupTestFiltered(collection);
              },

              ops : [
                  { op: "insert", doc:  { x : {"#RAND_INT" : [ 500, 4800 ]}, a : {"#RAND_INT" : [ 500, 4800 ]} } }
              ] } );

/*
 * Setup: Create a partial index for a < 500 
 * Test: Insert documents with two random integer fields a and x,
 *       where a may, or may not satisfy the filter for the partial
 *       index. Some of the documents will be indexed (10.4%).
 */
tests.push( { name : "Inserts.PartialIndex.FullRange",
              tags: ['partial_index','insert','indexed'],
              pre: function( collection ) {
                  setupTestFiltered(collection);
              },

              ops : [
                  { op: "insert", doc:  { x : { "#RAND_INT" : [ 0 , 4800 ] }, a : { "#RAND_INT" : [ 0 , 4800 ] } } }
              ] } );


