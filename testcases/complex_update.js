if ( typeof(tests) != "object" ) {
    tests = [];
}

/*
 * Setup: Create collection with integer _id and indexed integer
 *        field x with initial value 0
 * Test: Each thread picks a random document based on _id, and sets
 *       field x to a random integer (updating the index). Each thread
 *       updates a distinct range of documents.
 */
tests.push( { name: "Update.SetWithIndex.Random",
              tags: ['update','core','indexed','regression'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 4800; i++ ) {
                      collection.insert( { _id : i , x : 0 } );
                  }
                  collection.getDB().getLastError();
                  collection.ensureIndex( { x : 1 } );
              },
              ops: [
                  { op:  "update",
                    query: { _id : { "#RAND_INT_PLUS_THREAD" : [ 0, 100 ] } },
                    update: { $set : { x : {"#RAND_INT": [0,1000] } } } },
              ] } );

/*
 * Setup: Create collection with integer _id and indexed integer field
 *        x with initial value 0, and indexed integer field y
 *        (distinct values)
 * Test: Each thread picks a random document based on _id, and sets
 *       fields x and y to different random integer (updating both
 *       indexes). Each thread updates a distinct range of documents.
 */
tests.push( { name: "Update.SetWithMultiIndex.Random",
              tags: ['update','indexed','regression'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 4800; i++ ) {
                      collection.insert( { _id : i , x : 0, y : i } );
                  }
                  collection.getDB().getLastError();
                  collection.ensureIndex( { x : 1 } );
                  collection.ensureIndex( { y : 1 } );
              },
              ops: [
                  { op:  "update",
                    query: { _id : { "#RAND_INT_PLUS_THREAD" : [ 0, 100 ] } },
                    update: { $set : { x : {"#RAND_INT": [0,1000] }, y : {"#RAND_INT": [0,1000] } } } },
              ] } );

/*
 * Setup: Create collection with integer _id and indexed integer field
 *        x with initial value 0, and indexed random string field y
 * Test: Each thread picks a random document based on _id, and sets
 *       fields x to a random integer and y to different random string
 *       of the same length (updating both indexes). Each thread
 *       updates a distinct range of documents.
 */
tests.push( { name: "Update.SetWithMultiIndex.String",
              tags: ['update','indexed','regression'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 4800; i++ ) {
                      collection.insert( { _id : i , x : 0, y : generateRandomString(1024) } );
                  }
                  collection.getDB().getLastError();
                  collection.ensureIndex( { x : 1 } );
                  collection.ensureIndex( { y : 1 } );
              },
              ops: [
                  { op:  "update",
                    query: { _id : { "#RAND_INT_PLUS_THREAD" : [ 0, 100 ] } },
                    update: { $set : { x : {"#RAND_INT": [0,1000] }, y : {"#RAND_STRING": [1024] } } } },
              ] } );
