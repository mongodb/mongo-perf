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
    }
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
 * Generates a documents containing an array of 10 
 * random numbers between 0 and 100
 */
function arrayGenerator() {
    var results = [];
    for (var j = 0; j < 10; j++) {
      results.push(Math.floor(Math.random() * 101));
    }
    return {"results": results };
}

/**
 * Generates documents of the form {x: i, y: j}
 * with increasing values for x and y 
 * y will cycle from 0 to numY.
 */
 function tupleGenerator(numY) {
    var x = 0;
    var y = 0;
    return function() {
      var doc = { "x" : x, "y": y};
      if (y++ > numY) {
        y = 0;
        x++;
      }
      return doc;
    };
 }

/**
 * Generates documents containing 4-letter strings
 */
function permutationGenerator() {
    var strings = [];
    for (var i = 0; i < 26; i++) {
        strings.push(String.fromCharCode(97+i));
    }
    var i = 0;
    var j = 0;
    var k = 0;
    var l = 0;
    return function() {
      var doc = {x: strings[i]+strings[j]+strings[k]+strings[l]};
      if (++l > 25) {
        l = 0;
        if (++k > 25) {
            k = 0;
            if (++j > 25) {
                j = 0;
                if (++i > 25) {
                    i = 0;
                }
            }
        }
      }
      return doc;
  };
}

/**
 * Generates deeply nested documents
 */
function nestedGenerator(big) {
    var strings = [];
    for (var i = 0; i < 26; i++) {
        strings.push(String.fromCharCode(97+i));
    }
    var i = 0;
    var levelSize = big ? 26 : 13;
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


// Queries that can be written in query language and using $where

/**
 * Setup: creates a collection with documents of the form {x : i}
 * Test: Finds {x: 1} using query language
 */
tests.push({name: "Where.CompareToInt.QueryLanguage",
            tags: ['query','compare'],
            pre: generateDocs(500, increasingXGenerator()),
            ops: [
              {op: "find", query: {x : 1}}
            ]});

/**
 * Setup: creates a collection with documents of the form {x : i}
 * Test: Finds {x: 1} using a $where query with == (weak equality)
 */
tests.push({name: "Where.CompareToInt.Where.DoubleEquals",
            tags: ['query','where'],
            pre: generateDocs(500, increasingXGenerator()),
            ops: [
              {op: "find", query: {$where: function() {return this.x == 1;}}} 
            ]});

/**
 * Setup: creates a collection with documents of the form {x : i}
 * Test: Finds {x: 1} using a $where query with === (type-safe equality)
 */
tests.push({name: "Where.CompareToInt.Where.TripleEquals",
            tags: ['query','where'],
            pre: generateDocs(500, increasingXGenerator()),
            ops: [
              {op: "find", query: {$where: function() {return this.x === 1;}}} 
            ]});

/*
 * Setup: Creates a collection of 13 objects, each with 4 nested levels of 13 fields
 * Test: Find document through match of deeply nested field using $where
 */
tests.push({name: "Where.SimpleNested.Where",
            tags: ['query', 'where'],
            pre: generateDocs(13, nestedGenerator(false)),
            ops: [
              {op:"find", query: {'$where': function() { return this.d.c.b.a === 1; }}}
            ]   
            } );

/*
 * Setup: Creates a collection of 13 objects, each with 4 nested levels of 13 fields
 * Test: Find document through match of deeply nested field using Query Language
 */
tests.push({name: "Where.SimpleNested.QueryLanguage",
            tags: ['query','compare'],
            pre: generateDocs(13, nestedGenerator()),
            ops: [
              {op: "find", query: { 'd.c.b.a' : 1 } }
            ]
            } );

// Queries that require the use of $where

/**
 * Setup: creates a collection with 40,000 documents of the form {x: i, y: j}
 * Test: Finds all documents where x == y
 */
tests.push({name: "Where.CompareFields.Equals",
            tags: ['query','where'],
            pre: generateDocs(500, increasingXGenerator()),
            ops: [
              {op: "find", query: {$where: function() {return this.x == this.y; }}} 
            ]});

/**
 * Setup: creates a collection with 40,000 documents of the form {x: i, y: j}
 * Test: Finds all documents where x > y
 */
tests.push({name: "Where.CompareFields.Gt",
            tags: ['query','where'],
            pre: generateDocs(200, tupleGenerator(200)),
            ops: [
              {op: "find", query: {$where: function() {return this.x > this.y; }}} 
            ]});

/**
 * Setup: creates a collection with 40,000 documents of the form {x: i, y: j}
 * Test: Finds all documents where x >= y
 */
tests.push({name: "Where.CompareFields.Gte",
            tags: ['query','where'],
            pre: generateDocs(200, tupleGenerator(200)),
            ops: [
              {op: "find", query: {$where: function() {return this.x >= this.y; }}} 
            ]});

/**
 * Setup: creates a collection with 40,000 documents of the form {x: i, y: j}
 * Test: Finds all documents where x < y
 */
tests.push({name: "Where.CompareFields.Lt",
            tags: ['query','where'],
            pre: generateDocs(200, tupleGenerator(200)),
            ops: [
              {op: "find", query: {$where: function() {return this.x < this.y; }}}
            ]});

/**
 * Setup: creates a collection with 40,000 documents of the form {x: i, y: j}
 * Test: Finds all documents where x <= y
 */
tests.push({name: "Where.CompareFields.Lte",
            tags: ['query','where'],
            pre: generateDocs(200, tupleGenerator(200)),
            ops: [
              {op: "find", query: {$where: function() {return this.x <= this.y; }}}
            ]});

/**
 * Setup: creates a collection with 40,000 documents of the form {x: i, y: j}
 * Test: Finds all documents where x == 2 or y == 3 
 */
tests.push({name: "Where.Mixed",
            tags: ['query','where'],
            pre: generateDocs(200, tupleGenerator(200)),
            ops: [
              {op: "find", query: {$or : [{x: 2}, {$where: function() {return (this.y == 3);}}]}} 
            ]});

/*
 * Setup: Creates a collection of 13 objects, each with 4 nested levels of 13 fields
 * Test: Find document through match of two deeply nested fields on the same document using $where
 */
tests.push({name: "Where.ComplexNested",
            tags: ['query','where'],
            pre: generateDocs(10, nestedGenerator(true)),
            ops: [
              {op: "find", query: {'$where': function() { return this.d.c.b.a === this.a.b.c.d; }}}
            ]   
            } );

// Queries to experiment with document size

/*
 * Setup: Creates a collection of 10 documents, each with 4 nested levels of 26 fields
 * Test: Find document through match of a deeply nested field using $where 
 */
tests.push({name: "Where.ReallyBigNestedComparison.Where",
            tags: ['query','where'],
            pre: generateDocs(10, nestedGenerator(true)),
            ops: [
              {op: "find", query: {'$where': function() { return this.a.b.c.d == 1; }}} 
            ]
            } );

/*
 * Setup: Creates a collection of 10 documents, each with 4 nested levels of 26 fields
 * Test: Find document through match of a deeply nested field using query language
 */
tests.push({name: "Where.ReallyBigNestedComparison.QueryLanguage",
            tags: ['query','compare'],
            pre: generateDocs(10, nestedGenerator(true)),
            ops: [
              {op: "find", query: { 'a.b.c.d' : 1 }}
            ]
            });
