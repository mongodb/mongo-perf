if ( typeof(tests) != "object" ) {
    tests = [];
}

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
    collection.insert(base);
};

/*
* Setup: Insert a single doc that has three fields with one being an array
*        that is 24 levels deep and 60 elements each
* Test:  Increment one of shallow (top-level) field on the single doc
*/
tests.push( { name: "Update.MmsIncShallow1",
              tags: ['update','sanity','mms','daily','weekly','monthly'],
              pre: setupMMS,
              ops: [
                  { op:  "update",
                    query: { _id: 0 },
                    update: { $inc: { a: 1 } }
                  }
              ] } );

/*
* Setup: Insert a single doc that has three fields with one being an array
*        that is 24 levels deep and 60 elements each
* Test:  Increment two shallow (top-level) fields on the single doc
*/
tests.push( { name: "Update.MmsIncShallow2",
              tags: ['update','sanity','mms','daily','weekly','monthly', 'core-update'],
              pre: setupMMS,
              ops: [
                  { op:  "update",
                    query: { _id: 0 },
                    update: { $inc: { a: 1, z: 1 } }
                  }
              ] } );

/*
* Setup: Insert a single doc that has three fields with one being an array
*        that is 24 levels deep and 60 elements each
* Test:  Increment one deep field. The selected field is at the high indexed
*        end of the arrays 
*/
tests.push( { name: "Update.MmsIncDeep1",
              tags: ['update','sanity','mms','daily','weekly','monthly', 'core-update'],
              pre: setupMMS,
              ops: [
                  { op:  "update",
                    query: { _id: 0 },
                    update: { $inc: { "h.23.59.n": 1 } }
                  }
              ] } );

/*
* Setup: Insert a single doc that has three fields with one being an array
*        that is 24 levels deep and 60 elements each
* Test:  Increment two deep fields. The selected fields are at the high 
*        indexed end of the arrays 
*/
tests.push( { name: "Update.MmsIncDeepSharedPath2",
              tags: ['update','sanity','mms','daily','weekly','monthly', 'core-update'],
              pre: setupMMS,
              ops: [
                  { op:  "update",
                    query: { _id: 0 },
                    update: { $inc: { "h.23.59.n": 1,
                                      "h.23.59.t": 1 } }
                  }
              ] } );

/*
* Setup: Insert a single doc that has three fields with one being an array
*        that is 24 levels deep and 60 elements each
* Test:  Increment three deep fields. The selected fields are at the hgih
*        indexed end of the arrays
*/
tests.push( { name: "Update.MmsIncDeepSharedPath3",
              tags: ['update','sanity','mms','daily','weekly','monthly', 'core-update'],
              pre: setupMMS,
              ops: [
                  { op:  "update",
                    query: { _id: 0 },
                    update: { $inc: { "h.23.59.n": 1,
                                      "h.23.59.t": 1,
                                      "h.23.59.v": 1 } }
                  }
              ] } );

/*
* Setup: Insert a single doc that has three fields with one being an array
*        that is 24 levels deep and 60 elements each
* Test:  Increment two deep fields. The selected fields are near the high 
*        indexed end of the arrays and do not share the same prefix
*/
tests.push( { name: "Update.MmsIncDeepDistinctPath2",
              tags: ['update','sanity','mms','daily','weekly','monthly', 'core-update'],
              pre: setupMMS,
              ops: [
                  { op:  "update",
                    query: { _id: 0 },
                    update: { $inc: { "h.22.59.n": 1,
                                      "h.23.59.t": 1 } }
                  }
              ] } );

/*
* Setup: Insert a single doc that has three fields with one being an array
*        that is 24 levels deep and 60 elements each
* Test:  Increment three deep fields. The selected fields are near the high
*        indexed end of the arrays and do not share a common prefix.
*/
tests.push( { name: "Update.MmsIncDeepDistinctPath3",
              tags: ['update','sanity','mms','daily','weekly','monthly', 'core-update'],
              pre: setupMMS,
              ops: [
                  { op:  "update",
                    query: { _id: 0 },
                    update: { $inc: { "h.21.59.n": 1,
                                      "h.22.59.t": 1,
                                      "h.23.59.v": 1 } }
                  }
              ] } );


/*
* Setup: Insert a single doc that has three fields with one being an array
*        that is 24 levels deep and 60 elements each
* Test:  Increment three deep fields. The selected fields are at the high indexed
*        end of the 2nd level array but evenly spreaded in the first level array
*/
tests.push( { name: "Update.v0.MmsIncDeepDistinctPath4",
              tags: ['update','sanity','mms','daily','weekly','monthly', 'core-update'],
              pre: setupMMS,
              ops: [
                  { op:  "update",
                    query: { _id: 0 },
                    update: { $inc: { "h.23.59.n": 1,
                                      "h.12.59.t": 1,
                                      "h.0.59.v": 1 } }
                  }
              ] } );
