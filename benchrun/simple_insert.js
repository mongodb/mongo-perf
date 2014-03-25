
if ( typeof(tests) != "object" )
    tests = [];

tests.push( { name: "Insert::Empty",
              pre: function( collection ) { collection.drop(); },
              ops: [
                  { op: "insert", doc: {} }
              ] } );

tests.push( { name: "Insert::EmptyCapped",
              pre: function( collection ) {
                  collection.drop();
                  collection.runCommand( "create", { capped : true,
                                                     size : 32 * 1024 } );
              },
              ops: [
                  { op: "insert", doc: {} }
              ] } );

/**
tests.push( { name: "Insert::EmptyBatched",
              pre: function( collection ) {
                  collection.drop();
              },
              ops: [
                  // { op: "insert", doc: }
              ] } );

tests.push( { name: "Insert::JustID",
              pre: function( collection ) { collection.drop(); },
              ops: [
                  { op: "insert", doc: }
              ] } );
 */


