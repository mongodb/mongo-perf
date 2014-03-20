
To run in a console:

    mongo <tests> lib_core.js lib_console.js
    mongo simple_query.js lib_core.js lib_console.js
    mongo simple_*.js mixed_*.js lib_core.js lib_console.js


To report into the same mongod you're testing against:

    mongo --eval "label='<your label>'" <tests> lib_core.js lib_report.js
    mongo --eval "label='test1'" simple_query.js lib_core.js lib_report.js
    mongo --eval "label='test1'" simple_*.js mixed_*.js lib_core.js lib_report.js

To experiment with a single test

    mongo <test file> lib_core.js --shell
    > runTest( db, findTest( "<fragment>" ) , [ 2 , 6 ] )

    mongo simple_insert.js lib_core.js --shell
    > runTest( db, findTest( "EmptyCapped" ) , [ 2 , 6 ] )


