if ( typeof(tests) != "object" ) {
    tests = [];
}

/*
* Setup: Populate the collection with 4800 documents with interger
*        _id ranging from 0 to 4799, and a numerical field "a" set to 0
* Test: Each thread works in its range of 100 documents (separated by _id),
*       randomly selects a document and increments field "a" by 1
* Notes: This case is used for comparison against the similarly named
*        Update.DocValidation.OneNum to characterize the overhead of doc
*        validation. 
*/
tests.push( {   name: "Update.DocValidation.OneNum.Compare", 
                tags: ['update', 'DocValidation', 'compare'], 
                pre: function( collection) {
                    collection.drop();
                    var docs = [];
                    for ( var i = 0; i < 4800; i++ ) {
                        docs.push( { _id : i , a : 0 } );
                    }
                    collection.insert(docs);
                    collection.getDB().getLastError();
                },
                ops: [ {
                    op: "update",
                    query: { _id : { "#RAND_INT_PLUS_THREAD" : [ 0, 100 ] } },
                    update: {
                        $inc: {a: 1} 
                    } }
]});

/*
* Setup: Populate the collection with 4800 documents with interger
*        _id ranging from 0 to 4799, and a numerical field "a" set to 0.
*        Set up a validator for the field "a" to check for its existence
*        and type (double).
* Test: Each thread works in its range of 100 documents (separated by _id),
*       randomly selects a document and increments field a by 1
* Notes: This case tests the overhead in the update path for doc vacation when
*        only one field is validated. The filter type is set to 1 (double)
*        because JavaScript supports Number type, not integer.
*/
tests.push( {   name: "Update.DocValidation.OneNum", 
                tags: ['update', 'DocValidation', 'regression'], 
                pre: function( collection) {
                    collection.drop();
                    collection.runCommand("create", {"validator": {
                        $and: [
                            {a: {$exists: true}},
                            {a: {$type: 1}}
                        ] }});
                    var docs = [];
                    for ( var i = 0; i < 4800; i++ ) {
			            docs.push( { _id : i , a : 0 } );
                    }
                    collection.insert(docs);
		            collection.getDB().getLastError();
                },
                ops: [ {
                    op: "update",
                    query: { _id : { "#RAND_INT_PLUS_THREAD" : [ 0, 100 ] } },
                    update: {   $inc: {a: 1} 
                    } }
]});


/*
* Setup: Populate the collection with 4800 documents with interger
*        _id ranging from 0 to 4799, and ten numerical fields set to 0
* Test: Each thread works in its range of 100 documents (separated by _id),
*       randomly selects a document and increments the integer fields by 1
* Notes: This case is used for comparison against the similarly named
*        Update.DocValidation.TenNum to characterize the overhead of doc
*        validation. 
*/
tests.push( {   name: "Update.DocValidation.TenNum.Compare", 
                tags: ['update', 'DocValidation', 'compare'], 
                pre: function( collection) {
                    collection.drop();
                    var docs = [];
                    for ( var i = 0; i < 4800; i++ ) {
                    docs.push( { 
                        _id: i , 
                        a: 0, b: 0, c: 0, d: 0, e: 0,
                        f: 0, g: 0, h: 0, i: 0, j: 0
                        });
                    }
                    collection.insert(docs);
                    collection.getDB().getLastError();
                },
                ops: [ {
                    op: "update",
                    query: { _id : { "#RAND_INT_PLUS_THREAD" : [ 0, 100 ] } },
                    update: {
                        $inc: {   
                            a: 1, b: 1, c: 1, d: 1, e: 1,
			                f: 1, g: 1, h: 1, i: 1, j: 1
                        } } }
]});

/*
* Setup: Populate the collection with 4800 documents with interger
*        _id ranging from 0 to 4799, and ten numerical fields set to 0.
*        Set up a validator for the ten numberical fields to check for their
*        existence and type (double).
* Test: Each thread works in its range of 100 documents (separated by _id),
*       randomly selects a document and increments the integer fields by 1
* Notes: This case tests the overhead in the update path for doc vacation when
*        ten fields are validated. The filter type is set to 1 (double)
*        because JavaScript supports Number type, not integer.
*/
tests.push( {   name: "Update.DocValidation.TenNum", 
                tags: ['update', 'DocValidation', 'regression'], 
                pre: function( collection) {
                    collection.drop();
                    collection.runCommand("create", {"validator": {
                        $and: [
                            {a: {$exists: true}},
                            {a: {$type: 1}},
                            {b: {$exists: true}},
                            {b: {$type: 1}},
                            {c: {$exists: true}},
                            {c: {$type: 1}},
                            {d: {$exists: true}},
                            {d: {$type: 1}},
                            {e: {$exists: true}},
                            {e: {$type: 1}},
                            {f: {$exists: true}},
                            {f: {$type: 1}},
                            {g: {$exists: true}},
                            {g: {$type: 1}},
                            {h: {$exists: true}},
                            {h: {$type: 1}},
                            {a: {$exists: true}},
                            {a: {$type: 1}},
                            {i: {$exists: true}},
                            {i: {$type: 1}},
                            {j: {$exists: true}},
                            {j: {$type: 1}}
                        ] }});
                    var docs = [];
                    for ( var i = 0; i < 4800; i++ ) {
                        docs.push( { 
                            _id: i , 
                            a: 0, b: 0, c: 0, d: 0, e: 0,
                            f: 0, g: 0, h: 0, i: 0, j: 0
                        } );
                    }
                    collection.insert(docs);
                    collection.getDB().getLastError();
                },
                ops: [ {
                    op: "update",
                    query: { _id : { "#RAND_INT_PLUS_THREAD" : [ 0, 100 ] } },
                    update: { 
                        $inc: {
                            a: 1, b: 1, c: 1, d: 1, e: 1,
                            f: 1, g: 1, h: 1, i: 1, j: 1
                        } } }
]});


/*
* Setup: Populate the collection with 4800 documents with interger
*        _id ranging from 0 to 4799, and twenty numerical fields set to 0
* Test: Each thread works in its range of 100 documents (separated by _id),
*       randomly selects a document and increments the integer fields by 1
* Notes: This case is used for comparison against the similarly named
*        Update.DocValidation.TwentyNum to characterize the overhead of doc
*        validation. 
*/tests.push( {   name: "Update.DocValidation.TwentyNum.Compare", 
                  tags: ['update', 'DocValidation', 'compare'], 
                pre: function( collection) {
                    collection.drop();
                    var docs = [];
                    for ( var i = 0; i < 4800; i++ ) {
                        docs.push( { 
                            _id: i , 
                            a: 0, b: 0, c: 0, d: 0, e: 0,
                            f: 0, g: 0, h: 0, i: 0, j: 0,
                            k: 0, l: 0, m: 0, n: 0, o: 0,
                            p: 0, q: 0, r: 0, s: 0, t: 0
                        } );
    	            }
                    collection.insert(docs);
                    collection.getDB().getLastError();
                },
                ops: [ {
                    op: "update",
                    query: { _id : { "#RAND_INT_PLUS_THREAD" : [ 0, 100 ] } },
                    update: {
                        $inc: {
                            a: 1, b: 1, c: 1, d: 1, e: 1,
                            f: 1, g: 1, h: 1, i: 1, j: 1,
                            k: 1, l: 1, m: 1, n: 1, o: 1,
                            p: 1, q: 1, r: 1, s: 1, t: 1
                    } } }
]});

/*
* Setup: Populate the collection with 4800 documents with interger
*        _id ranging from 0 to 4799, and ten numerical fields set to 0.
*        Set up a validator for the twenty numberical fields to check for their
*        existence and type (double).
* Test: Each thread works in its range of 100 documents (separated by _id),
*       randomly selects a document and increments the integer fields by 1
* Notes: This case tests the overhead in the update path for doc vacation when
*        twenty fields are validated. The filter type is set to 1 (double)
*        because JavaScript supports Number type, not integer.
*/
tests.push( {   name: "Update.DocValidation.TwentyNum", 
                tags: ['update', 'DocValidation', 'regression'], 
                pre: function( collection) {
                    collection.drop();
                    collection.runCommand("create", {"validator": {
                        $and: [
                            {a: {$exists: true}},
                            {a: {$type: 1}},
                            {b: {$exists: true}},
                            {b: {$type: 1}},
                            {c: {$exists: true}},
                            {c: {$type: 1}},
                            {d: {$exists: true}},
                            {d: {$type: 1}},
                            {e: {$exists: true}},
                            {e: {$type: 1}},
                            {f: {$exists: true}},
                            {f: {$type: 1}},
                            {g: {$exists: true}},
                            {g: {$type: 1}},
                            {h: {$exists: true}},
                            {h: {$type: 1}},
                            {a: {$exists: true}},
                            {a: {$type: 1}},
                            {i: {$exists: true}},
                            {i: {$type: 1}},
                            {j: {$exists: true}},
                            {j: {$type: 1}},
                            {k: {$exists: true}},
                            {k: {$type: 1}},
                            {l: {$exists: true}},
                            {l: {$type: 1}},
                            {m: {$exists: true}},
                            {m: {$type: 1}},
                            {n: {$exists: true}},
                            {n: {$type: 1}},
                            {o: {$exists: true}},
                            {o: {$type: 1}},
                            {p: {$exists: true}},
                            {p: {$type: 1}},
                            {q: {$exists: true}},
                            {q: {$type: 1}},
                            {r: {$exists: true}},
                            {r: {$type: 1}},
                            {s: {$exists: true}},
                            {s: {$type: 1}},
                            {t: {$exists: true}},
                            {t: {$type: 1}},
                        ] }});
                    var docs = [];
                    for ( var i = 0; i < 4800; i++ ) {
                        docs.push( { 
                            _id: i , 
                            a: 0, b: 0, c: 0, d: 0, e: 0,
                            f: 0, g: 0, h: 0, i: 0, j: 0,
                            k: 0, l: 0, m: 0, n: 0, o: 0,
                            p: 0, q: 0, r: 0, s: 0, t: 0
                        } );
                    }
                    collection.insert(docs);
                    collection.getDB().getLastError();
                },
                ops: [ {
                    op: "update",
                    query: { _id : { "#RAND_INT_PLUS_THREAD" : [ 0, 100 ] } },
                    update: { 
                        $inc: {
                            a: 1, b: 1, c: 1, d: 1, e: 1,
                            f: 1, g: 1, h: 1, i: 1, j: 1,
                            k: 1, l: 1, m: 1, n: 1, o: 1,
                            p: 1, q: 1, r: 1, s: 1, t: 1
                    } } }
]});
