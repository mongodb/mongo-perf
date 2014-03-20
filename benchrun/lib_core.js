
function prepOp( collection, op ) {

    function fixString( str ) {
        if ( str == "#B_COLL" ) {
            return collection.getName();
        }
        if ( str == "#B_NS" ) {
            return collection.getFullName();
        }
        if ( str == "#B_DB" ) {
            return collection.getDB().getName();
        }
        throw "unknown expansion " + str;
    }

    function recurse( doc ) {
        for ( var key in doc ) {
            var val = doc[key];
            if ( typeof(val) == "string" &&
                 val.indexOf( "#B_" ) == 0 ) {
                doc[key] = fixString( val );
            }
            else if ( typeof(val) == "object" ) {
                recurse( val );
            }
        }
    }
    recurse( op );

    if ( !op.ns ) {
        if ( op.command )
            op.ns = collection.getDB().getName();
        else
            op.ns = collection.getFullName();
    }

    return op;
}

function runTest( db, test, threadNumbers ) {
    print( test.name );

    var collection = db.foo;
    collection.drop();
    test.ops.forEach( function(z) {
        z = prepOp( collection, z );
    } );

    var allResults = {};

    threadNumbers.forEach( function( threads ) {

        if ( "pre" in test ) {
            test.pre( collection );
        }

        var benchArgs = { ops : test.ops,
                          seconds : 5,
                          host: db.getMongo().host,
                          parallel : threads };

        var result = benchRun( benchArgs );
        var total =
            result["insert"] +
            result["query"] +
            result["update"] +
            result["delete"] +
            result["getmore"] +
            result["command"];

        allResults[threads] = { ops_per_sec : total };

        print( "\t" + threads + "\t" + total );

        if ( "post" in test ) {
            test.post( collection );
        }
    } );

    return allResults;
}

function findTest( fragment ) {
    for ( var i = 0; i < tests.length; i++ ) {
        if ( tests[i].name.indexOf( fragment ) >= 0 )
            return tests[i];
    }
    throw "can't find test with fragment [" + fragment + "]";
}
