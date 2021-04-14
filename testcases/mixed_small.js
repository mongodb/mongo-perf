if ( typeof(tests) != "object" ) {
    tests = [];
}

/*
 * Setup: Create collection of documents with integer _id field and
 *        integer field x with initial value 0
 * Test: Each iteration of the test will pick a random document, Query
 *       that document, and then update that same document by
 *       incrementing the field x. Each thread will operate on
 *       separate range of documents
 */
tests.push( { name: "Mixed.FindOneUpdateIntId-50-50",
              tags: ['mixed','core'],
              pre: function( collection ) {
                  collection.drop();
                  var docs = [];
                  for ( var i = 0; i < 4800; i++ ) {
                      docs.push( { _id : i , x : 0 } );
                  }
                  collection.insert(docs);
              },
              ops: [
                  { op: "let", target: "x", value: {"#RAND_INT_PLUS_THREAD": [0,100]}},
                  { op: "findOne",
                    query: { _id : { "#VARIABLE" : "x" } } },
                  { op: "update",
                    query: { _id : { "#VARIABLE" : "x" } },
                    update: { $inc : { x : 1 } } },
              ] } );

/*
 * Setup: Create collection of documents with integer field x and
 *        random 1024 character string y, and index based on both fields.
 * Test: Each iteration of the test will pick a random document by
 *       field x, Query that document, and then update that same
 *       document by setting the field y to a new random string of the
 *       same length.  Each thread will operate on separate range of
 *       documents
 */
tests.push( { name: "Mixed.FindThenUpdate-50-50",
              tags: ['mixed','indexed','regression'],
              pre: function( collection ) {
                  collection.drop();

                  var docs = [];
                  for ( var i = 0; i < 4800; i++ ) {
                      docs.push( { x : i, y : generateRandomString(1024) } );
                  }
                  collection.insert(docs);
                  collection.createIndex( { x : 1 } );
                  collection.createIndex( { y : 1 } );
              },
              ops: [
                  { op: "let", target: "x", value: {"#RAND_INT_PLUS_THREAD": [0,100]}},
                  { op: "find",
                    query: { x : { "#VARIABLE" : "x" } } },
                  { op:  "update",
                    query: { x : { "#VARIABLE" : "x" } },
                    update: { $set : { y : {"#RAND_STRING": [1024] } } } },
              ] } );
