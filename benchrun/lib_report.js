if ( typeof(tests) != "object" ) {
    throw "no tests!";
}

if ( typeof(label) != "string" ) {
    throw "no label";
}

function formateDate( now ) {
    function pad( thing ) {
        thing = "" + thing;
        while ( thing.length < 2 )
            thing = "0" + thing;
        return thing;
    }
    var s = 1900 + now.getYear() + "-";
    s = s + pad( now.getMonth() + 1 ) + "-";
    s = s + pad( now.getDate() );
    return s;
}

function runTests() {

    var resultsCollection = db.getSisterDB( "bench_results" ).raw;
    resultsCollection.ensureIndex( { label : 1 } );

    resultsCollection.remove( { label : label } );

    var myId = new ObjectId();
    var now = new Date();

    var bi = db.runCommand( "buildInfo" );
    resultsCollection.insert( { _id : myId,
                                commit : bi.gitVersion,
                                label: label,
                                platform : bi.sysInfo.split( " " )[0],
                                run_date: formateDate( now ),
                                run_time: now,
                                version: bi.version } );

    var threadNumbers = [ 1, 2, 4, 8, 16 ];

    print( "Number of Tests: " + tests.length );
    var guess = 1.1 * threadNumbers.length * 5 * tests.length;
    print( "Approx Time (minutes): " + Math.ceil( guess / 60 ) );

    for ( var i = 0; i < tests.length; i++ ) {
        var test = tests[i];

        var allResults = runTest( db, test, threadNumbers );

        resultsCollection.update( { _id : myId },
                                  { $push : { "singledb" : { name : test.name,
                                                             results : allResults } } } );

    }

    var actual = (new Date()).getTime() - now.getTime();
    actual /= 1000;
    print( "Time Taken (minutes): " + ( actual / 60 ) );
}

runTests();

