if ( typeof(tests) != "object" ) {
    tests = [];
}


/*
 * Setup: Create an index on field x
 * Test: Insert documents with default OID and field x with
 *       sequentially increasing integers. Each thread will insert
 *       into a distinct range of integers. Single threaded this will
 *       always add to the max key in the index.
 */
tests.push( { name: "Insert.SingleIndex.Seq",
              tags: ['insert','indexed','regression'],
              pre: function( collection ) {
                  collection.drop();
                  collection.createIndex({x: 1});
              },
              ops: [
                  { op:  "insert",
                    doc:
                        { x: { "#SEQ_INT":
                            { seq_id: 0, start: 0, step: 1, unique: true } } } }
              ] } );
              
/*
 * Setup: Create an index on field x
 * Test: Insert documents with default OID and field x with random
 *       integer values. Each thread will insert into a distinct range
 *       of integers.
 */
tests.push( { name: "Insert.SingleIndex.Uncontested.Rnd",
              tags: ['insert','indexed','regression'],
              pre: function( collection ) {
                  collection.drop();
                  collection.createIndex({x: 1});
              },
              ops: [
                  { op:  "insert",
                    doc:
                        { x: { "#RAND_INT_PLUS_THREAD": [0,10000000] } }
                  }
              ] } );

/*
 * Setup: Create an index on field x
 * Test: Insert documents with default OID and field x with random
 *       integer values. All threads insert into the same region of
 *       integers possibly leading to contention.
 */
tests.push( { name: "Insert.SingleIndex.Contested.Rnd",
              tags: ['insert','indexed','regression'],
              pre: function( collection ) {
                  collection.drop();
                  collection.createIndex({x: 1});
              },
              ops: [
                  { op:  "insert",
                    doc:
                        { x: { "#RAND_INT": [0,10000000] } }
                  }
              ] } );

/*
 * Setup: Create indexes on fields x,y,z
 * Test: Insert documents with default OID and fields x,y,z with
 *       different random integer values. Each thread will insert into
 *       a distinct range of integers.
 */
tests.push( { name: "Insert.MultiIndex.Uncontested.Rnd",
              tags: ['insert','indexed','regression'],
              pre: function( collection ) {
                  collection.drop();
                  collection.createIndex({x: 1});
                  collection.createIndex({y: 1});
                  collection.createIndex({z: 1});
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

/*
 * Setup: Create indexes on fields x,y,z
 * Test: Insert documents with default OID and fields x,y,z with
 *       different random integer values.  All threads insert into the
 *       same region of integers.
 */
tests.push( { name: "Insert.MultiIndex.Contested.Rnd",
              tags: ['insert','indexed','regression'],
              pre: function( collection ) {
                  collection.drop();
                  collection.createIndex({x: 1});
                  collection.createIndex({y: 1});
                  collection.createIndex({z: 1});
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

/*
 * Setup: Create an index on field x
 * Test: Insert documents with default OID and field x with an array
 *       of random integer values. Each value needs to be
 *       indexed. Each thread uses a unique range of random numbers.
 */
tests.push( { name: "Insert.MultiKeyIndex.Uncontested.Rnd",
              tags: ['insert','indexed','regression'],
              pre: function( collection ) {
                  collection.drop();
                  collection.createIndex({x: 1});
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

/*
 * Setup: Create an index on field x
 * Test: Insert documents with default OID and field x with an array
 *       of random integer values. Each value needs to be indexed. All
 *       threads use the same range of random numbers, and may have
 *       contention on the index keys.  
 */
tests.push( { name: "Insert.MultiKeyIndex.Contested.Rnd",
              tags: ['insert','indexed','regression'],
              pre: function( collection ) {
                  collection.drop();
                  collection.createIndex({x: 1});
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

/**
 * Setup: Create an index field x
 * Test: Insert documents with big values (string with 20,000 characters) on
 * field x. Each value needs to be indexed.
 */
tests.push( { name: "Insert.BigKeyIndex",
              tags: ['insert', 'indexed', 'regression'],
              pre: function(collection) {
                  collection.drop();
                  collection.createIndex({x: 1});
              },
              ops: [
                  { op: "insert",
                    doc: { x: { "#RAND_STRING": [20000] } }
                  }
              ] } );
