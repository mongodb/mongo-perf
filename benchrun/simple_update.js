if ( typeof(tests) != "object" ) {
    tests = [];
}

tests.push( { name: "Update.IncNoIndex",
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 1000; i++ ) {
                      collection.insert( { _id : i , x : 0 } );
                  }
                  collection.getDB().getLastError();
              },
              ops: [
                  { op: "update",
                    query: { _id : { "#RAND_INT" : [ 0, 1000 ] } },
                    update: { $inc : { x : 1 } } },
              ] } );

tests.push( { name: "Update.IncWithIndex",
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 1000; i++ ) {
                      collection.insert( { _id : i , x : 0 } );
                  }
                  collection.getDB().getLastError();
                  collection.ensureIndex( { x : 1 } );
              },
              ops: [
                  { op: "update",
                    query: { _id : { "#RAND_INT" : [ 0, 1000 ] } },
                    update: { $inc : { x : 1 } } },
              ] } );

tests.push( { name: "Update.IncNoIndexUpsert",
              pre: function( collection ) {
                  collection.drop();
              },
              ops: [
                  { op: "update",
                    upsert : true,
                    query: { _id : { "#RAND_INT" : [ 0, 1000 ] } },
                    update: { $inc : { x : 1 } } },
              ] } );

tests.push( { name: "Update.IncWithIndexUpsert",
              pre: function( collection ) {
                  collection.drop();
                  collection.ensureIndex( { x : 1 } );
              },
              ops: [
                  { op: "update",
                    upsert : true,
                    query: { _id : { "#RAND_INT" : [ 0, 1000 ] } },
                    update: { $inc : { x : 1 } } },
              ] } );


// skipping *_QueryOnSecondary
// ERH has no idea why those are interesting


// pick up at IncFewSmallDoc
