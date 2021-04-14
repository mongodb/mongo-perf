if ( typeof(tests) != "object" ) {
    tests = [];
}

var setupTestUncontendedSingleDoc = function( collection ) {
    collection.drop();
    var docs = [];
    for ( var i = 0; i < 4800; i++ ) {
        docs.push( { _id : i , x : 0 } );
    }
    collection.insert(docs);
};

var testUncontendedSingleDoc = [
   { op:  "update",
     multi: true,
     query: { _id : { "#RAND_INT_PLUS_THREAD" : [ 0, 100 ] } },
     update: { $inc : { x : 1 } }
   },
];

/*
* Setup: Populate collection with unique integer _id and an integer field X=0
* Test:  Each thread works in its own range of docs
*        1. randomly selects one document using _id
*        2. update one field X by $inc (with multi=true)
*/
tests.push( { name: "MultiUpdate.Uncontended.SingleDoc.NoIndex",
              tags: ['update'],
              pre: function( collection ) {
                  setupTestUncontendedSingleDoc( collection );
              },
              ops: testUncontendedSingleDoc,
            } );

/*
* Setup: Populate collection with unique integer ID's and an integer field X=0
*        Create index on X
* Test:  Each thread works in its own range of docs
*        1. randomly selects one document using _id 
*        2. update the indexed field X by $inc (with multi=true)
* Notes: High contention on the index X
*/
tests.push( { name: "MultiUpdate.Uncontended.SingleDoc.Indexed",
              tags: ['update','core','indexed'],
              pre: function( collection ) {
                  setupTestUncontendedSingleDoc( collection );
                  collection.createIndex( { x : 1 } );
              },
              ops: testUncontendedSingleDoc,
            } );              
              
var setupTestUncontendedTwoDocs = function( collection ) {
    collection.drop();
    var docs = [];
    for ( var i = 0; i < 4800; i++ ) {
        docs.push( { _id : i , x : 0 } );
    }
    collection.insert(docs);
};

var testUncontendedTwoDocs = [
   { op:  "update",
     multi: true,
     query: { _id : {$in: [ {"#RAND_INT_PLUS_THREAD": [0,100]},  {"#RAND_INT_PLUS_THREAD": [0,100]} ] } },
     update: { $inc : { x : 1 } }
    },
];

/*
* Setup: Populate collection with unique integer _id and an integer field X=0
* Test:  Each thread works in its own range of docs; 
*        1. randomly selects two documents using _id
*        2. update the X field in documents by $inc (with multi=true)
*/
tests.push( { name: "MultiUpdate.Uncontended.TwoDocs.NoIndex",
              tags: ['update','core'],
              pre: function( collection ) {
                  setupTestUncontendedTwoDocs( collection );
              },
              ops: testUncontendedTwoDocs,
            } );

/*
* Setup: Populate collection with unique integer _id and an integer field X=0
*        Create index on X
* Test:  Each thread works in its own range of docs; 
*        1. randomly selects two documents using _id
*        2. update the indexed X field in documents by $inc (with multi=true)
* Notes: High contention on the index X
*/
tests.push( { name: "MultiUpdate.Uncontended.TwoDocs.Indexed",
              tags: ['update','core','indexed'],
              pre: function( collection ) {
                  setupTestUncontendedTwoDocs( collection );
                  collection.createIndex( { x : 1 } );                  
              },
              ops: testUncontendedTwoDocs,
            } );
                            
var setupTestContendedLow = function( collection ) {
    collection.drop();
    var docs = [];
    for ( var i = 0; i < 4800; i++ ) {
        docs.push( { _id : i , x : 0 } );
    }
    collection.insert(docs);
};                            

var testContendedLow = [
   { op:  "update",
     multi: true,
     query: { _id : {"#RAND_INT": [0,4800]} },
     update: { $inc : { x : 1 } }
    },
];

/*
* Setup: Populate collection with unique integer _id and an integer field X=0
* Test:  1. each thread randomly selects a document from the entire collection 
*           using _id
*        2. update field X by $inc (with multi=true)
*/
tests.push( { name: "MultiUpdate.Contended.Low.NoIndex",
              tags: ['update','core'],
              pre: function( collection ) {
                 setupTestContendedLow( collection );                               
              },
              ops: testContendedLow,
            } );   

/*
* Setup: Populate collection with unique integer _id and an integer field X=0
*        Create index on X.
* Test:  1. each thread randomly selects a document from the entire collection 
*           using _id
*        2. update indexed field X by $inc (with multi=true)
* Notes: High contention on index
*/
tests.push( { name: "MultiUpdate.Contended.Low.Indexed",
              tags: ['update','core','indexed'],
              pre: function( collection ) {
                 setupTestContendedLow( collection );
                 collection.createIndex( { x : 1 } );                                    
              },
              ops: testContendedLow,
            } );                    
              
var setupTestContendedMedium = function( collection ) {
    collection.drop();
    var docs = [];
    for ( var i = 0; i < 4800; i++ ) {
        docs.push( { _id : i , x : 0 } );
    }
    collection.insert(docs);
};

var testContendedMedium = [ 
   { op:  "update",
     multi: true,
     query: { _id : { $gt: {"#RAND_INT": [0,2600]}, $lt: {"#RAND_INT": [2200,4800]} } },
     update: { $inc : { x : 1 } }
   }, 
];

/*
* Setup: Populate collection with unique integer _id and an integer field X=0
* Test:  1. each thread randomly selects a rnange of documents using _id 
*           from the entire collection (each batch is ~1200 docs) 
*        2. update field X by $inc (with multi=true)
*/
tests.push( { name: "MultiUpdate.Contended.Medium.NoIndex",
              tags: ['update'],
              pre: function( collection ) {
                  setupTestContendedMedium( collection );
              },
              ops: testContendedMedium,
            } );   
                            
/*
* Setup: Populate collection with unique integer _id and an integer field X=0
*        Create index on X.
* Test:  1. each thread randomly selects a rnange of documents using _id 
*           from the entire collection (each batch is ~1200 docs) 
*        2. update indexed field X by $inc (with multi=true)
* Notes: High contention on index X
*/
tests.push( { name: "MultiUpdate.Contended.Medium.Indexed",
              tags: ['update','indexed'],
              pre: function( collection ) {
                  setupTestContendedMedium( collection );
                  collection.createIndex( { x : 1 } );                                    
              },
              ops: testContendedMedium,
            } );     

var setupTestContendedHot = function( collection ) {
    collection.drop();
    var docs = [];
    for ( var i = 0; i < 4800; i++ ) {
        docs.push( { _id : i , x : 0 } );
    }
    collection.insert(docs);
};

var testContendedHot = [ 
   { op:  "update",
     multi: true,
     query: { _id : { $gt: 1590, $lt: 1610 } },
     update: { $inc : { x : 1 } }
   }, 
];


/*
* Setup: Populate collection with unique integer _id and an integer field X=0
* Test:  All threads select the same 20 documents (1590 < _id < 1610)
*        and update X by $inc (with multi=true)
* Notes: High contention on the 20 documents updated
*/
tests.push( { name: "MultiUpdate.Contended.Hot.NoIndex",
              tags: ['update'],
              pre: function( collection ) {
                  setupTestContendedHot( collection );
              },
              ops: testContendedHot,
            } );   

/*
* Setup: Populate collection with unique integer _id and an integer field X=0
*        Create index on X
* Test:  All threads select the same 20 documents (1590 < _id < 1610)
*        and update the indexed field X by $inc (with multi=true)
* Notes: High contention on the 20 documents updated as well as on index X
*/
tests.push( { name: "MultiUpdate.Contended.Hot.Indexed",
              tags: ['update','indexed'],
              pre: function( collection ) {
                  setupTestContendedHot( collection );
                  collection.createIndex( { x : 1 } );                                    
              },
              ops: testContendedHot,
            } );   
            

var setupTestContendedSeqDoc = function( collection ) {
    collection.drop();
    var docs = [];
    for ( var i = 0; i < 4800; i++ ) {
        docs.push( { _id : i , x : 0 } );
   }
    collection.insert(docs);
};

var testContendedSeqDoc = [ 
   { op:  "update",
     multi: true,
     query: { _id : 1600 },
     update: { $inc : { x : 1 } }
   }, 
];

/*
* Setup: Populate collection with unique integer _id and an integer field X=0
* Test:  All threads compete to $inc field X of doc _id:1600 
*        (with multi=true)
*/
tests.push( { name: "MultiUpdate.Contended.Doc.Seq.NoIndex",
              tags: ['update'],
              pre: function( collection ) {
                  setupTestContendedSeqDoc( collection );
              },
              ops: testContendedSeqDoc,
            } );   

/*
* Setup: Populate collection with unique integer _id and an integer field X=0
         Create index on X
* Test:  All threads compete to $inc indexed field X of doc _id:1600 
*        (with multi=true)
*/
tests.push( { name: "MultiUpdate.Contended.Doc.Seq.Indexed",
              tags: ['update','indexed'],
              pre: function( collection ) {
                  setupTestContendedSeqDoc( collection );
                  collection.createIndex( { x : 1 } );                                    
              },
              ops: testContendedSeqDoc,
            } );                            
            
var setupTestContendedRndDoc = function( collection ) {
    collection.drop();
    var docs = [];
    for ( var i = 0; i < 4800; i++ ) {
        docs.push( { _id : i , x : 0 } );
    }
    collection.insert(docs);
};

var testContendedRndDoc = [ 
   { op:  "update",
     multi: true,
     query: { _id : 4800 },
     update: { $set : { x: {"#RAND_INT": [0,4800]} } }
   }, 
];

/*
* Setup: Populate collection with unique integer _id and an integer field X=0
* Test:  All threads compete on doc _id:4800 and update its X to a random value
*        (with multi=true)
*/
tests.push( { name: "MultiUpdate.Contended.Doc.Rnd.NoIndex",
              tags: ['update'],
              pre: function( collection ) {
                  setupTestContendedRndDoc( collection );
              },
              ops: testContendedRndDoc,
            } );   

/*
* Setup: Populate collection with unique integer _id and an integer field X=0
*        Create index on X
* Test:  All threads compete on doc _id:4800 and update indexed X to a 
*        random value (with multi=true)
*/
tests.push( { name: "MultiUpdate.Contended.Doc.Rnd.Indexed",
              tags: ['update','indexed'],
              pre: function( collection ) {
                  setupTestContendedRndDoc( collection );
                  collection.createIndex( { x : 1 } );                                    
              },
              ops: testContendedRndDoc,
            } );        
