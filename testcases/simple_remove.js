if ( typeof(tests) != "object" ) {
    tests = [];
}

tests.push( { name: "Remove.v2.IntId",
              tags: ['remove','sanity','update','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 1000; i++ ) {
                      collection.insert( { _id : i } );
                  }
              },
              ops: [
                  { op: "let", target: "x", value: {"#RAND_INT_PLUS_THREAD": [0,1000]}},
                  { op:  "insert",
                    doc: { _id : { "#VARIABLE" : "x" } } },
                  { op:  "remove",
                    query: { _id : { "#VARIABLE" : "x" } } },
              ] } );

tests.push( { name: "Remove.v2.IntNonIdNoIndex",
              tags: ['remove','sanity','update','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 1000; i++ ) {
                      collection.insert( { x : i } );
                  }
              },
              ops: [
                  { op: "let", target: "x", value: {"#RAND_INT_PLUS_THREAD": [0,1000]}},
                  { op:  "insert",
                    doc: { x : { "#VARIABLE" : "x" } } },
                  { op:  "remove",
                    query: { x : { "#VARIABLE" : "x" } } }
              ] } );

tests.push( { name: "Remove.v2.IntNonIdIndex",
              tags: ['remove','sanity','update','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 1000; i++ ) {
                      collection.insert( { x : i } );
                  }
                  collection.ensureIndex( { x : 1 } );
              },
              ops: [
                  { op: "let", target: "x", value: {"#RAND_INT_PLUS_THREAD": [0,1000]}},
                  { op:  "insert",
                    doc: { x : { "#VARIABLE" : "x" } } },
                  { op:  "remove",
                    query: { x : { "#VARIABLE" : "x" } } }
              ] } );