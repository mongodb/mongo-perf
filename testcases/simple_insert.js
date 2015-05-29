if ( typeof(tests) != "object" ) {
    tests = [];
}

/*
 * Setup:
 * Test: Insert empty documents into database
 * Notes: Let mongod create missing _id field
 *        The generated Object ID for _id will be monotically increasing, and
 *            the index on _id will continually add entries larger than
 *            any current entry.
 */
tests.push( { name: "Insert.Empty",
              tags: ['insert','sanity','daily','weekly','monthly'],
              pre: function( collection ) { collection.drop(); },
              ops: [
                  { op:  "insert",
                    doc: {} }
              ] } );


/*
 * Setup: Create capped collection of 32 KB
 * Test: Insert empty documents into capped collection
 * Notes: Empty document with _id : ObjectID is 48 bytes from measurement.
 *        Need at least 683 inserts to roll the capped collection.
 */
tests.push( { name: "Insert.EmptyCapped",
              tags: ['insert','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  collection.runCommand( "create", { capped : true,
                                                     size : 32 * 1024 } );
              },
              ops: [
                  { op:  "insert",
                    doc: {} }
              ] } );

/*
 * Setup: Create capped collection of 32 KB
 * Test: Insert empty documents into capped collection using sequential int for
 *       _id field.
 * Notes: Empty document with _id : NumberInt is 16 bytes from measurement. Need
 *            at least 2048 inserts to roll the capped collection.
 */
tests.push( { name: "Insert.EmptyCapped.SeqIntID",
              tags: ['insert','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  collection.runCommand( "create", { capped : true,
                                                     size : 32 * 1024 } );
              },
              ops: [
                  { op:  "insert",
                    doc: { _id: { "#SEQ_INT":
                                  { seq_id: 0, start: 0, step: 1, unique: true }
                                }
                         }
                  }
              ] } );

/*
 * Setup:
 * Test: Insert document only with object ID.
 * Notes: Generates the _id field on the client
 *        
 */
tests.push( { name: "Insert.JustID",
              tags: ['insert','sanity','daily','weekly','monthly', 'core-insert'],
              pre: function( collection ) { collection.drop(); },
              ops: [
                  { op:  "insert",
                    doc: { _id: { "#OID": 1 } } }
              ] } );

/*
 * Setup: Create index on field 'a'
 * Test: Insert empty documents into collection using sequential int for _id
 *            field and no other fields (no 'a' field). 
 * Notes: The inserted documents do not have a field 'a'. Therefore,
 *           each insert adds an entry to the "null" entry in the index on 'a'
 *        The integers are sequential per thread. In multi-threaded
 *            tests each thread will insert sequential ints in different
 *            ranges, and will exercise different ranges of the _id index.
*/
tests.push( { name: "Insert.SeqIntID.Indexed",
              tags: ['insert','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  collection.ensureIndex({a: 1});
              },
              ops: [
                  { op:  "insert",
                    doc:
                        { _id: { "#SEQ_INT":
                            { seq_id: 0, start: 0, step: 1, unique: true } } } }
              ] } );

/*
 * Setup:
 * Test: Upsert empty documents into collection using sequential int for _id
 *           field. All operations result in an insert.
 * Notes: The integers are sequential per thread. In multi-threaded
 *            tests each thread will insert sequential ints in different
 *            ranges, and will exercise different ranges of the _id index.
*/
tests.push( { name: "Insert.IntIDUpsert",
              tags: ['insert','sanity','daily','weekly','monthly'],
              pre: function( collection ) { collection.drop(); },
              ops: [
                  { op:  "update",
                    upsert : true,
                    query: { _id: { "#SEQ_INT":
                                { seq_id: 0, start: 0, step: 1, unique: true}}},
                    update: { }
                  }
              ] } );

/*
 * Setup:
 * Test: Insert documents { _id : OID, x : NumberInt} into collection using
 *           sequential int for 'x' field.
 * Notes: Let mongod create missing _id field
*/
tests.push( { name: "Insert.JustNum",
              tags: ['insert','sanity','daily','weekly','monthly'],
              pre: function( collection ) { collection.drop(); },
              ops: [
                  { op:  "insert",
                    doc:
                        { x: { "#SEQ_INT":
                            { seq_id: 0, start: 0, step: 1, unique: true } } } }
              ] } );

/*
 * Setup: Create index on field 'x'
 * Test: Insert documents { _id : OID, x : NumberInt} into collection using
 *           sequential int for x field.
 * Notes: Let mongod create missing _id field
 *        Insert a single document per operation, but with two indexes (_id & x)
 *        The integers are sequential per thread. In multi-threaded
 *            tests each thread will insert sequential ints in different
 *            ranges, and will exercise different ranges of the 'x' index.
*/
tests.push( { name: "Insert.JustNumIndexed",
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
