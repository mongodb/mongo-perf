if ( typeof(tests) != "object" ) {
    tests = [];
}

tests.push( { name: "Update.v3.IncNoIndex",
              tags: ['update','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 4800; i++ ) {
                      collection.insert( { _id : i , x : 0 } );
                  }
                  collection.getDB().getLastError();
              },
              ops: [
                  { op:  "update",
                    query: { _id : { "#RAND_INT_PLUS_THREAD" : [ 0, 100 ] } },
                    update: { $inc : { x : 1 } } },
              ] } );

tests.push( { name: "Update.v3.IncWithIndex",
              tags: ['update','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 4800; i++ ) {
                      collection.insert( { _id : i , x : 0 } );
                  }
                  collection.getDB().getLastError();
                  collection.ensureIndex( { x : 1 } );
              },
              ops: [
                  { op:  "update",
                    query: { _id : { "#RAND_INT_PLUS_THREAD" : [ 0, 100 ] } },
                    update: { $inc : { x : 1 } } },
              ] } );

tests.push( { name: "Update.v3.IncNoIndexUpsert",
              tags: ['update','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
              },
              ops: [
                  { op:  "update",
                    upsert : true,
                    query: { _id : { "#RAND_INT_PLUS_THREAD" : [ 0, 100 ] } },
                    update: { $inc : { x : 1 } } },
              ] } );

tests.push( { name: "Update.v3.IncWithIndexUpsert",
              tags: ['update','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();
                  collection.ensureIndex( { x : 1 } );
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

tests.push( { name: "Update.IncFewSmallDoc",
              tags: ['update','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();

                 for (var i = 0; i < 100; i++) {
                     var toInsert = {_id: i};
                     for (var j = 0; j < 20; j++) {
                         toInsert[shortFieldNames[j]] = 1;
                     }
                     collection.insert(toInsert);
                 }

                 collection.getDB().getLastError();
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

tests.push( { name: "Update.IncFewLargeDoc",
              tags: ['update','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();

                 for (var i = 0; i < 100; i++) {
                     var toInsert = {_id: i};
                     for (var j = 0; j < shortFieldNames.length; j++) {
                         toInsert[shortFieldNames[j]] = 1;
                     }
                     collection.insert(toInsert);
                 }

                 collection.getDB().getLastError();
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

tests.push( { name: "Update.IncFewSmallDocLongFields",
              tags: ['update','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();

                 for (var i = 0; i < 100; i++) {
                     var toInsert = {_id: i};
                     for (var j = 0; j < 20; j++) {
                         toInsert[longFieldNames[j]] = 1;
                     }
                     collection.insert(toInsert);
                 }

                 collection.getDB().getLastError();
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

tests.push( { name: "Update.IncFewLargeDocLongFields",
              tags: ['update','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();

                 for (var i = 0; i < 100; i++) {
                     var toInsert = {_id: i};
                     for (var j = 0; j < longFieldNames.length; j++) {
                         toInsert[longFieldNames[j]] = 1;
                     }
                     collection.insert(toInsert);
                 }

                 collection.getDB().getLastError();
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

tests.push( { name: "Update.v4.SingleDocFieldAtOffset",
              tags: ['update','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();

                  var kFieldCount = 512;

                  // Build the document and insert several copies.
                  var toInsert = {};
                  for (var i = 0; i < kFieldCount; i++) {
                      toInsert["a_" + i.toString()] = "a";
                  }

                  for (var i = 0; i < 4800; i++) {
                      toInsert["_id"] = i;
                      collection.insert(toInsert);
                 }
                 collection.getDB().getLastError();
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

tests.push( { name: "Update.FieldAtOffset",
              tags: ['update','sanity','daily','weekly','monthly'],
              pre: function( collection ) {
                  collection.drop();

                  var kFieldCount = 512;

                  // Build the document and insert several copies.
                  var toInsert = {};
                  for (var i = 0; i < kFieldCount; i++) {
                      toInsert["a_" + i.toString()] = "a";
                  }

                  for (var i = 0; i < 100; i++) {
                      collection.insert(toInsert);
                  }
                  collection.getDB().getLastError();
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

