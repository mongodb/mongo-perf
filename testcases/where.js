if ( typeof(tests) != "object" ) {
    tests = [];
}

// Queries that can be written in query language and using $where

/**
 * Helper function to generate a collection with 4800 documents of the form {x : i}
 */
 function generateSimpleDocs(collection) {
    collection.drop();
    for (var i = 0; i < 4800; i++) {
        collection.insert({x: i});
    }
 }

/**
 * Setup: creates a collection with 4800 documents of the form {x : i}
 * Test: Finds {x: 1} using query language
 */
tests.push({name: "Where.CompareToInt.QueryLanguage",
            tags: ['query','querylanguage'],
            pre: generateSimpleDocs,
            ops: [
              {op: "find", query: {x : 1}}
            ]});

/**
 * Setup: creates a collection with 4800 documents of the form {x : i}
 * Test: Finds {x: 1} using a $where query with === (type-safe equality)
 */
tests.push({name: "Where.CompareToInt.Where.TripleEquals",
            tags: ['query','where'],
            pre: generateSimpleDocs,
            ops: [
              {op: "find", query: {$where: "this.x === 1" }} 
            ]});

/**
 * Setup: creates a collection with 4800 documents of the form {x : i}
 * Test: Finds {x: 1} using a $where query with == (weak equality)
 */
tests.push({name: "Where.CompareToInt.Where.DoubleEquals",
            tags: ['query','where'],
            pre: generateSimpleDocs,
            ops: [
              {op: "find", query: {$where: "this.x == 1" }} 
            ]});

/**
 * Setup: creates a collection with 4800 documents of the form {x : i}
 * Test: Finds all documents with x between 1 and 6 using $in 
 */
tests.push({name: "Where.In.QueryLanguage",
            tags: ['query','querylanguage'],
            pre: generateSimpleDocs,
            ops: [
              {op: "find", query: {x: {$in: [1, 2, 3, 4, 5, 6]}}} 
            ]});

/**
 * Setup: creates a collection with 4800 documents of the form {x : i}
 * Test: Finds all documents with x between 1 and 6 using a $where query
 */
tests.push({name: "Where.In.Where",
            tags: ['query','where'],
            pre: generateSimpleDocs,
            ops: [
              {op: "find", query: {$where: function() {
                  for (var j = 1; j <= 6; j++) {
                    if (this.x == j) {
                      return true;
                    }
                  }
                  return false;
                }
              }}
            ]});

/**
 * Helper function to generate a collection with 4800 documents containing arrays of 10 
 * random numbers between 0 and 100
 */
 function generateArrayDocs(collection) {
    collection.drop();
    for (var i = 0; i < 4800; i++) {
        collection.insert({x: i});
    }
 }

/**
 * Setup: creates a collection with 4800 documents containing arrays of 10 
 * random numbers between 0 and 100
 * Test: Finds all documents with x containing y such that 80 <= y < 85 
 * using $elemMatch
 */
tests.push({name: "Where.ElemMatch.QueryLanguage",
            tags: ['query','querylanguage'],
            pre: generateArrayDocs,
            ops: [
              {op: "find", query: {results: {$elemMatch: {$gte: 80, $lt: 85 }}}}
            ]});

/**
 * Setup: creates a collection with 4800 documents containing arrays of 10 
 * random numbers between 0 and 100
 * Test: Finds all documents with x containing y such that 80 <= y < 85 
 * using a $where query
 */
tests.push({name: "Where.ElemMatch.Where",
            tags: ['query','where'],
            pre: generateArrayDocs,
            ops: [
              {op: "find", query: {$where : function() {
                for (result in this.results) {
                  if ((this.results[result] >= 80) && (this.results[result] < 85)) {
                    return true;
                  }
                }
                return false;
              }}}
            ]});

/*
 * Helper function to generate permutations for Regex queries
 */
function generatePermutationsCollection(c) {
    var strings = [];
    for (var i = 0; i < 26; i++) {
        strings.push(String.fromCharCode(95+i));
    }
    var collection = [];
    for (var i = 0; i < 26; i++) {
        for (var j = 0; j < 26; j++) {
            for (var k = 0; k < 26; k++) {
                for (var l = 0; l < 26; l++) {
                    collection.push({x: strings[i]+strings[j]+strings[k]+strings[l]}); 
                }
            }
        }
    }
    c.drop();
    c.insert(collection);
}

/*
 * Setup: Create collection with documents containing 4 character alphabetic permutations
 * Test: Find document based on Regex Query
 */
tests.push({name: "Where.v1.Regex.QueryLanguage",
            tags: ['query','querylanguage'],
            pre: generatePermutationsCollection,
            ops: [
                {op: "find", query: { x : /^aa/ } }
            ]
            } );

/*
 * Setup: Create collection with documents containing 4 character alphabetic permutations
 * Test: Find document based on Regex $where
 */
tests.push({name: "Where.v1.Regex.Where",
            tags: ['query','where'],
            pre: generatePermutationsCollection,
            ops: [
                {op: "find", query: { '$where' : function() { return /^aa/.test(this.x); }}}
            ]
            } );

/*
 * Helper function to generate collection of deeply nested documents
 */
function generateNestedCollection(c) {
    var strings = [];
    for (var i = 0; i < 26; i++) {
        strings.push(String.fromCharCode(95+i));
    }
    var collection = [];
    for (var i = 0; i < 13; i++) {
        collection[i] = {};
        for (var j = 0; j < 13; j++) {
            collection[i][strings[j]] = {};
            for (var k = 0; k < 13; k++) {
                collection[i][strings[j]][strings[k]] = {};
                for (var l = 0; l < 13; l++) {
                    collection[i][strings[j]][strings[k]][strings[l]] = {};
                    for (var m = 0; m < 13; m++) {
                        collection[i][strings[j]][strings[k]][strings[l]][strings[m]] = i + j + k + l + m;
                    }
                }
            }
        }
    }
    c.drop();
    c.insert(collection);
}

/*
 * Setup: Creates a collection of 13 objects, each with 4 nested levels of 13 fields
 * Test: Find document through match of deeply nested field using Query Language
 */
tests.push({name: "Where.v1.SimpleNested.QueryLanguage",
            tags: ['query','querylanguage'],
            pre: generateNestedCollection,
            ops: [
                {op: "find", query: { 'd.c.b.a' : 1 } }
            ]
            } );

/*
 * Setup: Creates a collection of 13 objects, each with 4 nested levels of 13 fields
 * Test: Find document through match of deeply nested field using $where
 */
tests.push({name: "Where.v1.SimpleNested.Where",
            tags: ['query', 'where'],
            pre: generateNestedCollection,
            ops: [
                {op:"find", query: {'$where': function() { return this.d.c.b.a === 1 }}}
            ]   
            } );

// Queries that require the use of $where

/**
 * Helper function to generate a collection with 40,000 documents of the form {x: i, y: j}
 */
 function generateTupleDocs(collection) {
    collection.drop();
    for (var i = 0; i < 200; i++) {
      for (var j = 0; j < 200; j++) {
        collection.insert({x: i, y: j});
      }
    }
 }

/**
 * Setup: creates a collection with 40,000 documents of the form {x: i, y: j}
 * Test: Finds all documents where x == y
 */
tests.push({name: "Where.CompareFields.Equals",
            tags: ['query','where'],
            pre: generateTupleDocs,
            ops: [
              {op: "find", query: {$where: function() {return this.x == this.y}}} 
            ]});

/**
 * Setup: creates a collection with 40,000 documents of the form {x: i, y: j}
 * Test: Finds all documents where x > y
 */
tests.push({name: "Where.CompareFields.Gt",
            tags: ['query','where'],
            pre: generateTupleDocs,
            ops: [
              {op: "find", query: {$where: function() {return this.x > this.y}}} 
            ]});

/**
 * Setup: creates a collection with 40,000 documents of the form {x: i, y: j}
 * Test: Finds all documents where x >= y
 */
tests.push({name: "Where.CompareFields.Gte",
            tags: ['query','where'],
            pre: generateTupleDocs,
            ops: [
              {op: "find", query: {$where: function() {return this.x >= this.y}}} 
            ]});

/**
 * Setup: creates a collection with 40,000 documents of the form {x: i, y: j}
 * Test: Finds all documents where x < y
 */
tests.push({name: "Where.CompareFields.Lt",
            tags: ['query','where'],
            pre: generateTupleDocs,
            ops: [
              {op: "find", query: {$where: function() {return this.x < this.y}}}
            ]});

/**
 * Setup: creates a collection with 40,000 documents of the form {x: i, y: j}
 * Test: Finds all documents where x <= y
 */
tests.push({name: "Where.CompareFields.Lte",
              tags: ['query','where'],
              pre: generateTupleDocs,
              ops: [
                {op: "find", query: {$where: function() {return this.x <= this.y}}}
              ]});

/**
 * Setup: creates a collection with 40,000 documents of the form {x: i, y: j}
 * Test: Finds all documents where x == 2 or y == 3 
 */
tests.push({name: "Where.Mixed",
            tags: ['query','where','querylanguage'],
            pre: generateTupleDocs,
            ops: [
              {op: "find", query: {$or : [{x: 2}, {$where: function() {return (this.y == 3);}}]}} 
            ]});

/*
 * Setup: Creates a collection of 13 objects, each with 4 nested levels of 13 fields
 * Test: Find document through match of two deeply nested fields on the same document using $where
 */
tests.push({name: "Where.v1.ComplexNested",
            tags: ['query','where'],
            pre: generateNestedCollection,
            ops: [
                {op: "find", query: {'$where': function() { return this.d.c.b.a === this.a.b.c.d }}}
            ]   
            } );

// Queries to experiment with document size

/*
 * Helper function to generate collection with large deeply nested documents
 */
function generateBigDeeplyNestedCollection(c) {
    var strings = [];
    for (var i = 0; i < 26; i++) {
        strings.push(String.fromCharCode(95+i));
    }
    var collection = [];
    for (var i = 0; i < 10; i++) {
        collection[i] = {};
        for (var j = 0; j < 26; j++) {
            collection[i][strings[j]] = {};
            for (var k = 0; k < 26; k++) {
                collection[i][strings[j]][strings[k]] = {};
                for (var l = 0; l < 26; l++) {
                    collection[i][strings[j]][strings[k]][strings[l]] = {};
                    for (var m = 0; m < 26; m++) {
                        collection[i][strings[j]][strings[k]][strings[l]][strings[m]] = i + j + k + l + m;
                    }
                }
            }
        }
    }
    c.drop();
    c.insert(collection);
}

/*
 * Setup: Creates a collection of 10 documents, each with 4 nested levels of 26 fields
 * Test: Find document through match of a deeply nested field using query language
 */
tests.push({name: "Where.v1.ReallyBigNestedComparison.QueryLanguage",
            tags: ['query','querylanguage'],
            pre: generateBigDeeplyNestedCollection,
            ops: [
                {op: "find", query: { 'a.b.c.d' : 1 }}
            ]
            } );

/*
 * Setup: Creates a collection of 10 documents, each with 4 nested levels of 26 fields
 * Test: Find document through match of a deeply nested field using $where 
 */
tests.push({name: "Where.v1.ReallyBigNestedComparison.Where",
            tags: ['query','where'],
            pre: generateBigDeeplyNestedCollection,
            ops: [
                {op: "find", query: {'$where': function() { return this.a.b.c.d == 1; }}} 
            ]
            } );
