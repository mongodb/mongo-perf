if ( typeof(tests) != "object" ) {
    tests = [];
}

var setupTestBigAllDocs = function( collection ) {
   collection.drop();
   for ( var i = 0; i < 100000; i++ ) {
      collection.insert( { _id : i , x : 0 } );
   }
};

var testBigAllDocs = [
   { op:  "update",
     multi: true,
     query: { },
     update: { $inc : { x : 1 } }
   },
];

/*
 * Setup: Create a collection with 100k documents with integer _id,
 *        and integer field x = 0
 * Test: Increment the x field on all 100k documents
 */
tests.push( { name: "MultiUpdate.BigAllDocs.NoIndex",
              tags: ['update','slow'],
              pre: function( collection ) {
                  setupTestBigAllDocs( collection );                                
              },
              ops: testBigAllDocs,
            } );       
              
/*
 * Setup: Create a collection with 100k documents with integer _id,
 *        and integer field x = 0, and an index on x
 * Test: Increment the x field on all 100k documents. After each
 *       operation there is one index key entry
 */
tests.push( { name: "MultiUpdate.BigAllDocs.Indexed",
              tags: ['update','slow','indexed'],
              pre: function( collection ) {
                  setupTestBigAllDocs( collection );
                  collection.createIndex( { x : 1 } );                                    
              },
              ops: testBigAllDocs,
            } );   
            
var setupTestBigAllDocsMultiChange = function( collection ) {
   collection.drop();
   for ( var i = 0; i < 100000; i++ ) {
      collection.insert( { _id : i , x : 0, y : "a" } );
   }
};

var testBigAllDocsMultiChange = [
   { op:  "update",
     multi: true,
     query: { },
     update: { $inc: { x : 1 }, $set: { y: "b" } }
   },
];

/*
 * Setup: Create a collection with 100k documents with integer _id,
 *        and integer field x = 0, y='b'
 * Test: Increment the x field and set y='b' on all 100k documents.
 */
tests.push( { name: "MultiUpdate.BigAllDocsMultiChange.NoIndex",
              tags: ['update','slow'],
              pre: function( collection ) {
                  setupTestBigAllDocsMultiChange( collection );
              },
              ops: testBigAllDocsMultiChange,
            } );
              
/*
 * Setup: Create a collection with 100k documents with integer _id,
 *        and integer field x = 0, y='b', both indexed
 * Test: Increment the x field and set y='b' on all 100k
 *       documents. Test updates both indexes. After each operation
 *       there is one index key in each index.
 */
tests.push( { name: "MultiUpdate.BigAllDocsMultiChange.Indexed",
              tags: ['update','slow','indexed'],
              pre: function( collection ) {
                  setupTestBigAllDocsMultiChange( collection );
                  collection.createIndex( { x : 1 } );
                  collection.createIndex( { y : 1 } );
              },
              ops: testBigAllDocsMultiChange,
            } );

/*
 * Setup: Create a collection with 100k documents with integer _id,
 *        and integer field x = 0, y='b', both indexed
 * Test: Increment the x field on all 100k documents. Test updates
 *       only one index.
 */
tests.push( { name: "MultiUpdate.BigAllDocsMultiChangeIgnoredIndex.Indexed",
              tags: ['update','slow','indexed'],
              pre: function( collection ) {
                  setupTestBigAllDocsMultiChange( collection );
                  collection.createIndex( { x : 1 } );
                  collection.createIndex( { y : 1 } );
              },
              ops: [
                  { op:  "update",
                    multi: true,
                    query: { },
                    update: { $inc: { x : 1 } } },
              ] } );

var setupTestContendedAllDocs = function( collection ) {
   collection.drop();
   for ( var i = 0; i < 3200; i++ ) {
      collection.insert( { _id : i , x : 0 } );
   }
};

var testContendedAllDocs = [
   { op:  "update",
     multi: true,
     query: { },
     update: { $inc : { x : 1 } }
   },
];
              
/*
 * Setup: Create a collection with 3200 documents with integer _id,
 *        and integer field x = 0
 * Test: Increment the x field on all 3200 documents
 */
tests.push( { name: "MultiUpdate.Contended.AllDocs.NoIndex",
              tags: ['update','slow'],
              pre: function( collection ) {
                  setupTestContendedAllDocs( collection );
              },
              ops: testContendedAllDocs,
            } );   
              
/*
 * Setup: Create a collection with 3200 documents with integer _id,
 *        and integer field x = 0, and an index on x
 * Test: Increment the x field on all 3200 documents. After each
 *       operation there is one index key entry
 */
tests.push( { name: "MultiUpdate.Contended.AllDocs.Indexed",
              tags: ['update','slow','indexed'],
              pre: function( collection ) {
                  setupTestContendedAllDocs( collection );
                  collection.createIndex( { x : 1 } );                                    
              },
              ops: testContendedAllDocs,
            } );   
