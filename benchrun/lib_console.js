if ( typeof(tests) != "object" ) {
    throw "no tests!";
}

function runTests() {

    var threadNumbers = [ 1, 2, 6, 12 ];

    print( "Number of Tests: " + tests.length );
    var guess = 1.1 * threadNumbers.length * 5 * tests.length;
    print( "Approx Time (minutes): " + Math.ceil( guess / 60 ) );

    for ( var i = 0; i < tests.length; i++ ) {
        var test = tests[i];

        runTest( db, test, threadNumbers );
    }
}

runTests();

