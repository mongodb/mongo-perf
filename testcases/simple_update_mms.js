if ( typeof(tests) != "object" ) {
    tests = [];
}

// Some tests based on the MMS workload. These started as Eliot's 'mms.js' tests, which acm
// then extended and used for the first round of update performance improvements. We are
// capturing them here so they are run automatically. These tests explore the overhead of
// reaching into deep right children in complex documents.

/**
 * Inserts a single document with the following shape into 'collection':
 * {
 *     _id: 0,
 *     a: 0,
 *     z: 0,
 *     h: {
 *         0: {  // Hour 0.
 *             0: {n: 0, t: 0, v: 0},  // Minute 0.
 *             1: {n: 0, t: 0, v: 0},  // Minute 1.
 *             ...
 *             59: {n: 0, t: 0, v: 0}  // Minute 59.
 *         },
 *         1: {  // Hour 1.
 *             0: {n: 0, t: 0, v: 0},  // Minute 0.
 *             ...
 *             59: {n: 0, t: 0, v: 0}  // Minute 59.
 *         },
 *         ...
 *         23: {  // Hour 23.
 *             0: {n: 0, t: 0, v: 0},  // Minute 0.
 *             ...
 *             59: {n: 0, t: 0, v: 0}  // Minute 59.
 *         }
 *     }
 * }
 */
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

/**
 * Setup: See setupMMS().
 * Test:  Increment one of shallow (top-level) field on the single doc
 */
tests.push( { name: "Update.MmsIncShallow1",
              tags: ['update','mms','single_threaded','regression'],
              pre: setupMMS,
              ops: [
                  { op:  "update",
                    query: { _id: 0 },
                    update: { $inc: { a: 1 } }
                  }
              ] } );

/**
 * Setup: See setupMMS().
 * Test:  Increment two shallow (top-level) fields on the single doc
 */
tests.push( { name: "Update.MmsIncShallow2",
              tags: ['update','mms','core','single_threaded'],
              pre: setupMMS,
              ops: [
                  { op:  "update",
                    query: { _id: 0 },
                    update: { $inc: { a: 1, z: 1 } }
                  }
              ] } );

/**
 * Setup: See setupMMS().
 * Test:  Increment one deep field. The selected field is at the high indexed
 *        end of the arrays 
 */
tests.push( { name: "Update.MmsIncDeep1",
              tags: ['update','mms','core','single_threaded'],
              pre: setupMMS,
              ops: [
                  { op:  "update",
                    query: { _id: 0 },
                    update: { $inc: { "h.23.59.n": 1 } }
                  }
              ] } );

/**
 * Setup: See setupMMS().
 * Test:  Increment two deep fields. The selected fields are at the high 
 *        indexed end of the arrays 
 */
tests.push( { name: "Update.MmsIncDeepSharedPath2",
              tags: ['update','mms','core','single_threaded'],
              pre: setupMMS,
              ops: [
                  { op:  "update",
                    query: { _id: 0 },
                    update: { $inc: { "h.23.59.n": 1,
                                      "h.23.59.t": 1 } }
                  }
              ] } );

/**
 * Setup: See setupMMS().
 * Test:  Increment three deep fields. The selected fields are at the high
 *        indexed end of the arrays
 */
tests.push( { name: "Update.MmsIncDeepSharedPath3",
              tags: ['update','mms','core','single_threaded'],
              pre: setupMMS,
              ops: [
                  { op:  "update",
                    query: { _id: 0 },
                    update: { $inc: { "h.23.59.n": 1,
                                      "h.23.59.t": 1,
                                      "h.23.59.v": 1 } }
                  }
              ] } );

/**
 * Setup: See setupMMS().
 * Test:  Increment two deep fields. The selected fields are near the high 
 *        indexed end of the arrays and do not share the same prefix
 */
tests.push( { name: "Update.MmsIncDeepDistinctPath2",
              tags: ['update','mms','core','single_threaded'],
              pre: setupMMS,
              ops: [
                  { op:  "update",
                    query: { _id: 0 },
                    update: { $inc: { "h.22.59.n": 1,
                                      "h.23.59.t": 1 } }
                  }
              ] } );

/**
 * Setup: See setupMMS().
 * Test:  Increment three deep fields. The selected fields are near the high
 *        indexed end of the arrays and do not share a common prefix.
 */
tests.push( { name: "Update.MmsIncDeepDistinctPath3",
              tags: ['update','mms','core','single_threaded'],
              pre: setupMMS,
              ops: [
                  { op:  "update",
                    query: { _id: 0 },
                    update: { $inc: { "h.21.59.n": 1,
                                      "h.22.59.t": 1,
                                      "h.23.59.v": 1 } }
                  }
              ] } );

/**
 * Setup: See setupMMS().
 * Test:  Increment three deep fields. The selected fields are at the high indexed
 *        end of the 2nd level array but evenly spread in the first level array
 */
tests.push( { name: "Update.MmsIncDeepDistinctPath4",
              tags: ['update','mms','core','single_threaded'],
              pre: setupMMS,
              ops: [
                  { op:  "update",
                    query: { _id: 0 },
                    update: { $inc: { "h.23.59.n": 1,
                                      "h.12.59.t": 1,
                                      "h.0.59.v": 1 } }
                  }
              ] } );

/**
 * Setup: See setupMMS().
 * Test:  Increment deep fields, some of which share a prefix, some of which do not.
 */
tests.push( { name: "Update.MmsSetDeepDistinctPaths",
              tags: ['update','mms','core','single_threaded'],
              pre: setupMMS,
              ops: [
                  { op:  "update",
                    query: { _id: 0 },
                    update: { $set: {
                        // Use a random number to prevent the operations from becoming a no-op.
                        "h.0.0.n": {"#RAND_INT": [0, 100]},
                        "h.0.0.t": {"#RAND_INT": [0, 100]},
                        "h.0.0.v": {"#RAND_INT": [0, 100]},
                        "h.0.15.n": {"#RAND_INT": [0, 100]},
                        "h.0.30.n": {"#RAND_INT": [0, 100]},
                        "h.0.45.n": {"#RAND_INT": [0, 100]},
                        "h.0.59.n": {"#RAND_INT": [0, 100]},
                        "h.12.0.n": {"#RAND_INT": [0, 100]},
                        "h.12.15.n": {"#RAND_INT": [0, 100]},
                        "h.12.30.n": {"#RAND_INT": [0, 100]},
                        "h.12.45.n": {"#RAND_INT": [0, 100]},
                        "h.12.59.n": {"#RAND_INT": [0, 100]},
                        "h.12.59.t": {"#RAND_INT": [0, 100]},
                        "h.12.59.v": {"#RAND_INT": [0, 100]},
                    } }
                  }
              ] } );
