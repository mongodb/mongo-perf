if ( typeof(tests) != "object" ) {
    tests = [];
}

tests.push( { name: "Update.IncNoIndex",
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 1000; i++ ) {
                      collection.insert( { _id : i , x : 0 } );
                  }
                  collection.getDB().getLastError();
              },
              ops: [
                  { op: "update",
                    query: { _id : { "#RAND_INT" : [ 0, 1000 ] } },
                    update: { $inc : { x : 1 } } },
              ] } );

tests.push( { name: "Update.IncWithIndex",
              pre: function( collection ) {
                  collection.drop();
                  for ( var i = 0; i < 1000; i++ ) {
                      collection.insert( { _id : i , x : 0 } );
                  }
                  collection.getDB().getLastError();
                  collection.ensureIndex( { x : 1 } );
              },
              ops: [
                  { op: "update",
                    query: { _id : { "#RAND_INT" : [ 0, 1000 ] } },
                    update: { $inc : { x : 1 } } },
              ] } );

tests.push( { name: "Update.IncNoIndexUpsert",
              pre: function( collection ) {
                  collection.drop();
              },
              ops: [
                  { op: "update",
                    upsert : true,
                    query: { _id : { "#RAND_INT" : [ 0, 1000 ] } },
                    update: { $inc : { x : 1 } } },
              ] } );

tests.push( { name: "Update.IncWithIndexUpsert",
              pre: function( collection ) {
                  collection.drop();
                  collection.ensureIndex( { x : 1 } );
              },
              ops: [
                  { op: "update",
                    upsert : true,
                    query: { _id : { "#RAND_INT" : [ 0, 1000 ] } },
                    update: { $inc : { x : 1 } } },
              ] } );

var shortFieldNames =
  ["aa", "ba", "ca", "da", "ea", "fa", "ga", "ha", "ia", "ja",
   "ka", "la", "ma", "na", "oa", "pa", "qa", "ra", "sa", "ta",
   "ua", "va", "wa", "xa", "ya", "za", "ab", "bb", "cb", "db",
   "ri", "si", "ti", "ui", "vi", "wi", "xi", "yi", "zi", "aj",
   "xm", "ym", "zm", "an", "bn", "cn", "dn", "en", "fn", "gn"];

tests.push( { name: "Update.IncFewSmallDoc",
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
                  { op: "update",
                    query: { _id : { "#SEQ_INT" :
                                { seq_id: 0, start: 0, step: 1, mod: 100 } } },
                    update: { $inc : { aa : 1,
                                       da : 1,
                                       ha : 1,
                                       ma : 1,
                                       ta : 1 } } }
              ] } );

tests.push( { name: "Update.IncFewLargeDoc",
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
                  { op: "update",
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
                  { op: "update",
                    query: { _id : { "#SEQ_INT" :
                                { seq_id: 0, start: 0, step: 1, mod: 100 } } },
                    update: { $inc : { "kbgcslcybg": 1,
                                       "vjhgznppgw": 1,
                                       "jzaathnsra": 1,
                                       "miohmkbzvv": 1,
                                       "elcgijivrt": 1 } } }
              ] } );

tests.push( { name: "Update.IncFewLargeDocLongFields",
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
                  { op: "update",
                    query: { _id : { "#SEQ_INT" :
                                { seq_id: 0, start: 0, step: 1, mod: 100 } } },
                    update: { $inc : { "kbgcslcybg": 1,
                                       "vjhgznppgw": 1,
                                       "jzaathnsra": 1,
                                       "miohmkbzvv": 1,
                                       "elcgijivrt": 1 } } }
              ] } );

tests.push( { name: "Update.FieldAtOffset",
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
                  { op: "update",
                    multi: true,
                    query: {},
                    update: { $set: { "a_256": "a" } }
                  },
                  { op: "update",
                    multi: true,
                    query: {},
                    update: { $set: { "a_256": "aa" } }
                  }
              ] } );

// Some tests based on the MMS workload. These started as Eliot's 'mms.js' tests, which acm
// then extended and used for the first round of update performance improvements. We are
// capturing them here so they are run automatically. These tests explore the overhead of
// reaching into deep right children in complex documents.

var setupMMS = function( collection ) {
    collection.drop();

    var base = { _id: 0, a: 0, h: {}, z: 0 };
    for (var i = 0; i < 24; i++) {
        base.h[i] = {};
        for (var j = 0; j < 60; j++) {
            base.h[i][j] = { n: 0, t: 0, v: 0 };
        }
    }
};

// Increment one shallow (top-level) field.
tests.push( { name: "Update.MmsIncShallow1",
              pre: setupMMS,
              ops: [
                  { op: "update",
                    query: { _id: 0 },
                    update: { $inc: { a: 1 } }
                  }
              ] } );

// Increment two shallow (top-level) fields.
tests.push( { name: "Update.MmsIncShallow2",
              pre: setupMMS,
              ops: [
                  { op: "update",
                    query: { _id: 0 },
                    update: { $inc: { a: 1, z: 1 } }
                  }
              ] } );

// Increment one deep field. The selected field is far to the right in each subtree.
tests.push( { name: "Update.MmsIncDeep1",
              pre: setupMMS,
              ops: [
                  { op: "update",
                    query: { _id: 0 },
                    update: { $inc: { "h.23.59.n": 1 } }
                  }
              ] } );

// Increment two deep fields. The selected fields are far to the right in each subtree,
// and share a common prefix.
tests.push( { name: "Update.MmsIncDeepSharedPath2",
              pre: setupMMS,
              ops: [
                  { op: "update",
                    query: { _id: 0 },
                    update: { $inc: { "h.23.59.n": 1,
                                      "h.23.59.t": 1 } }
                  }
              ] } );

// Increment three deep fields. The selected fields are far to the right in each subtree,
// and share a common prefix.
tests.push( { name: "Update.MmsIncDeepSharedPath3",
              pre: setupMMS,
              ops: [
                  { op: "update",
                    query: { _id: 0 },
                    update: { $inc: { "h.23.59.n": 1,
                                      "h.23.59.t": 1,
                                      "h.23.59.v": 1 } }
                  }
              ] } );

// Increment two deep fields. The selected fields are far to the right in each subtree,
// but do not share a common prefix.
tests.push( { name: "Update.MmsIncDeepDistinctPath2",
              pre: setupMMS,
              ops: [
                  { op: "update",
                    query: { _id: 0 },
                    update: { $inc: { "h.22.59.n": 1,
                                      "h.23.59.t": 1 } }
                  }
              ] } );

// Increment three deep fields. The selected fields are far to the right in each subtree,
// but do not share a common prefix.
tests.push( { name: "Update.MmsIncDeepDistinctPath3",
              pre: setupMMS,
              ops: [
                  { op: "update",
                    query: { _id: 0 },
                    update: { $inc: { "h.21.59.n": 1,
                                      "h.22.59.t": 1,
                                      "h.23.59.v": 1 } }
                  }
              ] } );
