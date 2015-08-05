if ( typeof(tests) != "object" ) {
    tests = [];
}


/*
* Setup:
* Test: Insert documents with random numbers in an integer field
* Notes: This case is used for comparison against the similarly named
*        Insert.DocValidation.OneInt to characterize the overhead of doc
*        validation. 
*/
tests.push( {   name: "Insert.DocValidation.OneInt.Compare", 
                tags: ['insert', 'DocValidation', 'compare'], 
                pre: function( collection) {
                    collection.drop();
                },
                ops: [ {
                    op: "insert",
                    doc: {
                        a: {"#RAND_INT": [0, 10000]} 
                    } }
]});

/*
* Setup: Set up document validator to check for the existence and type 
*        (integer) of a field.
* Test: Insert documents with random numbers in the integer field that
*       is checked by the validator.
* Notes: This case tests the overhead for doc validation when only one
*        field is validated.
*/
tests.push( {   name: "Insert.DocValidation.OneInt", 
                tags: ['insert', 'DocValidation', 'regression'], 
                pre: function( collection) {
                    collection.drop();
                    collection.runCommand("create", {"validator": {
                        $and: [
                            {a: {$exists: true}},
                            {a: {$type: 16}}
                        ] }});
                },
                ops: [ {
                    op: "insert",
                    doc: {
                        a: {"#RAND_INT": [0, 10000]} 
                    } }
]});


/*
* Setup:
* Test: Insert documents with random numbers in ten integer fields.
* Notes: This case is used for comparison against the similarly named
*        Insert.DocValidation.TenInt to characterize the overhead of doc
*        validation. 
*/
tests.push( {   name: "Insert.DocValidation.TenInt.Compare", 
                tags: ['insert', 'DocValidation', 'compare'], 
                pre: function( collection) {
                    collection.drop();
                },
                ops: [ {
                    op: "insert",
                    doc: {
                        a: {"#RAND_INT": [0, 10000]},
                        b: {"#RAND_INT": [0, 10000]},
                        c: {"#RAND_INT": [0, 10000]},
                        d: {"#RAND_INT": [0, 10000]},
                        e: {"#RAND_INT": [0, 10000]},
                        f: {"#RAND_INT": [0, 10000]},
                        g: {"#RAND_INT": [0, 10000]},
                        h: {"#RAND_INT": [0, 10000]},
                        i: {"#RAND_INT": [0, 10000]},
                        j: {"#RAND_INT": [0, 10000]}
                    } }
]});

/*
* Setup: Set up document validator to check for the existence and type 
*        (integer) of ten fields.
* Test: Insert documents with random numbers in the ten integer fields
*       that are checked by the validator.
* Notes: This case tests the overhead for doc validation when ten 
*        fields are validated.
*/
tests.push( {   name: "Insert.DocValidation.TenInt", 
                tags: ['insert', 'DocValidation', 'regression'], 
                pre: function( collection) {
                    collection.drop();
                    collection.runCommand("create", {"validator": {
                        $and: [
                            {a: {$exists: true}},
                            {a: {$type: 16}},
                            {b: {$exists: true}},
                            {b: {$type: 16}},
                            {c: {$exists: true}},
                            {c: {$type: 16}},
                            {d: {$exists: true}},
                            {d: {$type: 16}},
                            {e: {$exists: true}},
                            {e: {$type: 16}},
                            {f: {$exists: true}},
                            {f: {$type: 16}},
                            {g: {$exists: true}},
                            {g: {$type: 16}},
                            {h: {$exists: true}},
                            {h: {$type: 16}},
                            {a: {$exists: true}},
                            {a: {$type: 16}},
                            {i: {$exists: true}},
                            {i: {$type: 16}},
                            {j: {$exists: true}},
                            {j: {$type: 16}}
                        ] }});
                },
                ops: [ {
                    op: "insert",
                    doc: {
                        a: {"#RAND_INT": [0, 10000]},
                        b: {"#RAND_INT": [0, 10000]},
                        c: {"#RAND_INT": [0, 10000]},
                        d: {"#RAND_INT": [0, 10000]},
                        e: {"#RAND_INT": [0, 10000]},
                        f: {"#RAND_INT": [0, 10000]},
                        g: {"#RAND_INT": [0, 10000]},
                        h: {"#RAND_INT": [0, 10000]},
                        i: {"#RAND_INT": [0, 10000]},
                        j: {"#RAND_INT": [0, 10000]}
                        } }
]});


/*
* Setup:
* Test: Insert documents with random numbers in twenty integer fields.
* Notes: This case is used for comparison against the similarly named
*        Insert.DocValidation.TwentyInt to characterize the overhead of doc
*        validation. 
*/
tests.push( {   name: "Insert.DocValidation.TwentyInt.Compare", 
                tags: ['insert', 'DocValidation', 'compare'], 
                pre: function( collection) {
                    collection.drop();
                },
                ops: [ {
                    op: "insert",
                    doc: {
                        a: {"#RAND_INT": [0, 10000]},
                        b: {"#RAND_INT": [0, 10000]},
                        c: {"#RAND_INT": [0, 10000]},
                        d: {"#RAND_INT": [0, 10000]},
                        e: {"#RAND_INT": [0, 10000]},
                        f: {"#RAND_INT": [0, 10000]},
                        g: {"#RAND_INT": [0, 10000]},
                        h: {"#RAND_INT": [0, 10000]},
                        i: {"#RAND_INT": [0, 10000]},
                        j: {"#RAND_INT": [0, 10000]},
                        k: {"#RAND_INT": [0, 10000]},
                        l: {"#RAND_INT": [0, 10000]},
                        m: {"#RAND_INT": [0, 10000]},
                        n: {"#RAND_INT": [0, 10000]},
                        o: {"#RAND_INT": [0, 10000]},
                        p: {"#RAND_INT": [0, 10000]},
                        q: {"#RAND_INT": [0, 10000]},
                        r: {"#RAND_INT": [0, 10000]},
                        s: {"#RAND_INT": [0, 10000]},
                        t: {"#RAND_INT": [0, 10000]}
                    } }
]});

/*
* Setup: Set up document validator to check for the existence and type 
*        (integer) of twenty fields.
* Test: Insert documents with random numbers in the twenty integer fields
*       that are checked by the validator.
* Notes: This case tests the overhead for doc validation when twenty 
*        fields are validated.
*/
tests.push( {   name: "Insert.DocValidation.TwentyInt", 
                tags: ['insert', 'DocValidation', 'regression'], 
                pre: function( collection) {
                    collection.drop();
                    collection.runCommand("create", {"validator": {
                        $and: [
                            {a: {$exists: true}},
                            {a: {$type: 16}},
                            {b: {$exists: true}},
                            {b: {$type: 16}},
                            {c: {$exists: true}},
                            {c: {$type: 16}},
                            {d: {$exists: true}},
                            {d: {$type: 16}},
                            {e: {$exists: true}},
                            {e: {$type: 16}},
                            {f: {$exists: true}},
                            {f: {$type: 16}},
                            {g: {$exists: true}},
                            {g: {$type: 16}},
                            {h: {$exists: true}},
                            {h: {$type: 16}},
                            {a: {$exists: true}},
                            {a: {$type: 16}},
                            {i: {$exists: true}},
                            {i: {$type: 16}},
                            {j: {$exists: true}},
                            {j: {$type: 16}},
                            {k: {$exists: true}},
                            {k: {$type: 16}},
                            {l: {$exists: true}},
                            {l: {$type: 16}},
                            {m: {$exists: true}},
                            {m: {$type: 16}},
                            {n: {$exists: true}},
                            {n: {$type: 16}},
                            {o: {$exists: true}},
                            {o: {$type: 16}},
                            {p: {$exists: true}},
                            {p: {$type: 16}},
                            {q: {$exists: true}},
                            {q: {$type: 16}},
                            {r: {$exists: true}},
                            {r: {$type: 16}},
                            {s: {$exists: true}},
                            {s: {$type: 16}},
                            {t: {$exists: true}},
                            {t: {$type: 16}},
                        ] }});
                },
                ops: [ {
                    op: "insert",
                    doc: {
                        a: {"#RAND_INT": [0, 10000]},
                        b: {"#RAND_INT": [0, 10000]},
                        c: {"#RAND_INT": [0, 10000]},
                        d: {"#RAND_INT": [0, 10000]},
                        e: {"#RAND_INT": [0, 10000]},
                        f: {"#RAND_INT": [0, 10000]},
                        g: {"#RAND_INT": [0, 10000]},
                        h: {"#RAND_INT": [0, 10000]},
                        i: {"#RAND_INT": [0, 10000]},
                        j: {"#RAND_INT": [0, 10000]},
                        k: {"#RAND_INT": [0, 10000]},
                        l: {"#RAND_INT": [0, 10000]},
                        m: {"#RAND_INT": [0, 10000]},
                        n: {"#RAND_INT": [0, 10000]},
                        o: {"#RAND_INT": [0, 10000]},
                        p: {"#RAND_INT": [0, 10000]},
                        q: {"#RAND_INT": [0, 10000]},
                        r: {"#RAND_INT": [0, 10000]},
                        s: {"#RAND_INT": [0, 10000]},
                        t: {"#RAND_INT": [0, 10000]}
                    } }
]});
