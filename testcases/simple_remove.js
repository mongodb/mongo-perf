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
                  { op: "insert",
                    doc: { _id : { "#RAND_INT" : [ 0, 1000 ] } } },
                  { op: "remove",
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
                  { op: "insert",
                    doc: { x : { "#RAND_INT" : [ 0, 1000 ] } } },
                  { op: "remove",
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
                  { op: "insert",
                    doc: { x : { "#RAND_INT" : [ 0, 1000 ] } } },
                  { op: "remove",
                    query: { x : { "#RAND_INT" : [ 0, 1000 ] } } }
              ] } );
