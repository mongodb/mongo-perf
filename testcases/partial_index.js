if ( typeof(tests) != "object" ) {
    tests = [];
}

var setupTest = function (collection) {
    collection.drop();
    for ( var i = 0; i < 4800; i++ ) {
        collection.insert( { x : i, a : i } );
    }
    collection.getDB().getLastError();
 
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

tests.push( { name : "Queries.PartialIndex.v1.FilteredRange",
              tags: ['partial_index','query','daily','weekly','monthly'],
              pre: function( collection ) {
                  setupTestFiltered(collection);
              },

              ops : [
                  { op: "find", query:  { x : {"#RAND_INT" : [ 0, 500 ]}, a : {$lt : 500  } } }
              ] } );

tests.push( { name : "Queries.PartialIndex.v1.NonFilteredRange",
              tags: ['partial_index','query','daily','weekly','monthly'],
              pre: function( collection ) {
                  setupTestFiltered(collection);
              },

              ops : [
                  { op: "find", query:  { x : {"#RAND_INT" : [ 500, 4800 ]}, a : {$gte : 500  } } }
              ] } );

tests.push( { name : "Queries.PartialIndex.v1.FullRange",
              tags: ['partial_index','query','daily','weekly','monthly'],
              pre: function( collection ) {
                  setupTestFiltered(collection);
              },

              ops : [
                  { op: "find", query:  { x : {"#RAND_INT" : [ 0, 4800 ]}, a : {$lt : 4800  } } }
              ] } );


tests.push( { name : "Queries.PartialIndex.v1.FilteredRange.Inequality",
              tags: ['partial_index','query','daily','weekly','monthly'],
              pre: function( collection ) {
                  setupTestFiltered(collection);
              },

              ops : [
                  { op: "findOne", query:  { x : {$lte : {"#RAND_INT" : [ 0, 500 ]}}, a : {$lt : 500  } } }
              ] } );

tests.push( { name : "Queries.PartialIndex.v1.NonFilteredRange.Inequality",
              tags: ['partial_index','query','daily','weekly','monthly'],
              pre: function( collection ) {
                  setupTestFiltered(collection);
              },

              ops : [
                  { op: "findOne", query:  { x : {$lte : {"#RAND_INT" : [ 500, 4800 ]}}, a : {$gte : 500  } } }
              ] } );

tests.push( { name : "Queries.PartialIndex.v1.FullRange.Inequality",
              tags: ['partial_index','query','daily','weekly','monthly'],
              pre: function( collection ) {
                  setupTestFiltered(collection);
              },

              ops : [
                  { op: "findOne", query:  { x : {$lte : { "#RAND_INT" : [ 0 , 4800 ]}}, a : {$lt : 4800  } }  }
              ] } );

// Compare to the selective. How much does the selective help?
tests.push( { name : "Queries.PartialIndex.AllInFilter.v1.FilteredRange",
              tags: ['partial_index','query','weekly','monthly'],
              pre: function( collection ) {
                  setupTestFilteredNonSelective(collection);
              },

              ops : [
                  { op: "find", query:  { x : {"#RAND_INT" : [ 0, 500 ]}, a : {$lt : 500  } } }
              ] } );

// Compare to the regular index case
tests.push( { name : "Queries.PartialIndex.AllInFilter.v1.FullRange",
              tags: ['partial_index','query','weekly','monthly'],
              pre: function( collection ) {
                  setupTestFilteredNonSelective(collection);
              },

              ops : [
                  { op: "find", query:  { x : { "#RAND_INT" : [ 0 , 4800 ] }, a : {$lt : 4800  } } }
              ] } );

// compare to the filtered selective case. Any difference?
tests.push( { name : "Queries.PartialIndex.AllInFilter.v1.FilteredRange.Inequality",
              tags: ['partial_index','query','weekly','monthly'],
              pre: function( collection ) {
                  setupTestFilteredNonSelective(collection);
              },

              ops : [
                  { op: "findOne", query:  { x : {$lte : {"#RAND_INT" : [ 0, 500 ]}}, a : {$lt : 500  } } }
              ] } );

// compare to regular index
tests.push( { name : "Queries.PartialIndex.AllInFilter.v1.FullRange.Inequality",
              tags: ['partial_index','query','weekly','monthly'],
              pre: function( collection ) {
                  setupTestFilteredNonSelective(collection);
              },

              ops : [
                  { op: "findOne", query:  { x : {$lte : { "#RAND_INT" : [ 0 , 4800 ] }}, a : {$lt : 4800  } } } 
              ] } );

