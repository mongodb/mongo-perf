if ( typeof(tests) != "object" ) {
    tests = [];
}

tests.push( { name: "Insert.v0.SingleIndex.Seq",
              tags: ['insert','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  collection.ensureIndex({x: 1});
              },
              ops: [
                  { op:  "insert",
                    doc:
                        { x: { "#SEQ_INT":
                            { seq_id: 0, start: 0, step: 1, unique: true } } } }
              ] } );
              
tests.push( { name: "Insert.v0.SingleIndex.Uncontested.Rnd",
              tags: ['insert','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  collection.ensureIndex({x: 1});
              },
              ops: [
                  { op:  "insert",
                    doc:
                        { x: { "#RAND_INT_PLUS_THREAD": [0,10000000] } }
                  }
              ] } );

tests.push( { name: "Insert.v0.SingleIndex.Contested.Rnd",
              tags: ['insert','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  collection.ensureIndex({x: 1});
              },
              ops: [
                  { op:  "insert",
                    doc:
                        { x: { "#RAND_INT": [0,10000000] } }
                  }
              ] } );

tests.push( { name: "Insert.v0.MultiIndex.Uncontested.Rnd",
              tags: ['insert','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  collection.ensureIndex({x: 1});
                  collection.ensureIndex({y: 1});
                  collection.ensureIndex({z: 1});
              },
              ops: [
                  { op:  "insert",
                    doc:
                        { x: { "#RAND_INT_PLUS_THREAD": [0,10000000] },
                          y: { "#RAND_INT_PLUS_THREAD": [0,10000000] },
                          z: { "#RAND_INT_PLUS_THREAD": [0,10000000] },
                        }
                  }
              ] } );

tests.push( { name: "Insert.v0.MultiIndex.Contested.Rnd",
              tags: ['insert','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  collection.ensureIndex({x: 1});
                  collection.ensureIndex({y: 1});
                  collection.ensureIndex({z: 1});
              },
              ops: [
                  { op:  "insert",
                    doc:
                        { x: { "#RAND_INT": [0,10000000] },
                          y: { "#RAND_INT": [0,10000000] },
                          z: { "#RAND_INT": [0,10000000] },
                        }
                  }
              ] } );

tests.push( { name: "Insert.v0.MultiKeyIndex.Uncontested.Rnd",
              tags: ['insert','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  collection.ensureIndex({x: 1});
              },
              ops: [
                  { op:  "insert",
                    doc:
                        { x: [ { "#RAND_INT_PLUS_THREAD": [0,10000000] },
                               { "#RAND_INT_PLUS_THREAD": [0,10000000] }, 
                               { "#RAND_INT_PLUS_THREAD": [0,10000000] }, 
                               { "#RAND_INT_PLUS_THREAD": [0,10000000] }, 
                             ] ,
                        }
                  }
              ] } );

tests.push( { name: "Insert.v0.MultiKeyIndex.Contested.Rnd",
              tags: ['insert','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  collection.ensureIndex({x: 1});
              },
              ops: [
                  { op:  "insert",
                    doc:
                        { x: [ { "#RAND_INT": [0,10000000] },
                               { "#RAND_INT": [0,10000000] }, 
                               { "#RAND_INT": [0,10000000] }, 
                               { "#RAND_INT": [0,10000000] }, 
                             ] ,
                        }
                  }
              ] } );
