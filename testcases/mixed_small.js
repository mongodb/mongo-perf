if ( typeof(tests) != "object" ) {
    tests = [];
}

tests.push( { name: "Mixed.v2.FindOneUpdateIntId-50-50",
              tags: ['mixed','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 3200; i++ ) {
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
