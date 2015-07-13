if ( typeof(tests) != "object" ) {
    tests = [];
}

/*
* Setup: Populate a collection with integer id's
* Test:  Each thread works in a range of 100 documents; remove (and re-insert) a
*        random document in its range using the _id field.
*/
tests.push( { name: "Remove.IntId",
              tags: ['remove','core'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 4800; i++ ) {
                      collection.insert( { _id : i } );
                  }
              },
              ops: [
                  { op: "let", target: "x", value: {"#RAND_INT_PLUS_THREAD": [0,100]}},
                  { op:  "remove",
                    query: { _id : { "#VARIABLE" : "x" } } },
                  { op:  "insert",
                    doc: { _id : { "#VARIABLE" : "x" } } },
              ] } );

/*
* Setup: Populate a collection with an integer field of unique values
* Test:  Each thread works in a range of 100 documents; remove (and re-insert)
*        a random document in its range based on the integer field
*/
tests.push( { name: "Remove.IntNonIdNoIndex",
              tags: ['remove','regression'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 4800; i++ ) {
                      collection.insert( { x : i } );
                  }
              },
              ops: [
                  { op: "let", target: "x", value: {"#RAND_INT_PLUS_THREAD": [0,100]}},
                  { op:  "remove",
                    query: { x : { "#VARIABLE" : "x" } } },
                  { op:  "insert",
                    doc: { x : { "#VARIABLE" : "x" } } },
              ] } );

/*
* Setup: Populate a collection with an integer field of unique values
*        Create index on the integer field
* Test:  Each thread works in a range of 100 documents; remove (and re-insert)
*        a random document in its range based on the indexed integer field
*/
tests.push( { name: "Remove.IntNonIdIndex",
              tags: ['remove','core','indexed'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 4800; i++ ) {
                      collection.insert( { x : i } );
                  }
                  collection.ensureIndex( { x : 1 } );
              },
              ops: [
                  { op: "let", target: "x", value: {"#RAND_INT_PLUS_THREAD": [0,100]}},
                  { op:  "remove",
                    query: { x : { "#VARIABLE" : "x" } } },
                  { op:  "insert",
                    doc: { x : { "#VARIABLE" : "x" } } },
              ] } );
