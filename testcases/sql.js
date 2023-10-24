if (typeof (tests) !== "object") {
    tests = [];
}

(function() {
"use strict";

Random.setRandomSeed(258);

// TODO SMQL: These queries need to predict the name of the collection chosen elsewhere in the test
// code. Can we improve this?
addSqlTestCase({
    name: "Empty",
    // This generates documents to be inserted into the collection, resulting in 100 documents
    // with only an _id field.
    nDocs: 100,
    docs: function(i) {
        return {};
    },
    op: {op: "sql", sqlQuery: "select * from Queries_SQL_Empty0", expected: 100},
});
}());
