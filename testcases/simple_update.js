if ( typeof(tests) != "object" ) {
    tests = [];
}

/**
 * Setup: Populate a collection with an integer field X set to 0
 *        and integer _id field
 * Test:  Each thread works in a range of 100 documents; randomly selects a 
 *        document based on the integer _id field and increments X
 */
tests.push( { name: "Update.IncNoIndex",
              tags: ['update','regression'],
              pre: function( collection ) {
                  collection.drop();
                  var docs = [];
                  for ( var i = 0; i < 4800; i++ ) {
                      docs.push( { _id : i , x : 0 } );
                  }
                  collection.insert(docs);
              },
              ops: [
                  { op:  "update",
                    query: { _id : { "#RAND_INT_PLUS_THREAD" : [ 0, 100 ] } },
                    update: { $inc : { x : 1 } } },
              ] } );

/**
 * Setup: Populate a collection with an integer field X set to 0
 *        and integer _id field. Create index on X
 * Test:  Each thread works in a range of 100 documents; randomly selects a 
 *        document using _id and increments X; there will be contention on
 *        updating the index key  
 */
tests.push( { name: "Update.IncWithIndex",
              tags: ['update','core','indexed'],
              pre: function( collection ) {
                  collection.drop();
                  var docs = [];
                  for ( var i = 0; i < 4800; i++ ) {
                      docs.push( { _id : i , x : 0 } );
                  }
                  collection.insert(docs);
                  collection.createIndex( { x : 1 } );
              },
              ops: [
                  { op:  "update",
                    query: { _id : { "#RAND_INT_PLUS_THREAD" : [ 0, 100 ] } },
                    update: { $inc : { x : 1 } } },
              ] } );

/**
 * Setup: Starts with an empty collection
 * Test:  Each thread works in a range of 100 documents; randomly selects a 
 *        document using _id and upserts(increment) X
 */
tests.push( { name: "Update.IncNoIndexUpsert",
              tags: ['update','core'],
              pre: function( collection ) {
                  collection.drop();
              },
              ops: [
                  { op:  "update",
                    upsert : true,
                    query: { _id : { "#RAND_INT_PLUS_THREAD" : [ 0, 100 ] } },
                    update: { $inc : { x : 1 } } },
              ] } );

/**
 * Setup: Starts with an empty collection; creates index on integer field X
 * Test:  Each thread works in a range of 100 documents; randomly selects a 
 *        document using _id and upserts(increment) X
 */
tests.push( { name: "Update.IncWithIndexUpsert",
              tags: ['update','core','indexed'],
              pre: function( collection ) {
                  collection.drop();
                  collection.createIndex( { x : 1 } );
              },
              ops: [
                  { op:  "update",
                    upsert : true,
                    query: { _id : { "#RAND_INT_PLUS_THREAD" : [ 0, 100 ] } },
                    update: { $inc : { x : 1 } } },
              ] } );

var shortFieldNames =
  ["aa", "ba", "ca", "da", "ea", "fa", "ga", "ha", "ia", "ja",
   "ka", "la", "ma", "na", "oa", "pa", "qa", "ra", "sa", "ta",
   "ua", "va", "wa", "xa", "ya", "za", "ab", "bb", "cb", "db",
   "ri", "si", "ti", "ui", "vi", "wi", "xi", "yi", "zi", "aj",
   "xm", "ym", "zm", "an", "bn", "cn", "dn", "en", "fn", "gn"];

/**
 * Setup: Populate the collection with 100 documents, each has 20 integer
 *        fields with a two character field name and an integer _id field
 * Test:  All threads work on the same 100 documents. Each thread progresses
 *        sequentially through the collection by _id field, and increments 
 *        the same 5 of the 20 integer fields in the document. 
 */
tests.push( { name: "Update.IncFewSmallDoc",
              tags: ['update','core'],
              pre: function( collection ) {
                  collection.drop();

                  var docs = [];
                  for (var i = 0; i < 100; i++) {
                      var toInsert = {_id: i};
                      for (var j = 0; j < 20; j++) {
                          toInsert[shortFieldNames[j]] = 1;
                      }
                      docs.push(toInsert);
                 }
                  collection.insert(docs);
              },
              ops: [
                  { op:  "update",
                    query: { _id : { "#SEQ_INT" :
                                { seq_id: 0, start: 0, step: 1, mod: 100 } } },
                    update: { $inc : { aa : 1,
                                       da : 1,
                                       ha : 1,
                                       ma : 1,
                                       ta : 1 } } }
              ] } );

/**
 * Setup: Populate the collection with 100 documents, each has 50 integer
 *        fields with a two character field name plus an integer _id field
 * Test:  All threads work on the same 100 documents. Each thread progresses
 *        sequentially through the collection by _id field, and increments
 *        the same 5 of the 20 integer fields in the document. 
 */
tests.push( { name: "Update.IncFewLargeDoc",
              tags: ['update','regression'],
              pre: function( collection ) {
                  collection.drop();

                  var docs = [];
                  for (var i = 0; i < 100; i++) {
                      var toInsert = {_id: i};
                      for (var j = 0; j < shortFieldNames.length; j++) {
                          toInsert[shortFieldNames[j]] = 1;
                      }
                      docs.push(toInsert);
                  }
                  collection.insert(docs);
              },
              ops: [
                  { op:  "update",
                    query: { _id : { "#SEQ_INT" :
                                { seq_id: 0, start: 0, step: 1, mod: 100 } } },
                    update: { $inc : { aa : 1,
                                       wa : 1,
                                       xi : 1,
                                       zm : 1,
                                       gn : 1 } } }
              ] } );

var longFieldNames =
    ["kbgcslcybg", "kfexqflvce", "yitljbmriy", "vjhgznppgw", "ksnqrkckgm", "bxzrekmanf",
     "wgjptieoho", "miohmkbzvv", "iyymqfqfte", "nbbxrjspyu", "ftdmqxfvfo", "sqoccqelhp",
     "phbgzfvlvm", "ygvlusahma", "elcgijivrt", "qdwzjpugsr", "dhwgzxijck", "ezbztosivn",
     "gqnevrxtke", "jyzymmhtxc", "iqzleodwcl", "uvcbevobia", "fmsaehzaax", "hvekxgvche",
     "mudggeguxy", "jkpwpdfjjq", "ziujorptwj", "zygklvogup", "rtxpmvlegv", "nfzarcgpmf",
     "nlvbsgscbz", "yanwvoxeov", "ylqapkyfxn", "evlwtlejoe", "xvkejgtiuc", "sjkwfnrwpf",
     "gobpjhjrck", "ltpkggsgpb", "jzaathnsra", "uqiutzbcoa", "zwivxvtmgi", "glaibvnhix",
     "dosiyispnf", "nvtaemdwtp", "vzojziqbkj", "kbtfmcjlgl", "ialgxzuhnq", "djqfxvmycc",
     "ocrpwmeqyb", "tcrrliflby"];

/**
 * Setup: Populate the collection with 100 documents, each has 20 integer
 *        fields with a ten character field name plus an integer _id field
 * Test:  All threads work on the same 100 documents. Each thread progresses
 *        sequentially through the collection by _id field, and increments
 *        the same 5 of the 20 integer fields in the document. 
 */
tests.push( { name: "Update.IncFewSmallDocLongFields",
              tags: ['update','regression'],
              pre: function( collection ) {
                  collection.drop();
                  var docs = [];
                  for (var i = 0; i < 100; i++) {
                      var toInsert = {_id: i};
                      for (var j = 0; j < 20; j++) {
                          toInsert[longFieldNames[j]] = 1;
                      }
                      docs.push(toInsert);
                  }
                  collection.insert(docs);
              },
              ops: [
                  { op:  "update",
                    query: { _id : { "#SEQ_INT" :
                                { seq_id: 0, start: 0, step: 1, mod: 100 } } },
                    update: { $inc : { "kbgcslcybg": 1,
                                       "vjhgznppgw": 1,
                                       "jzaathnsra": 1,
                                       "miohmkbzvv": 1,
                                       "elcgijivrt": 1 } } }
              ] } );

/**
 * Setup: Populate the collection with 100 documents, each has 50 integer
 *        fields with a ten character field name plus an integer _id field
 * Test:  All threads work on the same 100 documents. Each thread progresses 
 *        sequentially through the collection by _id field, and increments 
 *        the same 5 of the 20 integer fields in the document. 
 */
tests.push( { name: "Update.IncFewLargeDocLongFields",
              tags: ['update','regression'],
              pre: function( collection ) {
                  collection.drop();

                  var docs = [];
                  for (var i = 0; i < 100; i++) {
                      var toInsert = {_id: i};
                      for (var j = 0; j < longFieldNames.length; j++) {
                          toInsert[longFieldNames[j]] = 1;
                      }
                      docs.push(toInsert);
                  }
                  collection.insert(docs);
              },
              ops: [
                  { op:  "update",
                    query: { _id : { "#SEQ_INT" :
                                { seq_id: 0, start: 0, step: 1, mod: 100 } } },
                    update: { $inc : { "kbgcslcybg": 1,
                                       "vjhgznppgw": 1,
                                       "jzaathnsra": 1,
                                       "miohmkbzvv": 1,
                                       "elcgijivrt": 1 } } }
              ] } );

/**
 * Setup: Populate the collection with documents that have 512 fields with 
 *        a single character "a" and an integer _id field
 * Test:  Each thread works on a range of 100 documents; randomly selects a
 *        document by _id and set the middle field (256 out of 512) to "a" 
 *        then immediately update the same field to "b"
 */
tests.push( { name: "Update.SingleDocFieldAtOffset",
              tags: ['update','regression'],
              pre: function( collection ) {
                  collection.drop();

                  var kFieldCount = 512;

                  var docs = [];
                  for (var i = 0; i < 4800; i++) {
                      // Build the document and insert several copies.
                      var toInsert = {};
                      for (var j = 0; j < kFieldCount; j++) {
                          toInsert["a_" + j.toString()] = "a";
                      }
                      toInsert["_id"] = i;
                      docs.push(toInsert);
                  }
                  collection.insert(docs);
              },
              ops: [
                  { op: "let", target: "x", value: {"#RAND_INT_PLUS_THREAD": [0,100]}},
                  { op:  "update",
                    multi: false,
                    query: { _id: { "#VARIABLE" : "x" } },
                    update: { $set: { "a_256": "a" } }
                  },
                  { op:  "update",
                    multi: false,
                    query: { _id: { "#VARIABLE" : "x" } },
                    update: { $set: { "a_256": "b" } }
                  }
              ] } );

/**
 * Setup: Populate the collection with 100 documents that have 512 fields with 
 *        a single character "a" 
 * Test:  Each thread does two multi updates on all documents
 *        First change a_256 to "a", then to "aa" 
 *        High contention on the documents as a result from the multi-updates
 */
tests.push( { name: "Update.FieldAtOffset",
              tags: ['update','regression'],
              pre: function( collection ) {
                  collection.drop();

                  var kFieldCount = 512;

                  // Build the document and insert several copies.
                  var toInsert = {};
                  for (var i = 0; i < kFieldCount; i++) {
                      toInsert["a_" + i.toString()] = "a";
                  }

                  var docs = [];
                  for (var i = 0; i < 100; i++) {
                      docs.push(toInsert);
                  }
                  collection.insert(docs);
              },
              ops: [
                  { op:  "update",
                    multi: true,
                    query: {},
                    update: { $set: { "a_256": "a" } }
                  },
                  { op:  "update",
                    multi: true,
                    query: {},
                    update: { $set: { "a_256": "aa" } }
                  }
              ] } );

/**
 * Setup: Populate the collection with documents that have a single field which is a large array
 *        with 200 elements, each of which has three fields.
 * Test:  Each thread works on a range of 100 documents. It randomly selects a document by _id and
 *        sets each of the fields in each of the array elements to a random number.
 */
function buildManyElementUpdate() {
    var update = {$set: {}};
    for (var i = 0; i < 200; i++) {
        // Use a random number to prevent the updates from becoming no-ops.
        update.$set['array.' + i + '.x'] = {"#RAND_INT": [0, 100]};
        update.$set['array.' + i + '.y'] = {"#RAND_INT": [0, 100]};
        update.$set['array.' + i + '.z'] = {"#RAND_INT": [0, 100]};
    }
    return update;
}

tests.push( { name: "Update.ManyElementsWithinArray",
              tags: ['update','regression'],
              pre: function( collection ) {
                  collection.drop();

                  var templateDoc = {array: []};
                  for (var i = 0; i < 200; i++) {
                      templateDoc.array.push({x: 0, y: 0, z: 0});
                  }

                  var bulk = collection.initializeUnorderedBulkOp();
                  for (var i = 0; i < 4800; ++i) {
                      bulk.insert(Object.merge({_id: i}, templateDoc));
                  }
                  assert.writeOK(bulk.execute());
              },
              ops: [
                  { op:  "update",
                    query: {_id: {"#RAND_INT_PLUS_THREAD": [0, 100]}},
                    update: buildManyElementUpdate(),
                  },
              ] } );

/**
 * Setup: Populate the collection with documents that have a single field which is a large array
 *        with 200 elements, each of which has twenty fields.
 * Test:  Each thread works on a range of 100 documents. It randomly selects a document by _id and
 *        selects a random element from the array, then sets 10 of the fields in the matched array
 *        element to a random number.
 */
tests.push( { name: "Update.MatchedElementWithinArray",
              tags: ['update','regression'],
              pre: function( collection ) {
                  collection.drop();

                  var templateDoc = {array: []};
                  for (var i = 0; i < 200; ++i) {
                      var arrayElt = {elt_id: i};
                      for (var j = 0; j < 20; ++j)  {
                          arrayElt["field_" + j] = 0;
                      }
                      templateDoc.array.push(arrayElt);
                  }

                  var bulk = collection.initializeUnorderedBulkOp();
                  for (var i = 0; i < 4800; ++i) {
                      bulk.insert(Object.merge({_id: i}, templateDoc));
                  }
                  assert.writeOK(bulk.execute());
              },
              ops: [
                  { op:  "update",
                    query: {
                        _id: {"#RAND_INT_PLUS_THREAD": [0, 100]},
                        "array.elt_id": {"#RAND_INT": [0, 200]}
                    },
                    update: {$set: {
                        // Use a random number to prevent the update from being a no-op.
                        "array.$.field_0": {"#RAND_INT": [0, 99]},
                        "array.$.field_1": {"#RAND_INT": [0, 99]},
                        "array.$.field_2": {"#RAND_INT": [0, 99]},
                        "array.$.field_3": {"#RAND_INT": [0, 99]},
                        "array.$.field_4": {"#RAND_INT": [0, 99]},
                        "array.$.field_15": {"#RAND_INT": [0, 99]},
                        "array.$.field_16": {"#RAND_INT": [0, 99]},
                        "array.$.field_17": {"#RAND_INT": [0, 99]},
                        "array.$.field_18": {"#RAND_INT": [0, 99]},
                        "array.$.field_19": {"#RAND_INT": [0, 99]},
                    }}
                  },
              ] } );

/**
 * Setup: Populate a collection with an integer field X set to 0 and an
 *        incrementing integer field A. Create a unique index on A.
 * Test:  Each thread works in a range of 100 documents; randomly selects a
 *        document using field A and increments X.
 */
tests.push( { name: "Update.UniqueIndex",
              tags: ['update','uniqueidx','regression'],
              pre: function( collection ) {
                  collection.drop();
                  var docs = [];
                  for ( var i = 0; i < 4800; i++ ) {
                      docs.push( { a : i, x : 0 } );
                  }
                  collection.insert(docs);
                  collection.createIndex( { a: 1 }, { unique: true } );
              },
              ops: [
                  { op:  "update",
                    query: { a : { "#RAND_INT_PLUS_THREAD" : [ 0, 100 ] } },
                    update: { $inc : { x : 1 } } },
              ] } );

/**
 * Setup: Populate a collection with an integer field X set to 0 and two
 *        incrementing integer fields A, B. Create a unique compound index on
 *        fields A and B, with reverse ordering for A than B.
 * Test:  Each thread works in a range of 100 documents; randomly selects a
 *        document using field A and increments X.
 */
tests.push( { name: "Update.UniqueIndexCompoundReverse",
              tags: ['update','uniqueidx','regression'],
              pre: function( collection ) {
                  collection.drop();
                  var docs = [];
                  for ( var i = 0; i < 4800; i++ ) {
                      docs.push( { a : i, b : i, x : 0 } );
                  }
                  collection.insert(docs);
                  collection.createIndex( { a: -1, b: 1 }, { unique: true } );
              },
              ops: [
                  { op:  "update",
                    query: { a : { "#RAND_INT_PLUS_THREAD" : [ 0, 100 ] } },
                    update: { $inc : { x : 1 } } },
              ] } );
