if ( typeof(tests) != "object" ) {
    tests = [];
}

tests.push( { name: "Remove.v3.IntId",
              tags: ['remove','sanity','daily','weekly','monthly'],
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

tests.push( { name: "Remove.v3.IntNonIdNoIndex",
              tags: ['remove','sanity','daily','weekly','monthly'],
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

tests.push( { name: "Remove.v3.IntNonIdIndex",
              tags: ['remove','sanity','daily','weekly','monthly'],
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