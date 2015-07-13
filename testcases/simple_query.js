if ( typeof(tests) != "object" ) {
    tests = [];
}


/*
 * Setup: Create collection of documents with only OID _id field
 * Test: Empty query that returns all documents.
 */
tests.push( { name : "Queries.Empty",
              tags: ['query','regression'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 100; i++ ) {
                      collection.insert( {} );
                  }
                  collection.getDB().getLastError();
              },
              ops : [
                  { op: "find", query: {} }
              ] } );


/*
 * Setup:  Create collection of documents with only OID _id field
 * Test: Query for a document that doesn't exist. Scans all documents
 *       using a collection scan and returns no documents
 */
tests.push( { name : "Queries.NoMatch",
              tags: ['query','regression'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 100; i++ ) {
                      collection.insert( {} );
                  }
                  collection.getDB().getLastError();
              },
              ops : [
                  { op: "find", query: { nope : 5 } }
              ] } );


/*
 * Setup: Create collection of documents with only integer _id field
 * Test: Query for random document based on _id field. Each thread
 *       accesses a distinct range of documents. 
 */
tests.push( { name: "Queries.IntIdFindOne",
              tags: ['query','regression'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 4800; i++ ) {
                      collection.insert( { _id : i } );
                  }
                  collection.getDB().getLastError();
              },
              ops: [
                  { op: "findOne", query: { _id : {"#RAND_INT_PLUS_THREAD": [0,100]} } }
              ] } );

/*
 * Setup: Create a collection of documents with indexed integer field x. 
 * Test: Query for random document based on integer field x. Each thread
 *       accesses a distinct range of documents. Query uses the index.
 */
tests.push( { name: "Queries.IntNonIdFindOne",
              tags: ['query','core','indexed'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 4800; i++ ) {
                      collection.insert( { x : i } );
                  }
                  collection.ensureIndex( { x : 1 } );
              },
              ops: [
                  { op: "findOne", query: { x : {"#RAND_INT_PLUS_THREAD": [0,100]} } }
              ] } );


/*
 * Setup: Create collection of documents with only integer _id field
 * Test: Query for all documents with integer id in range
 *       (50,100). All threads are returning the same documents.
 */
tests.push( { name : "Queries.IntIDRange",
              tags: ['query','regression'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 4800; i++ ) {
                      collection.insert( { _id : i } );
                  }
                  collection.getDB().getLastError();
              },
              ops : [
                  { op: "find", query: { _id : { $gt : 50, $lt : 100 } } }
              ] } );
/*
 * Setup: Create a collection of documents with indexed integer field x. 
 * Test: Query for all documents with x in range (50,100). All threads
 *       are returning the same documents and uses index on x. 
 */
tests.push( { name : "Queries.IntNonIDRange",
             tags: ['query','indexed'],
             pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 4800; i++ ) {
                      collection.insert( { x : i } );
                  }
                  collection.getDB().getLastError();
                  collection.ensureIndex( { x : 1 } );
              },
              ops : [
                  { op: "find", query: { x : { $gt : 50, $lt : 100 } } }
              ] } );
/*
 * Setup: Create a collection of documents with indexed string field x. 
 * Test: Regex query for document with x starting with 2400. All threads
 *       are returning the same document and uses index on x. 
 */
tests.push( { name: "Queries.RegexPrefixFindOne",
              tags: ['query','core','indexed'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 4800; i++ ) {
                      collection.insert( { x : i.toString() } );
                  }
                  collection.getDB().getLastError();
                  collection.ensureIndex( { x : 1 } );
              },
              ops : [
                  { op: "find", query: { x: /^2400/ } }
              ] } );

/*
 * Setup: Collection with documents with two integer fields, both indexed
 * Test: Query for document matching both int fields. Will use one of
 *       the indexes. All the threads access the documents in the same
 *       order
 */
tests.push( { name: "Queries.TwoInts",
              tags: ['query','core','indexed'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 4800; i++ ) {
                      collection.insert( { x: i, y: 2*i } );
                  }
                  collection.getDB().getLastError();
                  collection.ensureIndex({x: 1});
                  collection.ensureIndex({y: 1});
              },
              ops : [
                  { op: "find",
                    query: { x: { "#SEQ_INT": { seq_id: 0, start: 0, step: 1, mod: 4800 } },
                             y: { "#SEQ_INT": { seq_id: 1, start: 0, step: 2, mod: 9600 } } }
                  }
              ] } );

// PROJECTION TESTS

/*
 * Setup: Create a collection of documents with indexed integer field x. 
 * Test: Query for random document based on integer field x, and use
 *       projection to return only the field x. Each thread accesses a
 *       distinct range of documents. Query should be a covered index
 *       query.
 */
tests.push( { name: "Queries.IntNonIdFindOneProjectionCovered",
              tags: ['query','core','indexed'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 4800; i++ ) {
                      collection.insert( { x : i } );
                  }
                  collection.getDB().getLastError();
                  collection.ensureIndex( { x : 1 } );
              },
              ops: [
                  { op: "find",
                    query: { x : {"#RAND_INT_PLUS_THREAD": [0,100]} },
                    limit: 1,
                    filter: { x : 1, _id : 0 } }
              ] } );


/*
 * Setup: Create a collection of documents with indexed integer field x. 
 * Test: Query for random document based on integer field x, and use
 *       projection to return the field x and the _id. Each thread accesses a
 *       distinct range of documents. 
 */
tests.push( { name: "Queries.IntNonIdFindOneProjection",
              tags: ['query','core','indexed'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 4800; i++ ) {
                      collection.insert( { x : i } );
                  }
                  collection.getDB().getLastError();
                  collection.ensureIndex( { x : 1 } );
              },
              ops: [
                  { op: "find",
                    query: { x : {"#RAND_INT_PLUS_THREAD": [0,100]} },
                    limit: 1,
                    filter: { x : 1 } }
              ] } );

/*
 * Setup: Create a collection of documents with indexed integer field x. 
 * Test: Query for all documents with x >= 0 (all the documents), and
 *       use projection to return the field x. Each thread accesses
 *       all the documents. Query should be a covered index query.
 */
tests.push( { name: "Queries.IntNonIdFindProjectionCovered",
              tags: ['query','indexed','regression'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 100; i++ ) {
                      collection.insert( { x : i } );
                  }
                  collection.getDB().getLastError();
                  collection.ensureIndex( { x : 1 } );
              },
              ops: [
                  { op: "find",
                    query: { x: { $gte : 0 } },
                    filter: { x : 1, _id : 0 } }
              ] } );


/*
 * Setup: Create a collection of documents with indexed integer field x. 
 * Test: Query for all the documents (empty query), and use projection
 *       to return the field x. Each thread accesses all the
 *       documents.
 */
tests.push( { name: "Queries.FindProjection",
              tags: ['query','indexed','regression'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 100; i++ ) {
                      collection.insert( { x : i } );
                  }
                  collection.getDB().getLastError();
                  collection.ensureIndex( { x : 1 } );
              },
              ops: [
                  { op: "find",
                    query: { },
                    filter: { x : 1 } }
              ] } );

/*
 * Setup: Create a collection of documents with 26 integer fields. 
 * Test: Query for all the documents (empty query), and use projection
 *       to return the field x. Each thread accesses all the
 *       documents.
 */
tests.push( { name: "Queries.FindWideDocProjection",
              tags: ['query','regression'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 100; i++ ) {
                      collection.insert( { a : i, 
                          b: i, c: i, d: i, e: i,
                          f: i, g: i, h: i, i: i,
                          j: i, k: i, l: i, m: i,
                          n: i, o: i, p: i, q: i,
                          r: i, s: i, t: i, u: i,
                          v: i, w: i, x: i, y: i, z: 1
                      } );
                  }
                  collection.getDB().getLastError();
              },
              ops: [
                  { op: "find",
                    query: { },
                    filter: { x : 1 } }
              ] } );

/*
 * Setup: Create a collection of documents with 3 integer fields and a
 *        compound index on those three fields.
 * Test: Query for random document based on integer field x, and
 *       return the three integer fields. Each thread accesses a
 *       distinct range of documents. Query should be a covered index
 *       scan.
 */
tests.push( { name: "Queries.FindProjectionThreeFieldsCovered",
              tags: ['query','core','indexed'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 4800; i++ ) {
                      collection.insert( { x : i, y: i, z: i } );
                  }
                  collection.getDB().getLastError();
                  collection.ensureIndex( { x : 1, y : 1, z : 1 } );
              },
              ops: [
                  { op: "find",
                    query: { x: {"#RAND_INT_PLUS_THREAD": [0,100]} },
                    filter: { x : 1, y : 1, z : 1, _id : 0 } }
              ] } );


/*
 * Setup: Create a collection of documents with 3 integer fields 
 * Test: Query for all documents (empty query) and return the three
 *       integer fields.
 */
tests.push( { name: "Queries.FindProjectionThreeFields",
              tags: ['query','regression'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 100; i++ ) {
                      collection.insert( { x : i, y: i, z: i } );
                  }
                  collection.getDB().getLastError();
              },
              ops: [
                  { op: "find",
                    query: { },
                    filter: { x : 1, y : 1, z : 1, _id : 0 } }
              ] } );


/*
 * Setup: Create a collection of documents with integer field x.y. 
 * Test: Query for all documents (empty query) and return just
 *       x.y. Each thread accesses a distinct range of documents.
 */
tests.push( { name: "Queries.FindProjectionDottedField",
              tags: ['query','regression'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 100; i++ ) {
                      collection.insert( { x : { y: i } } );
                  }
                  collection.getDB().getLastError();
              },
              ops: [
                  { op: "find",
                    query: { },
                    filter: { 'x.y' : 1, _id : 0 } }
              ] } );

/*
 * Setup: Create a collection of documents with integer field x.y. 
 * Test: Query for a random document based on x.y field and return
 *       just x.y. Each thread accesses a distinct range of
 *       documents. The query should be a covered index query.
*/
tests.push( { name: "Queries.FindProjectionDottedField.Indexed",
              tags: ['query','core','indexed'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 4800; i++ ) {
                      collection.insert( { x : { y: i } } );
                  }
                  collection.getDB().getLastError();
                  collection.ensureIndex( { "x.y" : 1 } );
              },
              ops: [
                  { op: "find",
                    query: { 'x.y' : {"#RAND_INT_PLUS_THREAD": [0,100]}},
                    filter: { 'x.y' : 1, _id : 0 } }
              ] } );

/*
 * Setup: Insert 100 5mb documents into database
 * Test: Do a table scan
 */
tests.push( { name: "Queries.LargeDocs",
              tags: ['query'],
              pre: function( collection ) {
                  collection.drop();
                  var bigString = new Array(1024*1024*5).toString();
                  for ( var i = 0; i < 100; i++ ) {
                      collection.insert( { x : bigString } );
                  }
              },
              ops: [
                  { op: "find", query: {} }
              ] } );
