if ( typeof(tests) != "object" ) {
    tests = [];
}

var setupTestUncontendedSingleDoc = function( collection ) {
   collection.drop();
   for ( var i = 0; i < 4800; i++ ) {
      collection.insert( { _id : i , x : 0 } );
   }
   collection.getDB().getLastError();
}

var testUncontendedSingleDoc = [
   { op:  "update",
     multi: true,
     query: { _id : { "#RAND_INT_PLUS_THREAD" : [ 0, 100 ] } },
     update: { $inc : { x : 1 } }
   },
]

tests.push( { name: "MultiUpdate.v1.Uncontended.SingleDoc.NoIndex",
              tags: ['update','daily','weekly','monthly'],
              pre: function( collection ) {
                  setupTestUncontendedSingleDoc( collection );
              },
              ops: testUncontendedSingleDoc,
            } );
              
tests.push( { name: "MultiUpdate.v1.Uncontended.SingleDoc.Indexed",
              tags: ['update','daily','weekly','monthly'],
              pre: function( collection ) {
                  setupTestUncontendedSingleDoc( collection );
                  collection.ensureIndex( { x : 1 } );
              },
              ops: testUncontendedSingleDoc,
            } );              
              
var setupTestUncontendedTwoDocs = function( collection ) {
   collection.drop();
   for ( var i = 0; i < 4800; i++ ) {
      collection.insert( { _id : i , x : 0 } );
   }
   collection.getDB().getLastError();
};

var testUncontendedTwoDocs = [
   { op:  "update",
     multi: true,
     query: { _id : {$in: [ {"#RAND_INT_PLUS_THREAD": [0,100]},  {"#RAND_INT_PLUS_THREAD": [0,100]} ] } },
     update: { $inc : { x : 1 } }
    },
];

tests.push( { name: "MultiUpdate.v1.Uncontended.TwoDocs.NoIndex",
              tags: ['update','daily','weekly','monthly'],
              pre: function( collection ) {
                  setupTestUncontendedTwoDocs( collection );
              },
              ops: testUncontendedTwoDocs,
            } );

tests.push( { name: "MultiUpdate.v1.Uncontended.TwoDocs.Indexed",
              tags: ['update','daily','weekly','monthly'],
              pre: function( collection ) {
                  setupTestUncontendedTwoDocs( collection );
                  collection.ensureIndex( { x : 1 } );                  
              },
              ops: testUncontendedTwoDocs,
            } );
                            
var setupTestContendedLow = function( collection ) {
   collection.drop();
   for ( var i = 0; i < 4800; i++ ) {
      collection.insert( { _id : i , x : 0 } );
   }
   collection.getDB().getLastError();
};                            

var testContendedLow = [
   { op:  "update",
     multi: true,
     query: { _id : {"#RAND_INT": [0,4800]} },
     update: { $inc : { x : 1 } }
    },
];

tests.push( { name: "MultiUpdate.v1.Contended.Low.NoIndex",
              tags: ['update','daily','weekly','monthly'],
              pre: function( collection ) {
                 setupTestContendedLow( collection );                               
              },
              ops: testContendedLow,
            } );   
                            
tests.push( { name: "MultiUpdate.v1.Contended.Low.Indexed",
              tags: ['update','daily','weekly','monthly'],
              pre: function( collection ) {
                 setupTestContendedLow( collection );
                 collection.ensureIndex( { x : 1 } );                                    
              },
              ops: testContendedLow,
            } );                    
              
var setupTestContendedMedium = function( collection ) {
   collection.drop();
   for ( var i = 0; i < 4800; i++ ) {
      collection.insert( { _id : i , x : 0 } );
   }
   collection.getDB().getLastError();                               
}

var testContendedMedium = [ 
   { op:  "update",
     multi: true,
     query: { _id : { $gt: {"#RAND_INT": [0,2600]}, $lt: {"#RAND_INT": [2200,4800]} } },
     update: { $inc : { x : 1 } }
   }, 
]

tests.push( { name: "MultiUpdate.v1.Contended.Medium.NoIndex",
              tags: ['update','daily','weekly','monthly'],
              pre: function( collection ) {
                  setupTestContendedMedium( collection );
              },
              ops: testContendedMedium,
            } );   
                            
tests.push( { name: "MultiUpdate.v1.Contended.Medium.Indexed",
              tags: ['update','daily','weekly','monthly'],
              pre: function( collection ) {
                  setupTestContendedMedium( collection );
                  collection.ensureIndex( { x : 1 } );                                    
              },
              ops: testContendedMedium,
            } );     

var setupTestContendedHot = function( collection ) {
   collection.drop();
   for ( var i = 0; i < 4800; i++ ) {
      collection.insert( { _id : i , x : 0 } );
   }
   collection.getDB().getLastError();                               
}

var testContendedHot = [ 
   { op:  "update",
     multi: true,
     query: { _id : { $gt: 1590, $lt: 1610 } },
     update: { $inc : { x : 1 } }
   }, 
]

tests.push( { name: "MultiUpdate.v1.Contended.Hot.NoIndex",
              tags: ['update','daily','weekly','monthly'],
              pre: function( collection ) {
                  setupTestContendedHot( collection );
              },
              ops: testContendedHot,
            } );   
                            
tests.push( { name: "MultiUpdate.v1.Contended.Hot.Indexed",
              tags: ['update','daily','weekly','monthly'],
              pre: function( collection ) {
                  setupTestContendedHot( collection );
                  collection.ensureIndex( { x : 1 } );                                    
              },
              ops: testContendedHot,
            } );   
            
var setupTestContendedSeqDoc = function( collection ) {
   collection.drop();
   for ( var i = 0; i < 4800; i++ ) {
      collection.insert( { _id : i , x : 0 } );
   }
   collection.getDB().getLastError();                               
}

var testContendedSeqDoc = [ 
   { op:  "update",
     multi: true,
     query: { _id : 1600 },
     update: { $inc : { x : 1 } }
   }, 
]

tests.push( { name: "MultiUpdate.v1.Contended.Doc.Seq.NoIndex",
              tags: ['update','daily','weekly','monthly'],
              pre: function( collection ) {
                  setupTestContendedSeqDoc( collection );
              },
              ops: testContendedSeqDoc,
            } );   
                            
tests.push( { name: "MultiUpdate.v1.Contended.Doc.Seq.Indexed",
              tags: ['update','daily','weekly','monthly'],
              pre: function( collection ) {
                  setupTestContendedSeqDoc( collection );
                  collection.ensureIndex( { x : 1 } );                                    
              },
              ops: testContendedSeqDoc,
            } );                            
            
var setupTestContendedRndDoc = function( collection ) {
   collection.drop();
   for ( var i = 0; i < 4800; i++ ) {
      collection.insert( { _id : i , x : 0 } );
   }
   collection.getDB().getLastError();                               
}

var testContendedRndDoc = [ 
   { op:  "update",
     multi: true,
     query: { _id : 4800 },
     update: { $set : { x: {"#RAND_INT": [0,4800]} } }
   }, 
]

tests.push( { name: "MultiUpdate.v1.Contended.Doc.Rnd.NoIndex",
              tags: ['update','daily','weekly','monthly'],
              pre: function( collection ) {
                  setupTestContendedRndDoc( collection );
              },
              ops: testContendedRndDoc,
            } );   
                            
tests.push( { name: "MultiUpdate.v1.Contended.Doc.Rnd.Indexed",
              tags: ['update','daily','weekly','monthly'],
              pre: function( collection ) {
                  setupTestContendedRndDoc( collection );
                  collection.ensureIndex( { x : 1 } );                                    
              },
              ops: testContendedRndDoc,
            } );        