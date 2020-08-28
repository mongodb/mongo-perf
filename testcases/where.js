if ( typeof(tests) != "object" ) {
    tests = [];
}

// Document generation functions

/**
 * Helper function to generate documents in the collection using the 
 * generator function to generate the documents
 */
function generateDocs(nDocs, generator) {
    return function(collection) {
        collection.drop();
        docs = [];
        for (var i = 0; i < nDocs; i++) {
          docs.push(generator());
        }
        collection.insert(docs, {'ordered': false});
    };
 }

/**
 * Generates simple docs with increasing x value
 */
function increasingXGenerator() {
  var x = 0;
  return function() {
      var doc = { "x" : x};
      x++;
      return doc;
  };
}


/**
 * Generates deeply nested documents
 */
function nestedGenerator() {
    var strings = [];
    for (var i = 0; i < 26; i++) {
        strings.push(String.fromCharCode(97+i));
    }
    var i = 0;
    var levelSize = 13;
    return function() {
      doc = {};
      for (var j = 0; j < levelSize; j++) {
            doc[strings[j]] = {};
            for (var k = 0; k < levelSize; k++) {
                doc[strings[j]][strings[k]] = {};
                for (var l = 0; l < levelSize; l++) {
                    doc[strings[j]][strings[k]][strings[l]] = {};
                    for (var m = 0; m < levelSize; m++) {
                        doc[strings[j]][strings[k]][strings[l]][strings[m]] 
                            = i + j + k + l + m;
                    }
                }
            }
        }
      i++;
      return doc;
  };
}

/**
 * Run a tiny function, to help us measure the overhead of calling into JS.
 */
tests.push({name: "Where.Trivial",
            tags: ['where','regression'],
            pre: generateDocs(500, increasingXGenerator()),
            ops: [
              {op: "find", query: {$where: function() {return this.x === 1;}}} 
            ]});

/**
 * Runs a tiny function, applied to big nested documents. This helps us measure the overhead
 * of converting BSON values to JS.
 */
tests.push({name: "Where.NestedDocs",
            tags: ['where','regression'],
            pre: generateDocs(10, nestedGenerator()),
            ops: [
              {op: "find", query: {'$where': function() { return this.a.b.c.d === 1; }}}
            ]
            } );

/**
 * Runs a longer function, on one document. The function should be slow enough that running the
 * body is more expensive than the mere overhead of switching in and out of JS.
 */
tests.push({name: "Where.Slow",
            tags: ['where','regression'],
            pre: generateDocs(1, nestedGenerator()),
            ops: [
              {op: "find", query: {'$where': function() {
                  // Check whether the input document has any Date objects anywhere in it.
                  // It will always be false, because nestedGenerator only makes numbers.
                  function containsDate(v, depth) {
                      if (depth <= 0) {
                          return false;
                      } else if (v instanceof Date) {
                          return true;
                      } else if (Array.isArray(v)) {
                          for (const elem of v) {
                              if (containsDate(elem, depth-1)) {
                                  return true;
                              }
                          }
                          return false;
                      } else if (typeof v === 'object') {
                          if (v === null) {
                              return false;
                          }
                          for (const k of Object.keys(v)) {
                              if (containsDate(v[k], depth-1)) {
                                  return true;
                              }
                          }
                          return false;
                      } else {
                          // v must be some non-Date scalar.
                          return false;
                      }
                  }
                  return containsDate(this, 2);
              }}}
            ]
            } );

