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
              tags: ['insert','regression'],
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
              tags: ['insert','regression'],
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
              tags: ['insert','regression'],
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
              tags: ['insert','core'],
              pre: function( collection ) { collection.drop(); },
              ops: [
                  { op:  "insert",
                    doc: { _id: { "#OID": 1 } } }
              ] } );


// variables for vector insert test
// 100 documents per insert
var batchSize = 100;
var docs = []
for (var i = 0; i < batchSize; i++) {
    docs.push( {x: 1} )
}

/*
 * Setup:
 * Test: Insert a vector of documents. Each document has an integer field
 * Notes: Generates the _id field on the client
 *        
 */
tests.push( { name: "Insert.IntVector",
              tags: ['insert','regression'],
              pre: function( collection ) { collection.drop(); },
              ops: [
                  { op:  "insert",
                    doc: docs }
              ] } );


// Variables for vector insert of large documents
// 100 documents per batch
batchSize = 100;
// 1024 byte string in the document 
var docSize = 1024;
function makeDocument(docSize) {
        var doc = { "fieldName":"" };
        while(Object.bsonsize(doc) < docSize) {
            doc.fieldName += "x";
        }
    return doc;
}

doc = makeDocument(docSize);
var docs = []
for (var i = 0; i < batchSize; i++) {
    docs.push(doc)
}
/*
 * Setup:
 * Test: Insert a vector of large documents. Each document contains a long string
 * Notes: Generates the _id field on the client
 *        
 */
tests.push( { name: "Insert.LargeDocVector",
              tags: ['insert','regression'],
              pre: function( collection ) { collection.drop(); },
              ops: [
                  { op:  "insert",
                    doc: docs }
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
              tags: ['insert','indexed','regression'],
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
              tags: ['insert','regression'],
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
              tags: ['insert','regression'],
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
              tags: ['insert','indexed','regression'],
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

/*
 * Setup: Create an empty collection with a simple default collation and index field 'a'.
 *
 * Test: Repeatedly insert an indexed 10 character string.
 */
tests.push( { name: "InsertIndexedStringsSimpleCollation",
              tags: ['insert','indexed','regression','collation'],
              pre: function( collection ) {
                  var testDB = collection.getDB();
                  var collName = collection.getName();
                  collection.drop();
                  testDB.createCollection(collName, { collation: { locale: "simple" } } );
                  collection.ensureIndex( { a: 1 } );
              },
              ops: [
                  { op: "insert", doc: { a: { "#RAND_STRING": [10] } } }
              ] } );

/*
 * Setup: Create an empty collection with a non-simple default collation and index field 'a'. We set
 * several collation options in an attempt to make the collation processing in ICU more expensive.
 *
 * Test: Repeatedly insert an indexed 10 character string.
 *
 * Comparing this test against InsertIndexedStringsSimpleCollation should indicate the overhead
 * associated with generating index keys for an index with a non-simple collation.
 */
tests.push( { name: "InsertIndexedStringsNonSimpleCollation",
              tags: ['insert','indexed','regression','collation'],
              pre: function( collection ) {
                  var testDB = collection.getDB();
                  var collName = collection.getName();
                  collection.drop();
                  var myCollation = {
                      locale : "en",
                      strength : 5,
                      backwards : true,
                      normalization : true,
                  };
                  testDB.createCollection(collName, { collation: myCollation } );
                  collection.ensureIndex( { a: 1 } );
              },
              ops: [
                  { op: "insert", doc: { a: { "#RAND_STRING": [10] } } }
              ] } );
