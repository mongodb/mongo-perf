if ( typeof(tests) != "object" ) {
    tests = [];
}

tests.push( { name: "Commands.CountsFullCollection",
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 1000; i++ ) {
                      collection.insert( { _id : i } );
                  }
                  collection.getDB().getLastError();
              },
              ops: [
                  { op: "command", ns : "#B_DB", command : { "count" : "#B_COLL" } }
              ] } );


tests.push( { name: "Commands.CountsIntIDRange",
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 1000; i++ ) {
                      collection.insert( { _id : i } );
                  }
                  collection.getDB().getLastError();
              },
              ops: [
                  { op: "command",
                    ns : "#B_DB",
                    command : { count : "#B_COLL",
                                query : { _id : { "$gt" : 10,
                                                  "$lt" : 100 } } } }
              ] } );


tests.push( { name: "Commands.FindAndModifyInserts",
              pre: function( collection ) {
                  collection.drop();
              },
              ops: [
                  { op: "command",
                    ns : "#B_DB",
                    command : { findAndModify : "#B_COLL",
                                upsert : true,
                                query : { _id : { "#RAND_INT" : [ 0, 999999999 ] } },
                                update : { _id : { "#RAND_INT" : [ 0, 999999999 ] } } } }
              ] } );

function genDistinctTest( name, index, query ) {
    var doc = { name : name };
    if ( index ) {
        doc.pre = function( collection ) {
            collection.drop();
            for ( var i = 0; i < 1000; i++ ) {
                collection.insert( { x : 1 } );
                collection.insert( { x : 2 } );
                collection.insert( { x : 3 } );
            }
            collection.ensureIndex( { x : 1 } );
        };
    }
    else {
        doc.pre = function( collection ) {
            collection.drop();
            for ( var i = 0; i < 1000; i++ ) {
                collection.insert( { x : 1 } );
                collection.insert( { x : 2 } );
                collection.insert( { x : 3 } );
            }
            collection.getDB().getLastError();
        };
    }

    var op = { op: "command",
               ns : "#B_DB",
               command : { distinct : "#B_COLL",
                           key : "x" } };
    if ( query )
        op.command.query = { x : 1 };

    doc.ops = [ op ];

    return doc;
}

tests.push( genDistinctTest( "Commands.DistinctWithIndex", true, false ) );
tests.push( genDistinctTest( "Commands.DistinctWithIndexAndQuery", true, true ) );
tests.push( genDistinctTest( "Commands.DistinctWithoutIndex", false, false ) );
tests.push( genDistinctTest( "Commands.DistinctWithoutIndexAndQuery", false, true ) );
