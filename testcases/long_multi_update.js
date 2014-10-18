if ( typeof(tests) != "object" ) {
    tests = [];
}

var setupTestBigAllDocs = function( collection ) {
   collection.drop();
   for ( var i = 0; i < 100000; i++ ) {
      collection.insert( { _id : i , x : 0 } );
   }
   collection.getDB().getLastError();  
}

var testBigAllDocs = [
   { op:  "update",
     multi: true,
     query: { },
     update: { $inc : { x : 1 } }
   },
]

tests.push( { name: "MultiUpdate.v0.BigAllDocs.NoIndex",
              tags: ['update','slow','weekly','monthly'],
              pre: function( collection ) {
                  setupTestBigAllDocs( collection );                                
              },
              ops: testBigAllDocs,
            } );       
              
tests.push( { name: "MultiUpdate.v0.BigAllDocs.Indexed",
              tags: ['update','slow','weekly','monthly'],
              pre: function( collection ) {
                  setupTestBigAllDocs( collection );
                  collection.ensureIndex( { x : 1 } );                                    
              },
              ops: testBigAllDocs,
            } );   
            
var setupTestBigAllDocsMultiChange = function( collection ) {
   collection.drop();
   for ( var i = 0; i < 100000; i++ ) {
      collection.insert( { _id : i , x : 0, y : "a" } );
   }
   collection.getDB().getLastError();  
}

var testBigAllDocsMultiChange = [
   { op:  "update",
     multi: true,
     query: { },
     update: { $inc: { x : 1 }, $set: { y: "b" } }
   },
]

tests.push( { name: "MultiUpdate.v0.BigAllDocsMultiChange.NoIndex",
              tags: ['update','slow','weekly','monthly'],
              pre: function( collection ) {
                  setupTestBigAllDocsMultiChange( collection );                                
              },
              ops: testBigAllDocsMultiChange,
            } );       
              
tests.push( { name: "MultiUpdate.v0.BigAllDocsMultiChange.Indexed",
              tags: ['update','slow','weekly','monthly'],
              pre: function( collection ) {
                  setupTestBigAllDocsMultiChange( collection );
                  collection.ensureIndex( { x : 1 } );                                    
                  collection.ensureIndex( { y : 1 } );                                    
              },
              ops: testBigAllDocsMultiChange,
            } );               

var setupTestContendedAllDocs = function( collection ) {
   collection.drop();
   for ( var i = 0; i < 3200; i++ ) {
      collection.insert( { _id : i , x : 0 } );
   }
   collection.getDB().getLastError();
}

var testContendedAllDocs = [
   { op:  "update",
     multi: true,
     query: { },
     update: { $inc : { x : 1 } }
   },
]
              
tests.push( { name: "MultiUpdate.v0.Contended.AllDocs.NoIndex",
              tags: ['update','slow','weekly','monthly'],
              pre: function( collection ) {
                  setupTestContendedAllDocs( collection )
              },
              ops: testContendedAllDocs,
            } );   
              
tests.push( { name: "MultiUpdate.v0.Contended.AllDocs.Indexed",
              tags: ['update','slow','weekly','monthly'],
              pre: function( collection ) {
                  setupTestContendedAllDocs( collection );
                  collection.ensureIndex( { x : 1 } );                                    
              },
              ops: testContendedAllDocs,
            } );   
