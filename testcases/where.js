if ( typeof(tests) != "object" ) {
    tests = [];
}

// Queries that can be written in query language and using $where

/**
 * Setup: creates a collection with documents of the form {x : i}
 * Test: Finds {x: 1} using query language
 */
tests.push({name: "Where.CompareToInt.QueryLanguage",
            tags: ['compare'],
            pre: generateDocs(500, increasingXGenerator()),
            ops: [
              {op: "find", query: {x : 1}}
            ]});

/**
 * Setup: creates a collection with documents of the form {x : i}
 * Test: Finds {x: 1} using a $where query with == (weak equality)
 */
tests.push({name: "Where.CompareToInt.Where.DoubleEquals",
            tags: ['where','regression'],
            pre: generateDocs(500, increasingXGenerator()),
            ops: [
              {op: "find", query: {$where: function() {return this.x == 1;}}} 
            ]});

/**
 * Setup: creates a collection with documents of the form {x : i}
 * Test: Finds {x: 1} using a $where query with === (type-safe equality)
 */
tests.push({name: "Where.CompareToInt.Where.TripleEquals",
            tags: ['where','regression'],
            pre: generateDocs(500, increasingXGenerator()),
            ops: [
              {op: "find", query: {$where: function() {return this.x === 1;}}} 
            ]});

/*
 * Setup: Creates a collection of 13 objects, each with 4 nested levels of 13 fields
 * Test: Find document through match of deeply nested field using $where
 */
tests.push({name: "Where.SimpleNested.Where",
            tags: [ 'where','regression'],
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
            tags: ['compare'],
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
            tags: ['where','regression'],
            pre: generateDocs(500, increasingXGenerator()),
            ops: [
              {op: "find", query: {$where: function() {return this.x == this.y; }}} 
            ]});

/**
 * Setup: creates a collection with 40,000 documents of the form {x: i, y: j}
 * Test: Finds all documents where x > y
 */
tests.push({name: "Where.CompareFields.Gt",
            tags: ['where','regression'],
            pre: generateDocs(200, tupleGenerator(200)),
            ops: [
              {op: "find", query: {$where: function() {return this.x > this.y; }}} 
            ]});

/**
 * Setup: creates a collection with 40,000 documents of the form {x: i, y: j}
 * Test: Finds all documents where x >= y
 */
tests.push({name: "Where.CompareFields.Gte",
            tags: ['where','regression'],
            pre: generateDocs(200, tupleGenerator(200)),
            ops: [
              {op: "find", query: {$where: function() {return this.x >= this.y; }}} 
            ]});

/**
 * Setup: creates a collection with 40,000 documents of the form {x: i, y: j}
 * Test: Finds all documents where x < y
 */
tests.push({name: "Where.CompareFields.Lt",
            tags: ['where','regression'],
            pre: generateDocs(200, tupleGenerator(200)),
            ops: [
              {op: "find", query: {$where: function() {return this.x < this.y; }}}
            ]});

/**
 * Setup: creates a collection with 40,000 documents of the form {x: i, y: j}
 * Test: Finds all documents where x <= y
 */
tests.push({name: "Where.CompareFields.Lte",
            tags: ['where','regression'],
            pre: generateDocs(200, tupleGenerator(200)),
            ops: [
              {op: "find", query: {$where: function() {return this.x <= this.y; }}}
            ]});

/**
 * Setup: creates a collection with 40,000 documents of the form {x: i, y: j}
 * Test: Finds all documents where x == 2 or y == 3 
 */
tests.push({name: "Where.Mixed",
            tags: ['where','regression'],
            pre: generateDocs(200, tupleGenerator(200)),
            ops: [
              {op: "find", query: {$or : [{x: 2}, {$where: function() {return (this.y == 3);}}]}} 
            ]});

/*
 * Setup: Creates a collection of 13 objects, each with 4 nested levels of 13 fields
 * Test: Find document through match of two deeply nested fields on the same document using $where
 */
tests.push({name: "Where.ComplexNested",
            tags: ['where','regression'],
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
            tags: ['where','regression'],
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
            tags: ['compare'],
            pre: generateDocs(10, nestedGenerator(true)),
            ops: [
              {op: "find", query: { 'a.b.c.d' : 1 }}
            ]
            });
