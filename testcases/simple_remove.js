if ( typeof(tests) != "object" ) {
    tests = [];
}

tests.push( { name: "Remove.IntId",
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 1000; i++ ) {
                      collection.insert( { _id : i } );
                  }
              },
              ops: [
                  { op:  "insert",
                    safe: false, w: 0, j: false, writeCmd: false,
                    doc: { _id : { "#RAND_INT" : [ 0, 1000 ] } } },
                  { op:  "remove",
                    safe: false, w: 0, j: false, writeCmd: false,
                    query: { _id : { "#RAND_INT" : [ 0, 1000 ] } } }
              ] } );

tests.push( { name: "Remove.IntNonIdNoIndex",
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 1000; i++ ) {
                      collection.insert( { x : i } );
                  }
              },
              ops: [
                  { op:  "insert",
                    safe: false, w: 0, j: false, writeCmd: false,
                    doc: { x : { "#RAND_INT" : [ 0, 1000 ] } } },
                  { op:  "remove",
                    safe: false, w: 0, j: false, writeCmd: false,
                    query: { x : { "#RAND_INT" : [ 0, 1000 ] } } }
              ] } );

tests.push( { name: "Remove.IntNonIdIndex",
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 1000; i++ ) {
                      collection.insert( { x : i } );
                  }
                  collection.ensureIndex( { x : 1 } );
              },
              ops: [
                  { op:  "insert",
                    safe: false, w: 0, j: false, writeCmd: false,
                    doc: { x : { "#RAND_INT" : [ 0, 1000 ] } } },
                  { op:  "remove",
                    safe: false, w: 0, j: false, writeCmd: false,
                    query: { x : { "#RAND_INT" : [ 0, 1000 ] } } }
              ] } );
