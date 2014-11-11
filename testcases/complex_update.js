if ( typeof(tests) != "object" ) {
    tests = [];
}

tests.push( { name: "Update.v0.SetWithIndex.Random",
              tags: ['update','complex','daily','weekly','monthly'],
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

tests.push( { name: "Update.v0.SetWithMultiIndex.Random",
              tags: ['update','complex','daily','weekly','monthly'],
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

tests.push( { name: "Update.v0.SetWithMultiIndex.String",
              tags: ['update','complex','daily','weekly','monthly'],
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