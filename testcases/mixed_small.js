if ( typeof(tests) != "object" ) {
    tests = [];
}

tests.push( { name: "Mixed.FindOneUpdateIntId-50-50",
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 1000; i++ ) {
                      collection.insert( { _id : i , x : 0 } );
                  }
                  collection.getDB().getLastError();
              },
              ops: [
                  { op: "findOne",
                    query: { _id : { "#RAND_INT" : [ 0, 1000 ] } } },
                  { op: "update",
                    safe: false, w: 0, j: false, writeCmd: false,
                    query: { _id : { "#RAND_INT" : [ 0, 1000 ] } },
                    update: { $inc : { x : 1 } } },
              ] } );
