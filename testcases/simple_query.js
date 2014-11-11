if ( typeof(tests) != "object" ) {
    tests = [];
}

tests.push( { name : "Queries.v1.Empty",
              tags: ['query','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 4800; i++ ) {
                      collection.insert( {} );
                  }
                  collection.getDB().getLastError();
              },
              ops : [
                  { op: "find", query: {} }
              ] } );

tests.push( { name : "Queries.v1.NoMatch",
              tags: ['query','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 4800; i++ ) {
                      collection.insert( {} );
                  }
                  collection.getDB().getLastError();
              },
              ops : [
                  { op: "find", query: { nope : 5 } }
              ] } );


tests.push( { name: "Queries.v1.IntIdFindOne",
              tags: ['query','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 4800; i++ ) {
                      collection.insert( { _id : i } );
                  }
                  collection.getDB().getLastError();
              },
              ops: [
                  { op: "findOne", query: { _id : {"#RAND_INT_PLUS_THREAD": [0,100]} } }
              ] } );

tests.push( { name: "Queries.v1.IntNonIdFindOne",
              tags: ['query','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 4800; i++ ) {
                      collection.insert( { x : i } );
                  }
                  collection.ensureIndex( { x : 1 } );
              },
              ops: [
                  { op: "findOne", query: { x : {"#RAND_INT_PLUS_THREAD": [0,100]} } }
              ] } );


tests.push( { name : "Queries.v1.IntIDRange",
              tags: ['query','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 4800; i++ ) {
                      collection.insert( { _id : i } );
                  }
                  collection.getDB().getLastError();
              },
              ops : [
                  { op: "find", query: { _id : { $gt : 50, $lt : 100 } } }
              ] } );

tests.push( { name : "Queries.v1.IntNonIDRange",
             tags: ['query','sanity','daily','weekly','monthly'],
             pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 4800; i++ ) {
                      collection.insert( { x : i } );
                  }
                  collection.getDB().getLastError();
                  collection.ensureIndex( { x : 1 } );
              },
              ops : [
                  { op: "find", query: { x : { $gt : 50, $lt : 100 } } }
              ] } );

tests.push( { name: "Queries.v1.RegexPrefixFindOne",
              tags: ['query','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 4800; i++ ) {
                      collection.insert( { x : i.toString() } );
                  }
                  collection.getDB().getLastError();
                  collection.ensureIndex( { x : 1 } );
              },
              ops : [
                  { op: "find", query: { x: /^2400/ } }
              ] } );

tests.push( { name: "Queries.v1.TwoInts",
              tags: ['query','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 4800; i++ ) {
                      collection.insert( { x: i, y: 2*i } );
                  }
                  collection.getDB().getLastError();
                  collection.ensureIndex({x: 1});
                  collection.ensureIndex({y: 1});
              },
              ops : [
                  { op: "find",
                    query: { x: { "#SEQ_INT": { seq_id: 0, start: 0, step: 1, mod: 4800 } },
                             y: { "#SEQ_INT": { seq_id: 1, start: 0, step: 2, mod: 9600 } } }
                  }
              ] } );

// PROJECTION TESTS

tests.push( { name: "Queries.v1.IntNonIdFindOneProjectionCovered",
              tags: ['query','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 4800; i++ ) {
                      collection.insert( { x : i } );
                  }
                  collection.getDB().getLastError();
                  collection.ensureIndex( { x : 1 } );
              },
              ops: [
                  { op: "find",
                    query: { x : {"#RAND_INT_PLUS_THREAD": [0,100]} },
                    limit: 1,
                    filter: { x : 1, _id : 0 } }
              ] } );


tests.push( { name: "Queries.v1.IntNonIdFindOneProjection",
              tags: ['query','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 4800; i++ ) {
                      collection.insert( { x : i } );
                  }
                  collection.getDB().getLastError();
                  collection.ensureIndex( { x : 1 } );
              },
              ops: [
                  { op: "find",
                    query: { x : {"#RAND_INT_PLUS_THREAD": [0,100]} },
                    limit: 1,
                    filter: { x : 1 } }
              ] } );


tests.push( { name: "Queries.v1.IntNonIdFindProjectionCovered",
              tags: ['query','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 4800; i++ ) {
                      collection.insert( { x : i } );
                  }
                  collection.getDB().getLastError();
                  collection.ensureIndex( { x : 1 } );
              },
              ops: [
                  { op: "find",
                    query: { x: { $gte : 0 } },
                    filter: { x : 1, _id : 0 } }
              ] } );


tests.push( { name: "Queries.v1.FindProjection",
              tags: ['query','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 4800; i++ ) {
                      collection.insert( { x : i } );
                  }
                  collection.getDB().getLastError();
                  collection.ensureIndex( { x : 1 } );
              },
              ops: [
                  { op: "find",
                    query: { },
                    filter: { x : 1 } }
              ] } );


tests.push( { name: "Queries.v1.FindWideDocProjection",
              tags: ['query','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 4800; i++ ) {
                      collection.insert( { a : i, 
                          b: i, c: i, d: i, e: i,
                          f: i, g: i, h: i, i: i,
                          j: i, k: i, l: i, m: i,
                          n: i, o: i, p: i, q: i,
                          r: i, s: i, t: i, u: i,
                          v: i, w: i, x: i, y: i, z: 1
                      } );
                  }
                  collection.getDB().getLastError();
              },
              ops: [
                  { op: "find",
                    query: { },
                    filter: { x : 1 } }
              ] } );


tests.push( { name: "Queries.v1.FindProjectionThreeFieldsCovered",
              tags: ['query','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 4800; i++ ) {
                      collection.insert( { x : i, y: i, z: i } );
                  }
                  collection.getDB().getLastError();
                  collection.ensureIndex( { x : 1, y : 1, z : 1 } );
              },
              ops: [
                  { op: "find",
                    query: { x: {"#RAND_INT_PLUS_THREAD": [0,100]} },
                    filter: { x : 1, y : 1, z : 1, _id : 0 } }
              ] } );


tests.push( { name: "Queries.v1.FindProjectionThreeFields",
              tags: ['query','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 4800; i++ ) {
                      collection.insert( { x : i, y: i, z: i } );
                  }
                  collection.getDB().getLastError();
              },
              ops: [
                  { op: "find",
                    query: { },
                    filter: { x : 1, y : 1, z : 1, _id : 0 } }
              ] } );


tests.push( { name: "Queries.v1.FindProjectionDottedField",
              tags: ['query','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 4800; i++ ) {
                      collection.insert( { x : { y: i } } );
                  }
                  collection.getDB().getLastError();
              },
              ops: [
                  { op: "find",
                    query: { },
                    filter: { 'x.y' : 1, _id : 0 } }
              ] } );

tests.push( { name: "Queries.v1.FindProjectionDottedField.Indexed",
              tags: ['query','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 4800; i++ ) {
                      collection.insert( { x : { y: i } } );
                  }
                  collection.getDB().getLastError();
                  collection.ensureIndex( { "x.y" : 1 } );
              },
              ops: [
                  { op: "find",
                    query: { 'x.y' : {"#RAND_INT_PLUS_THREAD": [0,100]}},
                    filter: { 'x.y' : 1, _id : 0 } }
              ] } );