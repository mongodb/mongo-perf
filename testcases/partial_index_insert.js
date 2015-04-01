if ( typeof(tests) != "object" ) {
    tests = [];
}

var setupTest = function (collection) {
    collection.drop();
}

var setupTestFiltered = function (collection) {
    setupTest(collection);
    collection.createIndex( { x : 1 }, { filter : { a : { $lt : 500 } } } );
}

var setupTestFilteredNonSelective = function (collection) {
    setupTest(collection);
    collection.createIndex( { x : 1 }, { filter : { a : { $lt : 4800 } } } );
}

var setupTestIndexed = function (collection) {
    setupTest(collection);
    collection.createIndex( { x : 1 });
}

tests.push( { name : "Inserts.PartialIndex.v1.FilteredRange",
              tags: ['partial_index','insert','daily','weekly','monthly'],
              pre: function( collection ) {
                  setupTestFiltered(collection);
              },

              ops : [
                  { op: "insert", doc:  { x : {"#RAND_INT" : [ 0, 500 ]}, a : {"#RAND_INT" : [ 0, 500 ]} } }
              ] } );

tests.push( { name : "Inserts.PartialIndex.v1.NonFilteredRange",
              tags: ['partial_index','insert','daily','weekly','monthly'],
              pre: function( collection ) {
                  setupTestFiltered(collection);
              },

              ops : [
                  { op: "insert", doc:  { x : {"#RAND_INT" : [ 500, 4800 ]}, a : {"#RAND_INT" : [ 500, 4800 ]} } }
              ] } );

tests.push( { name : "Inserts.PartialIndex.v1.FullRange",
              tags: ['partial_index','insert','daily','weekly','monthly'],
              pre: function( collection ) {
                  setupTestFiltered(collection);
              },

              ops : [
                  { op: "insert", doc:  { x : { "#RAND_INT" : [ 0 , 4800 ] }, a : { "#RAND_INT" : [ 0 , 4800 ] } } }
              ] } );


