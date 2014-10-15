if ( typeof(tests) != "object" ) {
    tests = [];
}

tests.push( { name: "Commands.isMaster",
              tags: ['isMaster','commands','sanity','daily','weekly','monthly'],
              ops: [
                  { op: "command", ns : "#B_DB", command : { "isMaster" : 1 } }
              ] } );

//tests.push( { name: "Commands.buildInfo",
//              ops: [
//                  { op: "command", ns : "#B_DB", command : { "buildInfo" : 1 } }
//              ] } );

//tests.push( { name: "Commands.illegalOp",
//              ops: [
//                  { op: "command", ns : "#B_DB", command : { "notExist" : 1 } }
//              ] } );

//tests.push( { name: "Commands.nop",
//              ops: [
//                  { op: "nop" }
//              ] } );

tests.push( { name: "Commands.CountsFullCollection",
              tags: ['count','commands','sanity','daily','weekly','monthly'],
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
              tags: ['count','commands','sanity','daily','weekly','monthly'],
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


tests.push( { name: "Commands.v2.FindAndModifyInserts",
              tags: ['findAndModify','command','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
              },
              ops: [
                  { op: "let", target: "x", value: {"#RAND_INT_PLUS_THREAD": [0,1000]}},
                  { op: "command",
                    ns : "#B_DB",
                    command : { findAndModify : "#B_COLL",
                                upsert : true,
                                query : { _id : { "#VARIABLE" : "x" } },
                                update : { _id : { "#VARIABLE" : "x" } } } }
              ] } );

function genDistinctTest( name, index, query ) {
    var doc = { name : name,
                tags: ['distinct','command','sanity','daily','weekly','monthly']
              };
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
               tags: ['distinct','command','sanity','daily','weekly','monthly'],
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
