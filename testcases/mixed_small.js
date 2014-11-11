if ( typeof(tests) != "object" ) {
    tests = [];
}

tests.push( { name: "Mixed.v3.FindOneUpdateIntId-50-50",
              tags: ['mixed','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 4800; i++ ) {
                      collection.insert( { _id : i , x : 0 } );
                  }
                  collection.getDB().getLastError();
              },
              ops: [
                  { op: "let", target: "x", value: {"#RAND_INT_PLUS_THREAD": [0,100]}},
                  { op: "findOne",
                    query: { _id : { "#VARIABLE" : "x" } } },
                  { op: "update",
                    query: { _id : { "#VARIABLE" : "x" } },
                    update: { $inc : { x : 1 } } },
              ] } );

tests.push( { name: "Mixed.v0.FineThenUpdate-50-50",
              tags: ['mixed','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();

                  for ( var i = 0; i < 4800; i++ ) {
                      collection.insert( { x : i, y : generateRandomString(1024) } );
                  }
                  collection.getDB().getLastError();
                  collection.ensureIndex( { x : 1 } );
                  collection.ensureIndex( { y : 1 } );
              },
              ops: [
                  { op: "let", target: "x", value: {"#RAND_INT_PLUS_THREAD": [0,100]}},
                  { op: "find",
                    query: { x : { "#VARIABLE" : "x" } } },
                  { op:  "update",
                    query: { x : { "#VARIABLE" : "x" } },
                    update: { $set : { y : {"#RAND_STRING": [1024] } } } },
              ] } );