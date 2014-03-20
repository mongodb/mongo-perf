if ( typeof(tests) != "object" ) {
    tests = [];
}

tests.push( { name : "Queries.Empty",
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 1000; i++ ) {
                      collection.insert( {} );
                  }
              },
              ops : [
                  { op: "find", query: {} }
              ] } );

tests.push( { name : "Queries.NoMatch",
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 1000; i++ ) {
                      collection.insert( {} );
                  }
              },
              ops : [
                  { op: "find", query: { nope : 5 } }
              ] } );


tests.push( { name: "Queries.IntIdFindOne",
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 1000; i++ ) {
                      collection.insert( { _id : i } );
                  }
                  collection.getDB().getLastError();
              },
              ops: [
                  { op: "findOne", query: { _id : { "#RAND_INT" : [ 0, 1000 ] } } }
              ] } );

tests.push( { name: "Queries.IntNonIdFindOne",
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 1000; i++ ) {
                      collection.insert( { x : i } );
                  }
                  collection.ensureIndex( { x : 1 } );
              },
              ops: [
                  { op: "findOne", query: { x : { "#RAND_INT" : [ 0, 1000 ] } } }
              ] } );


tests.push( { name : "Queries.IntIDRange",
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 1000; i++ ) {
                      collection.insert( { _id : i } );
                  }
                  collection.getDB().getLastError();
              },
              ops : [
                  { op: "find", query: { _id : { $gt : 50, $lt : 100 } } }
              ] } );


tests.push( { name : "Queries.IntNonIDRange",
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 1000; i++ ) {
                      collection.insert( { x : i } );
                  }
                  collection.ensureIndex( { x : 1 } );
              },
              ops : [
                  { op: "find", query: { x : { $gt : 50, $lt : 100 } } }
              ] } );


// left off at: RegexPrefixFindOne

tests.push( { name: "Queries.IntNonIdFindOneProjectionCovered",
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 1000; i++ ) {
                      collection.insert( { x : i } );
                  }
                  collection.ensureIndex( { x : 1 } );
              },
              ops: [
                  { op: "find",
                    query: { x : { "#RAND_INT" : [ 0, 1000 ] } },
                    limit: 1,
                    filter: { x : 1, _id : 0 } }
              ] } );


